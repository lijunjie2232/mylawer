import { initChatModel } from "langchain";
import { tool } from "@langchain/core/tools";
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { DeepSearchTool } from '../tools/deepSearchTool.js';
import { config } from '../config/environment.js';
import { Logger } from '../utils/logger.js';
import { z } from "zod";
import { ModelConfig } from '../models/modelManager.js';
import { MemorySaverManager } from '../memory/memorySaverManager.js';
import { EGovLawSearchTool } from '../tools/egovLawSearchTool.js';
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";

export class LegalAgent {
    private agent: any;
    private memorySaver!: MemorySaver;
    private isInitialized: boolean = false;
    private modelConfig: ModelConfig;
    private sessionMemory: MemorySaverManager;
    private readonly maxContextMessages: number = 10; // 最大コンテキストメッセージ数
    private deepSearchTool: DeepSearchTool;
    private egovLawSearchTool: EGovLawSearchTool;

    private readonly systemPrompt = `
あなたは日本の法律に特化した役立つ弁護士アシスタントです。
すべての回答は真実でなければならず、回答を作成してはいけません。
質問に正確に答えるため、知識がない場合は、ツールを使用して関連する回答を検索してください。
必要に応じて、指定されたURLからウェブページを読み込んで情報を取得できます。
`;

    constructor(modelConfig?: ModelConfig) {
        // カスタムモデル設定が提供された場合はそれを使用し、そうでない場合はデフォルト設定を使用
        this.modelConfig = modelConfig || {
            name: config.llm.modelName,
            displayName: `${config.llm.modelProvider.toUpperCase()} - ${config.llm.modelName}`,
            provider: config.llm.modelProvider as 'ollama' | 'openai' | 'anthropic',
            baseUrl: config.llm.baseUrl,
            apiKey: config.llm.apiKey || undefined,
            maxTokens: config.llm.maxTokens,
            temperature: config.llm.temperature,
            description: 'Default model configuration',
            isEnabled: true
        };

        // セッションメモリの初期化
        this.sessionMemory = MemorySaverManager.getInstance();
        
        // ツールの初期化
        this.deepSearchTool = new DeepSearchTool({
            searchEngine: 'web',
            webSearchConfig: {
                maxResults: 3,
                headless: false,
                searchEngine: 'yahoo',
                language: 'ja-JP'
            },
            webpageLoaderConfig: {
                usePlaywright: true,
                headless: false,
                language: 'ja-JP',
                timeout: 30000
            }
        });
        
        this.egovLawSearchTool = new EGovLawSearchTool({
            maxResults: 5,
            language: 'ja'
        });

        this.initializeAgent().catch(error => {
            Logger.error('Agent initialization failed', { error: error.message });
        });
    }

    /**
     * Agent を初期化
     */
    private async initializeAgent(): Promise<void> {
        try {
            Logger.info('Initializing LLM...', {
                model: this.modelConfig.name,
                provider: this.modelConfig.provider,
                baseUrl: this.modelConfig.baseUrl
            });
    
            // プロバイダータイプに応じて適切な環境変数を設定
            if (this.modelConfig.provider === 'ollama') {
                process.env.OLLAMA_BASE_URL = this.modelConfig.baseUrl.replace('/v1', '');
            }
    
            const llm = await initChatModel(
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
            );
    
            Logger.info('LLM initialized, creating agent with tools...');
    
            // 定义深度搜索工具
            const deepSearch = tool(
                async (input: { query: string }): Promise<string> => {
                    return await this.deepSearchTool.deepSearch(input.query);
                },
                {
                    name: "deep_search",
                    description: "web 検索の上位の結果を取得し、自動的にウェブページを読み込んでコンテンツを返します。失敗したページがあっても、成功したドキュメントを返します。",
                    schema: z.object({
                        query: z.string().describe("検索クエリやキーワード")
                    }),
                }
            );
    
            // e-gov 法令検索ツールを定義
            const egovLawSearch = tool(
                async (input: { keyword: string }): Promise<string> => {
                    return await this.egovLawSearchTool.search(input.keyword);
                },
                {
                    name: "egov_law_search",
                    description: "日本の e-gov 法令検索 API から法令情報を検索します。キーワードから関連する法律条文を検索できます。",
                    schema: z.object({
                        keyword: z.string().describe("検索したい法令キーワード（例：窃盗、致死など，罪、法など文字を脱いで。）")
                    }),
                }
            );
    
            // Create MemorySaver for persistence
            this.memorySaver = new MemorySaver();
    
            // Create the agent using createReactAgent (prebuilt ReAct agent)
            this.agent = createReactAgent({
                llm: llm,
                tools: [deepSearch, egovLawSearch],
                checkpointSaver: this.memorySaver,
                messageModifier: this.systemPrompt
            });
    
            // ツール呼び出しを監視するためのラッパーを作成
            this.wrapToolsWithLogging([deepSearch, egovLawSearch]);
    
            this.isInitialized = true;
            Logger.info(`Legal Agent initialized successfully with model: ${this.modelConfig.name}`);
    
        } catch (error) {
            Logger.error('Failed to initialize Legal Agent', { error: (error as Error).message });
            throw error;
        }
    }
    


    /**
     * 複雑なクエリの処理（セッションメモリ対応）
     */
    async processQuery(query: string, sessionId?: string): Promise<string> {
        if (!this.isInitialized) {
            await this.initializeAgent();
        }
    
        try {
            // デフォルトセッション ID を生成（未提供の場合）
            const effectiveSessionId = sessionId || this.generateDefaultSessionId();
    
            Logger.info('Processing legal query with session', {
                query: query.substring(0, 100) + '...',
                sessionId: effectiveSessionId
            });
    
            // Use the agent to stream - it will handle tool execution automatically
            const stream = await this.agent.stream(
                { messages: [new HumanMessage({ content: query })] },
                { 
                    configurable: { thread_id: effectiveSessionId },
                    streamMode: "messages"
                }
            );
    
            let fullResponse = '';
            let aiMessage: AIMessage | null = null;
    
            // Collect streaming output
            // When using streamMode: "messages", chunks are tuples [messageChunk, metadata]
            for await (const chunk of stream) {
                // Handle both array format [message, metadata] and direct message format
                const messageChunk = Array.isArray(chunk) ? chunk[0] : chunk;
                    
                if (messageChunk && typeof messageChunk.content === 'string') {
                    const content = messageChunk.content;
                    fullResponse += content;
                    aiMessage = messageChunk as AIMessage;
                }
            }
    
            Logger.info('クエリが正常に処理されました', {
                responseLength: fullResponse.length,
                sessionId: effectiveSessionId
            });
            return fullResponse;
    
        } catch (error) {
            Logger.error('クエリ処理中にエラーが発生しました', { error: (error as Error).message, query });
            throw new Error(`クエリ処理に失敗しました：${(error as Error).message}`);
        }
    }

    /**
     * ストリーミングレスポンスの取得（リアルタイム表示用、セッションメモリ対応）
     */
    async getStream(query: string, sessionId?: string): Promise<AsyncIterable<any>> {
        if (!this.isInitialized) {
            await this.initializeAgent();
        }
    
        try {
            // デフォルトセッション ID を生成（未提供の場合）
            const effectiveSessionId = sessionId || this.generateDefaultSessionId();
    
            Logger.info('Processing legal query stream with session', {
                query: query.substring(0, 100) + '...',
                sessionId: effectiveSessionId
            });
    
            // Use the agent to stream - it will handle tool execution automatically
            const stream = await this.agent.stream(
                { messages: [new HumanMessage({ content: query })] },
                {
                    configurable: { thread_id: effectiveSessionId },
                    streamMode: "messages"
                }
            );
    
            // Create an async generator that yields message objects with type info
            async function* generateChunks() {
                for await (const chunk of stream) {
                    // When using streamMode: "messages", chunks are tuples [messageChunk, metadata]
                    // Extract the message chunk from the tuple
                    const messageChunk = Array.isArray(chunk) ? chunk[0] : chunk;
                        
                    if (messageChunk && typeof messageChunk.content === 'string') {
                        // Check if this is a tool message or AI message
                        const messageType = messageChunk._getType ? messageChunk._getType() : 'ai';
                        const isToolMessage = messageType === 'tool' || messageType === 'ToolMessage';
                        
                        yield {
                            type: isToolMessage ? 'tool' : 'llm',
                            content: messageChunk.content,
                            messageType: messageType
                        };
                    }
                }
            }
    
            // Return the generator that yields message objects with type info
            return generateChunks();
    
        } catch (error) {
            Logger.error('Error processing stream query', { error: (error as Error).message, query });
            throw new Error(`ストリーム処理に失敗しました：${(error as Error).message}`);
        }
    }

    /**
     * エージェントが準備完了かどうかを確認
     */
    isReady(): boolean {
        return this.isInitialized;
    }

    /**
     * 現在使用中的モデル構成を取得
     */
    getModelConfig(): ModelConfig {
        return this.modelConfig;
    }
    
    /**
     * モデル名を取得
     */
    getModelName(): string {
        return this.modelConfig.name;
    }
    
    /**
     * 既定の会话 ID を生成
     */
    private generateDefaultSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 会话統計情報を取得
     */
    getSessionStats() {
        return this.sessionMemory.getSessionStats();
    }

    /**
     * 会话をクリア
     */
    clearSession(sessionId: string): void {
        this.sessionMemory.clearSession(sessionId);
    }

    /**
     * 会话コンテキストを取得
     */
    getSessionContext(sessionId: string): Record<string, any> {
        return this.sessionMemory.getContext(sessionId);
    }

    /**
     * 会话コンテキストを更新
     */
    updateSessionContext(sessionId: string, context: Record<string, any>): void {
        this.sessionMemory.updateContext(sessionId, context);
    }

    /**
     * ツールにログ機能を追加して監視
     */
    private wrapToolsWithLogging(tools: any[]): void {
        tools.forEach(tool => {
            const originalFunc = tool.func;
            if (typeof originalFunc === 'function') {
                tool.func = async (...args: any[]) => {
                    const startTime = Date.now();
                    const toolName = tool.name || 'unknown';
                    const inputPreview = JSON.stringify(args[0]).substring(0, 200);

                    Logger.info('[TOOL CALL] ツール呼び出し開始', {
                        toolName,
                        input: inputPreview,
                        timestamp: new Date().toISOString()
                    });

                    try {
                        const result = await originalFunc.apply(tool, args);
                        const duration = Date.now() - startTime;
                        const resultPreview = typeof result === 'string'
                            ? result.substring(0, 300)
                            : JSON.stringify(result).substring(0, 300);

                        Logger.info('[TOOL RESULT] ツール呼び出し完了', {
                            toolName,
                            duration: `${duration}ms`,
                            resultLength: result?.length || 0,
                            resultPreview: resultPreview + '...'
                        });

                        return result;
                    } catch (error) {
                        const duration = Date.now() - startTime;
                        Logger.error('[TOOL ERROR] ツール呼び出しエラー', {
                            toolName,
                            duration: `${duration}ms`,
                            error: (error as Error).message,
                            stack: (error as Error).stack
                        });
                        throw error;
                    }
                };
            }
        });
    }
}