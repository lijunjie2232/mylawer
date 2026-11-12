/**
 * テキスト系ファイルおよび埋め込みテキスト PDF の検証・テキスト抽出。
 *
 * 現時点ではテキストベースファイル（.txt / .md / .csv / .json / .xml / .html / .yaml 等）と、
 * 埋め込みテキストを持つ PDF のみをサポートする。
 * 画像のみの PDF（スキャン PDF）やバイナリファイルは明確なエラーで拒否する。
 */

import path from 'node:path';
import { AttachmentError, type ExtractedFileText } from './types.js';

const TEXT_EXTENSION_MIME: Record<string, string> = {
  '.txt': 'text/plain',
  '.text': 'text/plain',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.csv': 'text/csv',
  '.tsv': 'text/tab-separated-values',
  '.json': 'application/json',
  '.jsonl': 'application/x-ndjson',
  '.xml': 'application/xml',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.yaml': 'application/yaml',
  '.yml': 'application/yaml',
  '.log': 'text/plain',
  '.ini': 'text/plain',
  '.conf': 'text/plain',
  '.cfg': 'text/plain',
  '.tex': 'text/plain',
  '.rtf': 'text/plain',
};

const KNOWN_BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.tif', '.tiff', '.heic',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp',
  '.zip', '.gz', '.tar', '.7z', '.rar', '.bz2', '.xz',
  '.mp3', '.wav', '.m4a', '.ogg', '.mp4', '.mov', '.avi', '.mkv', '.webm',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.wasm', '.class', '.jar',
]);

export const SUPPORTED_FILE_EXTENSIONS = [...Object.keys(TEXT_EXTENSION_MIME), '.pdf'];

function hasPdfMagic(data: Uint8Array): boolean {
  // PDF ヘッダは先頭 1024 バイト以内に %PDF- が現れる（通常は先頭 0 バイト）
  const limit = Math.min(data.byteLength, 1024);
  for (let i = 0; i <= limit - 5; i++) {
    if (
      data[i] === 0x25 && // %
      data[i + 1] === 0x50 && // P
      data[i + 2] === 0x44 && // D
      data[i + 3] === 0x46 && // F
      data[i + 4] === 0x2d // -
    ) {
      return true;
    }
  }
  return false;
}

function hasKnownBinaryMagic(data: Uint8Array): boolean {
  if (data.byteLength < 4) return false;
  // PNG
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return true;
  // JPEG
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return true;
  // GIF
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38) return true;
  // ZIP / DOCX / XLSX / PPTX
  if (data[0] === 0x50 && data[1] === 0x4b && (data[2] === 0x03 || data[2] === 0x05 || data[2] === 0x07)) return true;
  // OLE2 (.doc / .xls / .ppt)
  if (data[0] === 0xd0 && data[1] === 0xcf && data[2] === 0x11 && data[3] === 0xe0) return true;
  // GZIP
  if (data[0] === 0x1f && data[1] === 0x8b) return true;
  // ELF / PE / Mach-O
  if (data[0] === 0x7f && data[1] === 0x45 && data[2] === 0x4c && data[3] === 0x46) return true;
  return false;
}

function normalizeText(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .trim();
}

function looksBinaryText(text: string): boolean {
  if (text.includes('\u0000')) return true;
  // タブ・改行以外の制御文字の割合が高すぎる場合はバイナリとみなす
  let controlCount = 0;
  const sampleLen = Math.min(text.length, 8192);
  for (let i = 0; i < sampleLen; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d && code !== 0x0c) {
      controlCount++;
    }
  }
  return sampleLen > 0 && controlCount / sampleLen > 0.05;
}

function decodeTextBytes(data: Uint8Array): string {
  // UTF-16 BOM 判定
  if (data.byteLength >= 2 && data[0] === 0xff && data[1] === 0xfe) {
    return new TextDecoder('utf-16le', { fatal: true }).decode(data.subarray(2));
  }
  if (data.byteLength >= 2 && data[0] === 0xfe && data[1] === 0xff) {
    return new TextDecoder('utf-16be', { fatal: true }).decode(data.subarray(2));
  }

  // NUL バイトを含む場合はテキストではない（UTF-16 以外）
  const checkLen = Math.min(data.byteLength, 16384);
  for (let i = 0; i < checkLen; i++) {
    if (data[i] === 0x00) {
      throw new AttachmentError(
        'バイナリファイルは現在サポートされていません。テキストファイル（.txt / .md / .csv 等）または埋め込みテキスト付きの PDF をアップロードしてください。',
        'BINARY_FILE_UNSUPPORTED'
      );
    }
  }

  // 1. UTF-8（厳密）
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(data);
  } catch {
    // 2. 日本語環境で多い Shift_JIS / EUC-JP にフォールバック
  }

  for (const encoding of ['shift_jis', 'euc-jp'] as const) {
    try {
      return new TextDecoder(encoding, { fatal: true }).decode(data);
    } catch {
      // try next
    }
  }

  throw new AttachmentError(
    'ファイルの文字コードをテキストとして読み取れませんでした（UTF-8 / Shift_JIS / EUC-JP に対応しています）。',
    'BINARY_FILE_UNSUPPORTED'
  );
}

/**
 * pdfjs-dist を使って PDF から埋め込みテキストをページ単位で抽出する。
 */
async function extractPdfText(data: Uint8Array): Promise<ExtractedFileText> {
  let pdfjs: any;
  try {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  } catch (error) {
    throw new AttachmentError(
      'PDF 解析エンジンの読み込みに失敗しました。',
      'PDF_PARSE_FAILED',
      { cause: error }
    );
  }

  let loadingTask: any;
  let doc: any;
  try {
    loadingTask = pdfjs.getDocument({
      data: new Uint8Array(data),
      useSystemFonts: true,
      disableFontFace: true,
      isEvalSupported: false,
      verbosity: 0,
    });
    doc = await loadingTask.promise;
    const pageCount: number = doc.numPages;
    const pages: string[] = [];

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await doc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const lines: string[] = [];
      let currentLine = '';
      let lastY: number | null = null;

      for (const item of textContent.items ?? []) {
        if (typeof item?.str !== 'string') continue;
        const y = Array.isArray(item.transform) ? Math.round(item.transform[5]) : null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 2 && currentLine.length > 0) {
          lines.push(currentLine.trimEnd());
          currentLine = '';
        }
        currentLine += item.str;
        if (item.hasEOL) {
          lines.push(currentLine.trimEnd());
          currentLine = '';
          lastY = null;
        } else {
          lastY = y;
        }
      }
      if (currentLine.trim().length > 0) {
        lines.push(currentLine.trimEnd());
      }

      const pageText = lines.join('\n').trim();
      if (pageText.length > 0) {
        pages.push(`--- Page ${pageNum} ---\n${pageText}`);
      }
      page.cleanup?.();
    }

    const combined = normalizeText(pages.join('\n\n'));
    if (combined.length === 0) {
      throw new AttachmentError(
        'この PDF には埋め込みテキストが含まれていません。スキャン画像のみの PDF は現在未対応です。テキスト選択可能な PDF またはテキストファイルをアップロードしてください。',
        'PDF_NO_EMBEDDED_TEXT'
      );
    }

    return {
      text: combined,
      mediaType: 'application/pdf',
      pageCount,
      charCount: combined.length,
    };
  } catch (error) {
    if (error instanceof AttachmentError) throw error;
    throw new AttachmentError(
      'PDF の解析に失敗しました。ファイルが破損しているか、パスワード保護されている可能性があります。',
      'PDF_PARSE_FAILED',
      { cause: error }
    );
  } finally {
    if (typeof doc?.destroy === 'function') {
      await doc.destroy().catch(() => {});
    } else if (typeof loadingTask?.destroy === 'function') {
      await loadingTask.destroy().catch(() => {});
    }
  }
}

/**
 * アップロードされたバイト列を検証し、テキストを抽出する。
 */
export async function extractSupportedFileText(
  data: Uint8Array,
  fileName: string
): Promise<ExtractedFileText> {
  if (data.byteLength === 0) {
    throw new AttachmentError('空のファイルはアップロードできません。', 'EMPTY_FILE');
  }

  const ext = path.extname(fileName).toLowerCase();

  if (KNOWN_BINARY_EXTENSIONS.has(ext)) {
    throw new AttachmentError(
      `「${ext}」形式は現在サポートされていません。テキスト系ファイル（.txt / .md / .csv / .json 等）または埋め込みテキスト付き PDF（.pdf）をご利用ください。`,
      'UNSUPPORTED_FILE_TYPE'
    );
  }

  if (ext === '.pdf' || hasPdfMagic(data)) {
    if (!hasPdfMagic(data)) {
      throw new AttachmentError(
        '有効な PDF ファイルではありません（%PDF ヘッダが見つかりません）。',
        'PDF_PARSE_FAILED'
      );
    }
    return extractPdfText(data);
  }

  if (hasKnownBinaryMagic(data)) {
    throw new AttachmentError(
      'バイナリファイルは現在サポートされていません。テキスト系ファイルまたは埋め込みテキスト付き PDF をアップロードしてください。',
      'BINARY_FILE_UNSUPPORTED'
    );
  }

  const decoded = decodeTextBytes(data);
  if (looksBinaryText(decoded)) {
    throw new AttachmentError(
      'バイナリデータを含むファイルは現在サポートされていません。テキスト系ファイルまたは埋め込みテキスト付き PDF をアップロードしてください。',
      'BINARY_FILE_UNSUPPORTED'
    );
  }

  const normalized = normalizeText(decoded);
  if (normalized.length === 0) {
    throw new AttachmentError('ファイルに読み取り可能なテキストが含まれていません。', 'EMPTY_FILE');
  }

  const mediaType = TEXT_EXTENSION_MIME[ext] ?? 'text/plain';
  return {
    text: normalized,
    mediaType,
    charCount: normalized.length,
  };
}
