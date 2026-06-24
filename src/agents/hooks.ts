import { createMiddleware } from 'langchain';
import { HumanMessage, ToolMessage, type BaseMessage } from '@langchain/core/messages';

function messageRole(message: any): string {
  return typeof message?._getType === 'function' ? message._getType() : message?.role ?? '';
}

/** 現在のターン（最後のユーザー発話以降）で既にツールが1回以上呼ばれたか判定する */
function hasToolResultInCurrentTurn(messages: any[] | undefined): boolean {
  if (!Array.isArray(messages) || messages.length === 0) return false;
  for (let i = messages.length - 1; i >= 0; i--) {
    const role = messageRole(messages[i]);
    if (role === 'tool') return true;
    if (role === 'human' || role === 'user') return false;
  }
  return false;
}

/** 末尾の HumanMessage のみ複製し、動的コンテキストを `<system-reminder>` として付与する */
function appendReminderToLastUserMessage(messages: BaseMessage[], reminder: string): BaseMessage[] {
  if (messages.length === 0) return messages;
  const lastIndex = messages.length - 1;
  const last = messages[lastIndex];
  const role = messageRole(last);
  if (role !== 'human' && role !== 'user') return messages;

  const content = last.content;
  const nextContent = typeof content === 'string'
    ? `${content}\n\n${reminder}`
    : Array.isArray(content)
      ? [...content, { type: 'text', text: `\n\n${reminder}` }]
      : `${String(content ?? '')}\n\n${reminder}`;

  const cloned = new HumanMessage({
    content: nextContent,
    id: last.id,
    name: last.name,
    additional_kwargs: last.additional_kwargs,
    response_metadata: last.response_metadata,
  });

  const nextMessages = messages.slice();
  nextMessages[lastIndex] = cloned;
  return nextMessages;
}

/**
 * 実行時コンテキストをモデル呼び出しの直前に注入するミドルウェア。
 *
 * deepseek-harness の `RuntimeContextProjection` と同じ設計:
 * - システムプロンプトは静的に保ち、LLM API 側のプロンプトキャッシュ（KV cache）を壊さない。
 * - 日時やターン初回ステップの検索優先リマインダーは、末尾のユーザーメッセージへ
 *   `<system-reminder>` として付与する（元のチェックポイント履歴は書き換えない）。
 */
export function runtimeContextMiddleware(options: { toolNames?: string[] } = {}) {
  const toolNames = options.toolNames ?? [];

  return createMiddleware({
    name: 'legal-runtime-context',
    wrapModelCall: async (request, handler) => {
      // 同一ターンの 2 ステップ目以降（ツール結果返却後）はプレフィックスを変えずそのまま渡す
      if (hasToolResultInCurrentTurn(request.messages)) {
        return handler(request);
      }

      const today = new Date().toLocaleDateString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
      });

      const lines = [
        '<system-reminder>',
        `現在日付: ${today}（Asia/Tokyo）`,
      ];

      if (toolNames.length > 0) {
        lines.push(
          `【検索優先リマインダー】このターンではまだツールが実行されていません。単なる挨拶を除き、必ず利用可能なツール（${toolNames.join(', ')}）で法令条文や最新情報を検索・確認してから最終回答を作成してください。`
        );
      }

      lines.push('</system-reminder>');

      const messages = appendReminderToLastUserMessage(request.messages, lines.join('\n'));
      return handler({ ...request, messages });
    },
  });
}

/**
 * ツール呼び出しに協調的なタイムアウトを課すミドルウェア。
 * deepseek-harness の `packages/guard/timeout-policy` に相当。
 * MCP サーバーや外部ウェブ取得がハングしてもターン全体を止めず、
 * 構造化されたエラー ToolMessage を返してモデルに代替手段を選ばせる。
 */
export function toolTimeoutMiddleware(options: { timeoutMs?: number } = {}) {
  const timeoutMs = options.timeoutMs ?? 30_000;

  return createMiddleware({
    name: 'legal-tool-timeout',
    wrapToolCall: async (request, handler) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          handler(request),
          new Promise<ToolMessage>(resolve => {
            timer = setTimeout(() => {
              resolve(
                new ToolMessage({
                  tool_call_id: request.toolCall.id ?? '',
                  name: request.toolCall.name,
                  status: 'error',
                  content: `Error [TOOL_TIMEOUT]: ツール「${request.toolCall.name}」の実行が ${timeoutMs}ms でタイムアウトしました。別の検索条件や代替手段を試すか、確認できなかった旨を回答に明記してください。`,
                })
              );
            }, timeoutMs);
          }),
        ]);
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
    },
  });
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortJsonValue(record[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * 引数オブジェクトのキーを再帰的にソートして正規化文字列を返す。
 * キー順だけが異なる同一呼び出しを同じキーとして検出するため。
 */
export function canonicalizeToolArgs(args: unknown): string {
  try {
    return JSON.stringify(sortJsonValue(args ?? {}));
  } catch {
    return String(args);
  }
}

function previewArgs(canonical: string, maxChars: number): string {
  if (canonical.length <= maxChars) return canonical;
  return `${canonical.slice(0, maxChars)}… (+${canonical.length - maxChars} chars)`;
}

/**
 * 同一ツール・同一引数の連続呼び出しを検出し、モデルに助言を添えるガード。
 * deepseek-harness の `packages/guard/repeat-tool-reminder` に相当。
 * 強制打ち切り（toolCallLimitMiddleware）の前に、段階的なリマインダーでループを脱出させる。
 */
export function repeatToolGuardMiddleware(options: {
  thresholds?: number[];
  argumentsPreviewChars?: number;
} = {}) {
  const thresholds = [...(options.thresholds ?? [2, 3])].sort((a, b) => a - b);
  const thresholdSet = new Set(thresholds);
  const previewCap = options.argumentsPreviewChars ?? 400;

  // セッション（thread_id）ごとに直前の連続呼び出しチェーンを保持
  const chains = new Map<string, { key: string; count: number }>();

  return createMiddleware({
    name: 'legal-repeat-tool-guard',
    wrapToolCall: async (request, handler) => {
      const result = await handler(request);

      const threadId = String((request.runtime as any)?.configurable?.thread_id ?? 'default');
      const toolName = request.toolCall.name;
      const canonical = canonicalizeToolArgs(request.toolCall.args);
      const key = JSON.stringify([toolName, canonical]);

      const prev = chains.get(threadId);
      const count = prev?.key === key ? prev.count + 1 : 1;
      chains.set(threadId, { key, count });

      // メモリ肥大化防止（古いスレッドのエントリを間引く）
      if (chains.size > 500) {
        const oldest = chains.keys().next().value;
        if (oldest !== undefined) chains.delete(oldest);
      }

      if (!thresholdSet.has(count)) return result;

      const reminder = count === thresholds[0]
        ? '\n\n[System Reminder] 直前とまったく同じ引数で同じツールを呼び出しています。前回の結果をよく確認し、未解決であれば別の検索語や別のアプローチを試してください。'
        : `\n\n[System Reminder] 同一ツールの連続呼び出しを検出しました:\n- tool: ${toolName}\n- consecutive_calls: ${count}\n- arguments: ${previewArgs(canonical, previewCap)}\n同じ呼び出しを繰り返しても進展しません。別のアプローチに切り替えるか、これまでに得られた根拠で回答をまとめてください。`;

      if (result instanceof ToolMessage) {
        const base = typeof result.content === 'string'
          ? result.content
          : JSON.stringify(result.content);
        return new ToolMessage({
          tool_call_id: result.tool_call_id,
          name: result.name,
          status: result.status,
          content: base + reminder,
        });
      }

      return result;
    },
  });
}
