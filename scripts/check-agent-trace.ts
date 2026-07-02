/**
 * タイムライン畳み込み・エージェント変換・ガードの自己チェック。
 * 実行: LLM_API_KEY=test-key pnpm exec tsx scripts/check-agent-trace.ts
 */
import assert from 'node:assert/strict'
import {
  applyAgentEvent,
  buildMessages,
  extractAssistantText,
  extractTurnMeta,
  lastUserQuestion,
  type TraceItem,
  type HistoryMessage,
  type StoredEvent,
} from '../frontend/src/utils/agentTrace'

// --- live: 差分 → ツール → 最終メッセージ（二重追記しない） ---
let trace: TraceItem[] = []
trace = applyAgentEvent(trace, 'assistant/reasoning-delta', { step: 1, text: '考え' }, true)
trace = applyAgentEvent(trace, 'assistant/delta', { step: 1, text: 'まず' }, true)
trace = applyAgentEvent(trace, 'assistant/message', { step: 1, text: 'まず', reasoning: '考え' }, true)
trace = applyAgentEvent(trace, 'tool/call', { step: 1, callId: 'c1', name: 'search', args: { q: 'x' } }, true)
trace = applyAgentEvent(trace, 'tool/result', {
  step: 1, callId: 'c1', name: 'search', content: 'ok', isError: false, durationMs: 120,
}, true)
trace = applyAgentEvent(trace, 'assistant/delta', { step: 2, text: '答え' }, true)

assert.deepEqual(trace.map(item => item.kind), ['reasoning', 'text', 'tool', 'text'])
assert.equal((trace[1] as any).text, 'まず')
assert.equal((trace[2] as any).status, 'completed')
assert.equal((trace[2] as any).result, 'ok')
assert.equal((trace[3] as any).text, '答え')
assert.equal(extractAssistantText(trace), 'まず\n\n答え')

// --- replay: 旧メッセージ + 新イベントログのマージ ---
const history: HistoryMessage[] = [
  { id: 'u1', role: 'user', content: '旧1', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'a1', role: 'assistant', content: '旧回答1', createdAt: '2026-01-01T00:00:01.000Z' },
  { id: 'u2', role: 'user', content: '旧2', createdAt: '2026-01-01T00:00:02.000Z' },
  { id: 'a2', role: 'assistant', content: '旧回答2', createdAt: '2026-01-01T00:00:03.000Z' },
  { id: 'u3', role: 'user', content: '新', createdAt: '2026-01-01T00:00:04.000Z' },
]

const events: StoredEvent[] = [
  { seq: 1, type: 'user/message', data: { turn: 3, text: '新' }, createdAt: '2026-01-01T00:00:04.100Z' },
  { seq: 2, type: 'turn/start', data: { turn: 3 }, createdAt: '2026-01-01T00:00:04.200Z' },
  { seq: 3, type: 'step/start', data: { turn: 3, step: 1 }, createdAt: '2026-01-01T00:00:04.300Z' },
  { seq: 4, type: 'assistant/message', data: { turn: 3, step: 1, text: '新回答' }, createdAt: '2026-01-01T00:00:05.000Z' },
  { seq: 5, type: 'tool/call', data: { turn: 3, step: 1, callId: 'c1', name: 'law_search' }, createdAt: '2026-01-01T00:00:05.100Z' },
  { seq: 6, type: 'tool/result', data: { turn: 3, step: 1, callId: 'c1', name: 'law_search', content: '結果', isError: false }, createdAt: '2026-01-01T00:00:05.500Z' },
  {
    seq: 7,
    type: 'turn/end',
    data: {
      turn: 3,
      status: 'completed',
      durationMs: 1800,
      stepCount: 1,
      toolCallCount: 1,
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    },
    createdAt: '2026-01-01T00:00:06.000Z',
  },
]

const merged = buildMessages(history, events)
assert.equal(merged.length, 6)
assert.equal(merged.filter(message => message.sender === 'user').length, 3)
assert.equal(merged[4].sender, 'user')
assert.equal(merged[4].content, '新')
assert.equal(merged[5].sender, 'assistant')
assert.equal(merged[5].content, '新回答')
assert.deepEqual(merged[5].trace.map(item => item.kind), ['text', 'tool'])
assert.equal(merged[5].turnMeta?.durationMs, 1800)
assert.equal(merged[5].turnMeta?.usage?.totalTokens, 150)

// イベントが無いセッションはメッセージにフォールバック
assert.equal(buildMessages(history, []).length, 5)

// エラー終了で何も出力が無いターンはエラー項目として表示する
const errored = buildMessages([], [
  { seq: 1, type: 'user/message', data: { turn: 1, text: '途中' }, createdAt: '2026-01-01T00:00:00.000Z' },
  { seq: 2, type: 'turn/start', data: { turn: 1 }, createdAt: '2026-01-01T00:00:01.000Z' },
  { seq: 3, type: 'turn/end', data: { turn: 1, status: 'error' }, createdAt: '2026-01-01T00:00:02.000Z' },
])
assert.equal(errored.length, 2)
assert.equal(errored[1].trace[0].kind, 'error')
assert.equal(errored[1].interrupted, true)

// ユーザーによる停止（aborted）はエラー項目を増やさず interrupted として扱う
const aborted = buildMessages([], [
  { seq: 1, type: 'user/message', data: { turn: 1, text: '途中' }, createdAt: '2026-01-01T00:00:00.000Z' },
  { seq: 2, type: 'assistant/delta', data: { turn: 1, step: 1, text: '途中まで' }, createdAt: '2026-01-01T00:00:01.000Z' },
  { seq: 3, type: 'turn/end', data: { turn: 1, status: 'aborted' }, createdAt: '2026-01-01T00:00:02.000Z' },
])
assert.equal(aborted[1].interrupted, true)
assert.equal(aborted[1].turnMeta?.status, 'aborted')
assert.equal(aborted[1].trace.some(item => item.kind === 'error'), false)

// 中断後の継続生成は同じアシスタント吹き出しに追記し、完了時に interrupted を解除する
const continued = buildMessages([], [
  { seq: 1, type: 'user/message', data: { turn: 1, text: '質問' }, createdAt: '2026-01-01T00:00:00.000Z' },
  { seq: 2, type: 'assistant/delta', data: { turn: 1, step: 1, text: '前半' }, createdAt: '2026-01-01T00:00:01.000Z' },
  { seq: 3, type: 'turn/end', data: { turn: 1, status: 'aborted' }, createdAt: '2026-01-01T00:00:02.000Z' },
  { seq: 4, type: 'assistant/delta', data: { turn: 2, step: 1, text: '後半' }, createdAt: '2026-01-01T00:00:03.000Z' },
  { seq: 5, type: 'turn/end', data: { turn: 2, status: 'completed' }, createdAt: '2026-01-01T00:00:04.000Z' },
])
assert.equal(continued.length, 2)
assert.equal(continued[1].interrupted, false)
assert.equal((continued[1].trace[0] as any).text, '前半後半')
assert.equal(lastUserQuestion(continued), '質問')
assert.equal(extractTurnMeta({ status: 'completed', durationMs: 500 }).durationMs, 500)

// ツール失敗は error ステータスになる
let failedTool: TraceItem[] = []
failedTool = applyAgentEvent(failedTool, 'tool/call', { step: 1, callId: 'e1', name: 't' }, true)
failedTool = applyAgentEvent(failedTool, 'tool/result', {
  step: 1, callId: 'e1', name: 't', content: 'failed', isError: true,
}, true)
assert.equal((failedTool[0] as any).status, 'error')

// --- backend: LangGraph の [mode, payload] を SessionEvent に変換できる ---
async function checkAgentTranslation() {
  const { LegalAgent } = await import('../src/agents/legalAgent.js')
  const { canonicalizeToolArgs } = await import('../src/agents/hooks.js')
  const agent: any = new LegalAgent()

  // 引数の正規化: キー順が違っても同一文字列になる
  assert.equal(
    canonicalizeToolArgs({ b: 2, a: { y: 1, x: 0 } }),
    canonicalizeToolArgs({ a: { x: 0, y: 1 }, b: 2 })
  )

  const stream = [
    ['messages', [{ _getType: () => 'ai', content: '', additional_kwargs: { reasoning_content: '考え' } }, { langgraph_node: 'model_request' }]],
    ['messages', [{ _getType: () => 'ai', content: '調べます' }, { langgraph_node: 'model_request' }]],
    ['updates', { model_request: { messages: [{
      _getType: () => 'ai',
      content: '調べます',
      additional_kwargs: { reasoning_content: '考え' },
      usage_metadata: { input_tokens: 120, output_tokens: 30, total_tokens: 150 },
      tool_calls: [{ id: 'c1', name: 'law_search', args: { q: '窃盗' } }],
    }] } }],
    ['updates', { tools: { messages: [{
      _getType: () => 'tool',
      tool_call_id: 'c1',
      name: 'law_search',
      content: '検索結果',
      status: 'success',
    }] } }],
    ['messages', [{ _getType: () => 'ai', content: '答え' }, { langgraph_node: 'model_request' }]],
    ['updates', { model_request: { messages: [{
      _getType: () => 'ai',
      content: '答え',
      usage_metadata: { input_tokens: 200, output_tokens: 80, total_tokens: 280 },
    }] } }],
  ]

  async function* source() {
    for (const item of stream) yield item
  }

  const events: any[] = []
  for await (const event of agent.translate(source(), 1)) events.push(event)

  assert.deepEqual(events.map(event => event.type), [
    'turn/start',
    'step/start',
    'assistant/reasoning-delta',
    'assistant/delta',
    'assistant/message',
    'tool/call',
    'tool/result',
    'step/end',
    'step/start',
    'assistant/delta',
    'assistant/message',
    'step/end',
    'turn/end',
  ])
  assert.equal(events[4].data.reasoning, '考え')
  assert.equal(events[5].data.name, 'law_search')
  assert.equal(events[6].data.content, '検索結果')
  assert.equal(events[6].data.isError, false)
  assert.equal(events[12].data.status, 'completed')
  assert.equal(events[12].data.stepCount, 2)
  assert.equal(events[12].data.toolCallCount, 1)
  assert.deepEqual(events[12].data.usage, { inputTokens: 320, outputTokens: 110, totalTokens: 430 })
  assert.equal(typeof events[12].data.durationMs, 'number')

  // 単一モード（[message, metadata]）でも本文は流れる
  async function* singleMode() {
    yield [{ _getType: () => 'ai', content: 'フォールバック' }, { langgraph_node: 'model_request' }]
  }
  const single: any[] = []
  for await (const event of agent.translate(singleMode(), 1)) single.push(event)
  assert.deepEqual(single.map(event => event.type), [
    'turn/start', 'step/start', 'assistant/delta', 'step/end', 'turn/end',
  ])

  // ストリーム失敗時は error + turn/end(error) でターンを閉じる
  async function* failing(): AsyncIterable<any> {
    throw new Error('boom')
  }
  const failed: any[] = []
  for await (const event of agent.translate(failing(), 2)) failed.push(event)
  assert.deepEqual(failed.map(event => event.type), ['turn/start', 'error', 'turn/end'])
  assert.equal(failed[1].data.message, 'boom')
  assert.equal(failed[2].data.status, 'error')

  // 中断（AbortError）はエラーを出さず turn/end(aborted) で静かに閉じる
  async function* aborting(): AsyncIterable<any> {
    const error = new Error('This operation was aborted')
    error.name = 'AbortError'
    throw error
  }
  const stopped: any[] = []
  for await (const event of agent.translate(aborting(), 3)) stopped.push(event)
  assert.deepEqual(stopped.map(event => event.type), ['turn/start', 'turn/end'])
  assert.equal(stopped[1].data.status, 'aborted')

  // スキルとプロンプトの組み立て: ツール一覧（説明付き）と <skill_content>・ツール優先ルールが注入される
  const { loadLegalSkills } = await import('../src/agents/skills.js')
  const { buildLegalSystemPrompt } = await import('../src/agents/prompts.js')
  const skills = loadLegalSkills()
  assert.ok(skills.some(skill => skill.name === 'legal-advisor'))
  const prompt = buildLegalSystemPrompt({
    tools: [{ name: 'legal-mcp_search_laws', description: '日本の法令を検索するツール' }],
    skills,
  })
  assert.ok(prompt.includes('legal-mcp_search_laws'))
  assert.ok(prompt.includes('日本の法令を検索するツール'))
  assert.ok(prompt.includes('Verify-First'))
  assert.ok(prompt.includes('<skill_content name="legal-advisor"'))
}

checkAgentTranslation().then(() => {
  console.log('agent trace ok')
}).catch(error => {
  console.error(error)
  process.exit(1)
})
