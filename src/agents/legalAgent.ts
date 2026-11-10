import {
    createAgent,
    initChatModel,
    modelRetryMiddleware,
    summarizationMiddleware,
    toolCallLimitMiddleware,
} from "langchain";
import { HumanMessage } from "@langchain/core/messages";
import { config } from '../config/environment.js';
import { Logger } from '../utils/logger.js';
import { ModelConfig } from '../models/modelManager.js';
import { PostgresMemoryManager } from '../memory/postgresMemoryManager.js';
import { initializeMCPServers, getMCPTools } from '../mcp/mcpInitializer.js';
import { buildLegalSystemPrompt } from './prompts.js';
import { loadLegalSkills } from './skills.js';
import { createReadUploadedFileTool } from './attachmentTool.js';
import {
    maxTokensClampMiddleware,
    repeatToolGuardMiddleware,
    runtimeContextMiddleware,
    toolTimeoutMiddleware,
} from './hooks.js';
import type { AgentEvent, StepStatus, TokenUsage } from '../types/agentEvents.js';

/**
 * 1回の実行で許可するツール呼び出し回数。
 * 暴走して同じ検索を繰り返すのを防ぐ（超過分はモデルにエラーとして返し、回答を促す）。
 */
const TOOL_CALL_LIMIT_PER_RUN = 10;

/**
 * ツール結果をイベントログ / 画面に載せる際の上限。
 * モデルに渡す内容は切り詰めない（表示と永続化だけの制限）。
 * ponytail: 8k 文字の素朴な切り詰め。全文が必要になったら spill 参照に置き換える。
 */
const TOOL_RESULT_MAX_CHARS = 8000;

/**
 * 継続生成（interrupt 後の「続きを生成」）でモデルに渡す再開指示。
 * ターン境界のユーザー発話としては保存しない。
 */
const CONTINUATION_PROMPT = '前回の回答が途中で中断されました。直前の文脈に続けて、自然な形で回答の続きを書いてください。';

interface AgentRunOptions {
    /** セッション内で単調増加するターン番号（1 始まり） */
    turn?: number;
    /** クライアント切断時に生成を打ち切るためのシグナル */
    signal?: AbortSignal;
}

export class LegalAgent {
    private agent: any = null;
    private initPromise: Promise<void> | null = null;
    private modelConfig: ModelConfig;

    constructor(modelConfig?: ModelConfig) {
        this.modelConfig = modelConfig || {
            name: config.llm.modelName,
            displayName: `${config.llm.modelProvider.toUpperCase()} - ${config.llm.modelName}`,
            provider: config.llm.modelProvider as 'ollama' | 'openai' | 'anthropic',
            baseUrl: config.llm.useFreeModel ? config.llm.freeModelBaseUrl : config.llm.baseUrl,
            apiKey: config.llm.apiKey || undefined,
            maxTokens: config.llm.maxTokens,
            temperature: config.llm.temperature,
            description: 'Default model configuration',
            isEnabled: true
        };
    }

    /**
     * 初回呼び出し時に一度だけ初期化する。
     * 並行呼び出しでも初期化処理は1回に集約され、失敗時は次回リトライできる。
     */
    async ensureReady(): Promise<void> {
        if (this.agent) return;
        if (!this.initPromise) {
            this.initPromise = this.initializeAgent().catch(error => {
                this.initPromise = null;
                throw error;
            });
        }
        await this.initPromise;
    }

    private async initializeAgent(): Promise<void> {
        const initStartedAt = Date.now();
        Logger.info('Initializing LLM...', {
            model: this.modelConfig.name,
            provider: this.modelConfig.provider,
            baseUrl: this.modelConfig.baseUrl ? '********' + this.modelConfig.baseUrl.slice(-4) : '未設定'
        });

        if (this.modelConfig.provider === 'ollama') {
            process.env.OLLAMA_BASE_URL = this.modelConfig.baseUrl.replace('/v1', '');
        }

        // LLM クライアント・MCP ツール・Postgres チェックポインターを並列に初期化する
        const [llm, mcpTools, checkpointer] = await Promise.all([
            initChatModel(
                this.modelConfig.name,
                {
                    modelProvider: this.modelConfig.provider as any,
                    temperature: this.modelConfig.temperature,
                    configuration: {
                        baseURL: this.modelConfig.baseUrl,
                        apiKey: this.modelConfig.apiKey,
                    },
                    maxTokens: this.modelConfig.maxTokens,
                }
            ),
            initializeMCPServers().then(() => getMCPTools()),
            PostgresMemoryManager.getInstance().getCheckpointer(),
        ]);

        if (mcpTools.length === 0) {
            Logger.warn('No MCP tools available. Agent will run without external tools.');
        }

        const tools = [...mcpTools, createReadUploadedFileTool()];

        this.agent = createAgent({
            model: llm,
            tools,
            systemPrompt: buildLegalSystemPrompt({
                tools: tools.map(t => ({ name: t.name, description: t.description })),
                skills: loadLegalSkills(),
            }),
            checkpointer,
            middleware: [
                // 実行時コンテキスト（日付・初回ステップのツール確認リマインダー）を末尾ユーザーメッセージに注入（システムプロンプトキャッシュを維持）
                runtimeContextMiddleware({ toolNames: tools.map(t => t.name) }),
                // 一時的な API エラーへの耐性
                modelRetryMiddleware({ maxRetries: 2 }),
                // モデル別の max_tokens 上限超過時に自動クランプして即座に再試行
                maxTokensClampMiddleware(),
                // 協調的なツールタイムアウト（deepseek-harness timeout-policy 相当）
                toolTimeoutMiddleware({ timeoutMs: 30_000 }),
                // 同一ツールの連続呼び出しを検出し助言を添える（deepseek-harness repeat-tool-reminder 相当）
                repeatToolGuardMiddleware({ thresholds: [2, 3] }),
                // ツール呼び出しの暴走を防止
                toolCallLimitMiddleware({
                    runLimit: TOOL_CALL_LIMIT_PER_RUN,
                    exitBehavior: 'continue',
                }),
                // 長い会話でもコンテキストを溢れさせない（旧 MessageTrimmer の置き換え）
                summarizationMiddleware({
                    model: llm,
                    trigger: [{ tokens: 12000 }, { messages: 30 }],
                    keep: { messages: 20 },
                }),
            ],
        });

        Logger.info(`Legal Agent initialized successfully with model: ${this.modelConfig.name}`, {
            toolCount: tools.length,
            tools: tools.map(t => t.name),
            initMs: Date.now() - initStartedAt,
        });
    }

    /**
     * クエリを処理して最終回答テキストのみを返す。
     * ツール出力（ToolMessage）は回答に混入させない。
     */
    async processQuery(query: string, sessionId?: string): Promise<string> {
        const stream = await this.getStream(query, sessionId);
        let answer = '';
        let sawDelta = false;
        for await (const event of stream) {
            if (event.type === 'assistant/delta') {
                answer += event.data.text;
                sawDelta = true;
            } else if (event.type === 'assistant/message' && !sawDelta) {
                // ストリーミング未対応のプロバイダ向けフォールバック
                answer += event.data.text;
            }
        }
        return answer;
    }

    /**
     * turn / step / tool の構造化イベントを返す。
     * 1 ターン = 0 以上のステップ、1 ステップ = 1 回のモデル要求 + そのツール実行。
     */
    async getStream(
        query: string | null,
        sessionId?: string,
        options: AgentRunOptions = {}
    ): Promise<AsyncIterable<AgentEvent>> {
        await this.ensureReady();

        const threadId = sessionId || this.generateDefaultSessionId();
        const turn = options.turn ?? 1;
        const content = query ?? CONTINUATION_PROMPT;
        Logger.info('Processing legal query stream', {
            query: query === null ? '(continuation)' : query.substring(0, 100) + '...',
            sessionId: threadId,
            turn,
        });

        // messages: トークン差分、updates: ノード完了時の確定メッセージ（step 境界の根拠）
        const stream = await this.agent.stream(
            { messages: [new HumanMessage({ content })] },
            {
                configurable: { thread_id: threadId },
                streamMode: ["messages", "updates"],
                ...(options.signal ? { signal: options.signal } : {}),
            }
        );

        return this.translate(stream, turn);
    }

    /**
     * LangGraph の生ストリームを SessionEvent に変換する。
     * 差分は live イベント、確定した事実だけを durable イベントとして発行する。
     */
    private async *translate(stream: AsyncIterable<any>, turn: number): AsyncGenerator<AgentEvent> {
        const turnStartedAt = Date.now();
        let step = 0;
        let stepOpen = false;
        let stepStartedAt = turnStartedAt;
        let stepText = '';
        let stepReasoning = '';
        let stepUsage: TokenUsage | undefined;
        let toolCallCount = 0;

        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let totalTokens = 0;
        let hasUsage = false;

        const callInfo = new Map<string, { name: string; startedAt: number }>();

        const mergeUsage = (usage: TokenUsage | undefined) => {
            if (!usage) return;
            hasUsage = true;
            totalInputTokens += usage.inputTokens;
            totalOutputTokens += usage.outputTokens;
            totalTokens += usage.totalTokens;
            stepUsage = usage;
        };

        const currentTurnUsage = (): TokenUsage | undefined =>
            hasUsage
                ? {
                    inputTokens: totalInputTokens,
                    outputTokens: totalOutputTokens,
                    totalTokens,
                }
                : undefined;

        const closeStep = (status: StepStatus = 'completed'): AgentEvent => {
            stepOpen = false;
            const durationMs = Math.max(0, Date.now() - stepStartedAt);
            const usage = stepUsage;
            stepUsage = undefined;
            return {
                type: 'step/end',
                data: {
                    turn,
                    step,
                    status,
                    durationMs,
                    ...(usage ? { usage } : {}),
                },
            };
        };

        const ensureStep = (): AgentEvent | null => {
            if (stepOpen) return null;
            step += 1;
            stepOpen = true;
            stepStartedAt = Date.now();
            stepText = '';
            stepReasoning = '';
            stepUsage = undefined;
            return { type: 'step/start', data: { turn, step } };
        };

        const buildTurnEnd = (status: 'completed' | 'aborted' | 'error'): AgentEvent => {
            const usage = currentTurnUsage();
            return {
                type: 'turn/end',
                data: {
                    turn,
                    status,
                    durationMs: Math.max(0, Date.now() - turnStartedAt),
                    stepCount: step,
                    toolCallCount,
                    ...(usage ? { usage } : {}),
                },
            };
        };

        yield { type: 'turn/start', data: { turn } };

        try {
            for await (const raw of stream) {
                const [mode, payload] = this.unwrapStreamItem(raw);

                if (mode === 'messages') {
                    const [message, metadata] = payload as [any, Record<string, any>];
                    const node = metadata?.langgraph_node;
                    // モデル以外（要約ミドルウェア等）の出力はターン表示に混ぜない
                    if (node && node !== 'model_request') continue;

                    const delta = this.extractContent(message);
                    const startEvent = ensureStep();
                    if (startEvent) yield startEvent;

                    if (delta.reasoning) {
                        stepReasoning += delta.reasoning;
                        yield {
                            type: 'assistant/reasoning-delta',
                            data: { turn, step, text: delta.reasoning },
                        };
                    }
                    if (delta.text) {
                        stepText += delta.text;
                        yield { type: 'assistant/delta', data: { turn, step, text: delta.text } };
                    }
                    continue;
                }

                if (mode !== 'updates') continue;

                for (const [node, update] of Object.entries(payload as Record<string, any>)) {
                    const messages: any[] = update?.messages ?? [];

                    if (node === 'model_request') {
                        for (const message of messages) {
                            if (this.messageRole(message) !== 'ai') continue;

                            const startEvent = ensureStep();
                            if (startEvent) yield startEvent;

                            mergeUsage(this.extractUsage(message));

                            const content = this.extractContent(message);
                            const text = content.text || stepText;
                            const reasoning = content.reasoning || stepReasoning;

                            if (text || reasoning) {
                                stepText = text;
                                stepReasoning = reasoning;
                                yield {
                                    type: 'assistant/message',
                                    data: {
                                        turn,
                                        step,
                                        text,
                                        ...(reasoning ? { reasoning } : {}),
                                    },
                                };
                            }

                            for (const call of message.tool_calls ?? []) {
                                toolCallCount += 1;
                                callInfo.set(call.id, { name: call.name, startedAt: Date.now() });
                                yield {
                                    type: 'tool/call',
                                    data: {
                                        turn,
                                        step,
                                        callId: call.id,
                                        name: call.name,
                                        args: call.args,
                                    },
                                };
                            }
                        }
                        continue;
                    }

                    if (node === 'tools') {
                        let hasResult = false;
                        for (const message of messages) {
                            if (this.messageRole(message) !== 'tool') continue;
                            hasResult = true;

                            const callId = message.tool_call_id ?? '';
                            const info = callInfo.get(callId);
                            const content = this.normalizeContent(message.content);
                            const isError = message.status === 'error';
                            const durationMs = info ? Date.now() - info.startedAt : undefined;

                            yield {
                                type: 'tool/result',
                                data: {
                                    turn,
                                    step,
                                    callId,
                                    name: message.name ?? info?.name,
                                    content: this.truncate(content),
                                    isError,
                                    ...(durationMs === undefined ? {} : { durationMs }),
                                },
                            };
                        }

                        if (hasResult && stepOpen) yield closeStep('completed');
                    }
                }
            }
        } catch (error) {
            // 中断は異常ではないので、エラーバナーではなく aborted として静かに閉じる（deepseek-harness 準拠）
            const aborted = (error as any)?.name === 'AbortError';
            const message = aborted ? '応答を停止しました。' : (error as Error).message;
            if (aborted) {
                Logger.info('エージェントストリームが中断されました', { turn });
                if (stepOpen) yield closeStep('aborted');
                yield buildTurnEnd('aborted');
                return;
            }
            Logger.error('エージェントストリーム処理失敗', { error: message, aborted });
            yield { type: 'error', data: { turn, message } };
            if (stepOpen) yield closeStep('error');
            yield buildTurnEnd('error');
            return;
        }

        if (stepOpen) yield closeStep('completed');
        yield buildTurnEnd('completed');
    }

    /** LangChain の AI メッセージからトークン使用量を抽出する */
    private extractUsage(message: any): TokenUsage | undefined {
        const meta = message?.usage_metadata ?? message?.response_metadata?.tokenUsage;
        if (!meta || typeof meta !== 'object') return undefined;
        const inputTokens = Number(meta.input_tokens ?? meta.promptTokens ?? 0);
        const outputTokens = Number(meta.output_tokens ?? meta.completionTokens ?? 0);
        const totalTokens = Number(meta.total_tokens ?? meta.totalTokens ?? inputTokens + outputTokens);
        if (!Number.isFinite(totalTokens) || totalTokens <= 0) return undefined;
        return {
            inputTokens: Number.isFinite(inputTokens) ? inputTokens : 0,
            outputTokens: Number.isFinite(outputTokens) ? outputTokens : 0,
            totalTokens,
        };
    }

    /** マルチ streamMode の [mode, payload] と単一モードの [message, metadata] を正規化する */
    private unwrapStreamItem(raw: any): [string, any] {
        if (Array.isArray(raw) && typeof raw[0] === 'string') {
            return [raw[0], raw[1]];
        }
        return ['messages', raw];
    }

    private messageRole(message: any): string {
        return typeof message?._getType === 'function' ? message._getType() : message?.role ?? '';
    }

    /** モデル出力から本文と推論（reasoning）を抽出する */
    private extractContent(message: any): { text: string; reasoning: string } {
        let text = '';
        let reasoning = '';

        const content = message?.content;
        if (typeof content === 'string') {
            text += content;
        } else if (Array.isArray(content)) {
            for (const block of content) {
                if (typeof block === 'string') {
                    text += block;
                } else if (block?.type === 'text' && typeof block.text === 'string') {
                    text += block.text;
                } else if (block?.type === 'reasoning') {
                    reasoning += typeof block.reasoning === 'string' ? block.reasoning : block.text ?? '';
                }
            }
        }

        // DeepSeek / OpenAI 互換 API は reasoning_content を additional_kwargs に載せる
        const extraReasoning = message?.additional_kwargs?.reasoning_content;
        if (!reasoning && typeof extraReasoning === 'string') {
            reasoning = extraReasoning;
        }

        return { text, reasoning };
    }

    private normalizeContent(content: any): string {
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) {
            return content
                .map(block => {
                    if (typeof block === 'string') return block;
                    if (block?.type === 'text' && typeof block.text === 'string') return block.text;
                    return JSON.stringify(block);
                })
                .join('\n');
        }
        return content == null ? '' : JSON.stringify(content);
    }

    private truncate(value: string): string {
        return value.length <= TOOL_RESULT_MAX_CHARS
            ? value
            : `${value.slice(0, TOOL_RESULT_MAX_CHARS)}\n…（${value.length - TOOL_RESULT_MAX_CHARS} 文字を省略）`;
    }

    isReady(): boolean {
        return this.agent !== null;
    }

    getModelConfig(): ModelConfig {
        return this.modelConfig;
    }

    getModelName(): string {
        return this.modelConfig.name;
    }

    private generateDefaultSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    }
}
