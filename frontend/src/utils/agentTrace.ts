/**
 * エージェントの軌跡（turn / step / tool）を画面用のタイムラインに変換する。
 * deepseek-harness の SessionEvent 畳み込みに倣い、live イベント（差分）と
 * 保存済みイベント（確定）の両方を同じ関数で畳み込む。
 */

export interface TraceTool {
  kind: 'tool'
  callId: string
  name: string
  args?: unknown
  status: 'running' | 'completed' | 'error'
  result?: string
  durationMs?: number
  step: number
}

export interface TraceReasoning {
  kind: 'reasoning'
  text: string
  step: number
}

export interface TraceText {
  kind: 'text'
  text: string
  step: number
}

export interface TraceError {
  kind: 'error'
  message: string
  step: number
}

export type TraceItem = TraceTool | TraceReasoning | TraceText | TraceError

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export interface TurnMeta {
  status: 'completed' | 'aborted' | 'error'
  durationMs?: number
  stepCount?: number
  toolCallCount?: number
  usage?: TokenUsage
}

export interface FileAttachmentRef {
  attachmentId: string
  name: string
  bytes: number
  mediaType: string
  pageCount?: number
  charCount?: number
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export interface ChatMessage {
  id: string
  content: string
  sender: 'user' | 'assistant'
  timestamp: Date
  trace: TraceItem[]
  attachments?: FileAttachmentRef[]
  streaming?: boolean
  /** 中断・失敗で終わったターン（「停止しました」表示と再試行・継続の判定に使う） */
  interrupted?: boolean
  /** ターン完了時のサマリー情報（所要時間・ツール回数・トークン使用量） */
  turnMeta?: TurnMeta
}

export interface HistoryMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface StoredEvent {
  seq: number
  type: string
  data: any
  createdAt: string
}

function markRunningToolsAsError(items: TraceItem[]): TraceItem[] {
  let changed = false
  const next = items.map(item => {
    if (item.kind === 'tool' && item.status === 'running') {
      changed = true
      return { ...item, status: 'error' as const }
    }
    return item
  })
  return changed ? next : items
}

function findLastToolIndex(items: TraceItem[], callId: string): number {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]
    if (item.kind === 'tool' && item.callId === callId) return i
  }
  return -1
}

function stepOf(data: any): number {
  return typeof data?.step === 'number' ? data.step : 0
}

/** `turn/end` イベントから画面用の TurnMeta を抽出する */
export function extractTurnMeta(data: any): TurnMeta {
  const rawStatus = data?.status
  const status: TurnMeta['status'] =
    rawStatus === 'aborted' || rawStatus === 'error' ? rawStatus : 'completed'
  const meta: TurnMeta = { status }
  if (typeof data?.durationMs === 'number') meta.durationMs = data.durationMs
  if (typeof data?.stepCount === 'number') meta.stepCount = data.stepCount
  if (typeof data?.toolCallCount === 'number') meta.toolCallCount = data.toolCallCount
  if (data?.usage && typeof data.usage === 'object' && typeof data.usage.totalTokens === 'number') {
    meta.usage = {
      inputTokens: Number(data.usage.inputTokens ?? 0),
      outputTokens: Number(data.usage.outputTokens ?? 0),
      totalTokens: Number(data.usage.totalTokens ?? 0),
    }
  }
  return meta
}

/**
 * 1 イベントをタイムラインに適用する。変化がない場合は同じ参照を返す。
 * live=true のときは差分を追記し、確定メッセージによる二重追記を避ける。
 */
export function applyAgentEvent(
  items: TraceItem[],
  type: string,
  data: any,
  live: boolean
): TraceItem[] {
  const step = stepOf(data)

  switch (type) {
    case 'assistant/reasoning-delta': {
      const text = typeof data?.text === 'string' ? data.text : ''
      if (!text) return items
      const next = items.slice()
      const last = next[next.length - 1]
      if (last?.kind === 'reasoning' && last.step === step) {
        next[next.length - 1] = { ...last, text: last.text + text }
      } else {
        next.push({ kind: 'reasoning', text, step })
      }
      return next
    }

    case 'assistant/delta': {
      const text = typeof data?.text === 'string' ? data.text : ''
      if (!text) return items
      const next = items.slice()
      const last = next[next.length - 1]
      if (last?.kind === 'text' && last.step === step) {
        next[next.length - 1] = { ...last, text: last.text + text }
      } else {
        next.push({ kind: 'text', text, step })
      }
      return next
    }

    case 'assistant/message': {
      const next = items.slice()
      const hasReasoning = next.some(item => item.kind === 'reasoning' && item.step === step)
      const hasText = next.some(
        item => item.kind === 'text' && item.step === step && item.text.length > 0
      )

      if (data?.reasoning && (live ? !hasReasoning : true)) {
        const reasoning: TraceItem = { kind: 'reasoning', text: data.reasoning, step }
        const at = next.findIndex(item => item.step === step)
        if (at === -1) next.push(reasoning)
        else next.splice(at, 0, reasoning)
      }
      if (data?.text && (live ? !hasText : true)) {
        next.push({ kind: 'text', text: data.text, step })
      }
      return next.length === items.length ? items : next
    }

    case 'tool/call': {
      const next = items.slice()
      next.push({
        kind: 'tool',
        callId: data?.callId ?? '',
        name: data?.name ?? '',
        args: data?.args,
        status: 'running',
        step,
      })
      return next
    }

    case 'tool/result': {
      const next = items.slice()
      const at = findLastToolIndex(next, data?.callId ?? '')
      const patch = {
        status: data?.isError ? ('error' as const) : ('completed' as const),
        result: typeof data?.content === 'string' ? data.content : '',
        durationMs: typeof data?.durationMs === 'number' ? data.durationMs : undefined,
      }

      if (at >= 0) {
        const current = next[at]
        if (current.kind === 'tool') {
          next[at] = { ...current, ...patch, name: data?.name || current.name }
        }
      } else {
        next.push({
          kind: 'tool',
          callId: data?.callId ?? '',
          name: data?.name ?? '',
          status: patch.status,
          result: patch.result,
          durationMs: patch.durationMs,
          step,
        })
      }
      return next
    }

    case 'error': {
      const next = items.slice()
      next.push({
        kind: 'error',
        message: data?.message ?? data?.error ?? '不明なエラー',
        step,
      })
      return markRunningToolsAsError(next)
    }

    case 'turn/end': {
      if (data?.status === 'aborted') {
        return markRunningToolsAsError(items)
      }
      if (data?.status !== 'error') return items
      const next = markRunningToolsAsError(items)
      // 失敗で何も出力されなかったターンも、空の吹き出しではなくエラーとして見せる
      if (next.length === 0) {
        return [{ kind: 'error', message: '応答が中断されました。', step: 0 }]
      }
      return next
    }

    default:
      return items
  }
}

/** アシスタントの軌跡からコピー用の本文テキストを抽出する */
export function extractAssistantText(items: TraceItem[], fallback?: string): string {
  const joined = items
    .filter((item): item is TraceText => item.kind === 'text')
    .map(item => item.text)
    .join('\n\n')
    .trim()
  return joined || (fallback ?? '')
}

function toChatMessage(message: HistoryMessage): ChatMessage {
  return {
    id: message.id,
    sender: message.role,
    content: message.content,
    timestamp: new Date(message.createdAt),
    trace: [],
  }
}

/** 保存済みイベントを 1 ターン = ユーザー発話 + アシスタント軌跡 に再構成する */
function foldEvents(events: StoredEvent[]): ChatMessage[] {
  const out: ChatMessage[] = []
  let assistant: ChatMessage | null = null

  for (const event of events) {
    if (event.type === 'user/message') {
      const turn = event.data?.turn ?? out.length
      const rawAttachments = Array.isArray(event.data?.attachments)
        ? (event.data.attachments as FileAttachmentRef[]).filter(
            a => a && typeof a.attachmentId === 'string' && typeof a.name === 'string'
          )
        : undefined
      out.push({
        id: `event-user-${turn}`,
        sender: 'user',
        content: event.data?.text ?? '',
        timestamp: new Date(event.createdAt),
        trace: [],
        ...(rawAttachments && rawAttachments.length > 0 ? { attachments: rawAttachments } : {}),
      })
      assistant = {
        id: `event-assistant-${turn}`,
        sender: 'assistant',
        content: '',
        timestamp: new Date(event.createdAt),
        trace: [],
        streaming: false,
      }
      out.push(assistant)
      continue
    }

    if (!assistant) continue
    if (event.type === 'turn/end') {
      const meta = extractTurnMeta(event.data)
      assistant.turnMeta = meta
      assistant.interrupted = meta.status === 'error' || meta.status === 'aborted'
    }
    assistant.trace = applyAgentEvent(assistant.trace, event.type, event.data, false)
  }

  for (const message of out) {
    if (message.sender !== 'assistant') continue
    message.content = message.trace
      .filter((item): item is TraceText => item.kind === 'text')
      .map(item => item.text)
      .join('')
  }

  return out
}

/**
 * 履歴メッセージとイベントログをマージする。
 * イベントログ導入前のターンはメッセージから、以降はイベントから復元する。
 */
export function buildMessages(history: HistoryMessage[], events: StoredEvent[]): ChatMessage[] {
  if (events.length === 0) return history.map(toChatMessage)

  const eventUserCount = events.filter(event => event.type === 'user/message').length
  const totalUsers = history.filter(message => message.role === 'user').length
  const legacyUsers = Math.max(totalUsers - eventUserCount, 0)

  let seen = 0
  let cutoff = history.length
  for (let i = 0; i < history.length; i++) {
    if (history[i].role !== 'user') continue
    if (seen === legacyUsers) {
      cutoff = i
      break
    }
    seen++
  }

  const legacy = history.slice(0, cutoff).map(toChatMessage)
  const ordered = events.slice().sort((a, b) => a.seq - b.seq)
  return [...legacy, ...foldEvents(ordered)]
}

/** 直前のユーザー発話（再試行用） */
export function lastUserQuestion(messages: ChatMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender === 'user') return messages[i].content
  }
  return null
}
