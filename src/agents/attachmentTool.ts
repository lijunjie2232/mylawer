/**
 * 添付ファイルを安全に読み取るためのエージェント内蔵ツール（read_uploaded_file）。
 *
 * 現在のセッション（thread_id）で承認済みの attachmentId のみにアクセスを制限し、
 * 長い契約書・PDF のページ送り読み取り（offset / limit）や条項キーワード検索（query）を提供する。
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { LocalAttachmentStore } from '../attachments/attachmentStore.js';
import { FileUploadService } from '../attachments/fileUploadService.js';

const DEFAULT_READ_LIMIT = 8000;
const MAX_READ_LIMIT = 16000;
const SEARCH_CONTEXT_CHARS = 240;
const MAX_SEARCH_MATCHES = 10;

export function createReadUploadedFileTool() {
  return tool(
    async ({ attachmentId, offset, limit, query }, runnableConfig) => {
      const threadId = String((runnableConfig as any)?.configurable?.thread_id ?? '');
      if (!threadId) {
        return 'Error: セッションコンテキストが取得できないため添付ファイルを読み取れません。';
      }

      const uploadService = FileUploadService.getInstance();
      const ref = await uploadService.findAdmittedFile(threadId, attachmentId);
      if (!ref) {
        const available = uploadService.listAdmittedFiles(threadId);
        const hint = available.length > 0
          ? `このセッションで利用可能な添付ファイル: ${available.map(f => `${f.name} (${f.attachmentId})`).join(', ')}`
          : 'このセッションには利用可能な添付ファイルがありません。';
        return `Error: 指定された attachmentId (${attachmentId}) はこのセッションでは利用できません。${hint}`;
      }

      let fullText: string;
      try {
        fullText = await LocalAttachmentStore.getInstance().readExtractedText(ref.attachmentId, ref.name);
      } catch (error) {
        return `Error: 添付ファイル「${ref.name}」の読み取りに失敗しました: ${(error as Error).message}`;
      }

      const totalChars = fullText.length;

      // キーワード検索モード
      if (query && query.trim().length > 0) {
        const needle = query.trim();
        const lowerFull = fullText.toLowerCase();
        const lowerNeedle = needle.toLowerCase();
        const matches: string[] = [];
        let searchFrom = 0;

        while (matches.length < MAX_SEARCH_MATCHES) {
          const idx = lowerFull.indexOf(lowerNeedle, searchFrom);
          if (idx === -1) break;
          const start = Math.max(0, idx - SEARCH_CONTEXT_CHARS);
          const end = Math.min(totalChars, idx + needle.length + SEARCH_CONTEXT_CHARS);
          const snippet = fullText.slice(start, end);
          matches.push(`[offset ${start}-${end}]\n${snippet}`);
          searchFrom = idx + Math.max(1, needle.length);
        }

        if (matches.length === 0) {
          return `ファイル「${ref.name}」（全 ${totalChars} 文字）内でキーワード「${needle}」に一致する箇所は見つかりませんでした。`;
        }

        return [
          `ファイル「${ref.name}」（全 ${totalChars} 文字）内の「${needle}」検索結果（${matches.length} 件）:`,
          ...matches,
        ].join('\n\n');
      }

      // 範囲読み取りモード
      const start = Math.max(0, offset ?? 0);
      const maxLen = Math.min(MAX_READ_LIMIT, Math.max(100, limit ?? DEFAULT_READ_LIMIT));
      if (start >= totalChars) {
        return `ファイル「${ref.name}」（全 ${totalChars} 文字）の末尾に達しています（要求 offset=${start}）。`;
      }

      const end = Math.min(totalChars, start + maxLen);
      const chunk = fullText.slice(start, end);
      const remaining = totalChars - end;
      const footer = remaining > 0
        ? `\n\n（続きが ${remaining} 文字あります。offset=${end} を指定して再度読み取れます）`
        : '\n\n（ファイル末尾まで読み取り完了）';

      return `ファイル「${ref.name}」[${start}..${end} / 全 ${totalChars} 文字]:\n\n${chunk}${footer}`;
    },
    {
      name: 'read_uploaded_file',
      description:
        '利用者がアップロードした契約書・PDF・テキストファイルの本文を読み取る、またはキーワードで該当条項を検索するツール。プロンプト内で省略された続きを読む場合や、フォローアップ質問で再確認する場合に使用する。',
      schema: z.object({
        attachmentId: z.string().describe('添付ファイルの attachmentId（例: sha256:...）'),
        offset: z.number().int().min(0).optional().describe('読み取り開始文字位置（既定 0）'),
        limit: z.number().int().min(100).max(MAX_READ_LIMIT).optional().describe('読み取る最大文字数（既定 8000、最大 16000）'),
        query: z.string().optional().describe('ファイル内の特定条項・語句を検索するキーワード'),
      }),
    }
  );
}
