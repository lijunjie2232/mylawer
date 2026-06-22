/**
 * エージェントのセッションイベント
 *
 * harness（third/deepseek-harness）の turn / step / tool の流れを踏襲する:
 *   1 ターン = 0 以上のステップ、1 ステップ = 1 回のモデル要求 + そのツール呼び出し。
 *
 * Durable イベントは SessionEvent テーブルに追記され、履歴としてそのまま再生できる。
 * Live イベント（トークン差分）は表示専用で永続化しない。
 */

export type TurnStatus = 'completed' | 'aborted' | 'error';
export type StepStatus = 'completed' | 'aborted' | 'error';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface DurableEventDataMap {
  'turn/start': { turn: number };
  'turn/end': {
    turn: number;
    status: TurnStatus;
    durationMs?: number;
    stepCount?: number;
    toolCallCount?: number;
    usage?: TokenUsage;
  };
  'step/start': { turn: number; step: number };
  'step/end': {
    turn: number;
    step: number;
    status: StepStatus;
    durationMs?: number;
    usage?: TokenUsage;
  };
  'user/message': { turn: number; text: string };
  'assistant/message': { turn: number; step: number; text: string; reasoning?: string };
  'tool/call': { turn: number; step: number; callId: string; name: string; args?: unknown };
  'tool/result': {
    turn: number;
    step: number;
    callId: string;
    name?: string;
    content: string;
    isError: boolean;
    durationMs?: number;
  };
  error: { turn: number; message: string };
}

export type DurableEventType = keyof DurableEventDataMap;

export type DurableEvent = {
  [T in DurableEventType]: { type: T; data: DurableEventDataMap[T] };
}[DurableEventType];

export interface LiveEventDataMap {
  'assistant/delta': { turn: number; step: number; text: string };
  'assistant/reasoning-delta': { turn: number; step: number; text: string };
}

export type LiveEventType = keyof LiveEventDataMap;

export type LiveEvent = {
  [T in LiveEventType]: { type: T; data: LiveEventDataMap[T] };
}[LiveEventType];

export type AgentEvent = DurableEvent | LiveEvent;

const DURABLE_EVENT_TYPES = new Set<string>([
  'turn/start',
  'turn/end',
  'step/start',
  'step/end',
  'user/message',
  'assistant/message',
  'tool/call',
  'tool/result',
  'error',
]);

/** 永続化対象かどうか（トークン差分は保存しない） */
export function isDurableEvent(event: AgentEvent): event is DurableEvent {
  return DURABLE_EVENT_TYPES.has(event.type);
}

/** DB / API から読み出したイベント */
export interface StoredSessionEvent {
  seq: number;
  type: string;
  data: unknown;
  createdAt: string;
}
