import { initChatModel } from "langchain";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { config } from '../config/environment.js';
import { Logger } from '../utils/logger.js';
import { ModelConfig } from '../models/modelManager.js';
import { MemorySaverManager } from '../memory/memorySaverManager.js';
import { PostgresMemoryManager } from '../memory/postgresMemoryManager.js';
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { BaseCheckpointSaver } from "@langchain/langgraph";
import { initializeMCPServers, getMCPTools } from '../mcp/mcpInitializer.js';

export class LegalAgent {
    private agent: any;
    private checkpointer!: BaseCheckpointSaver;
    private isInitialized: boolean = false;
    private modelConfig: ModelConfig;
    private sessionMemory: MemorySaverManager;
    private readonly maxContextMessages: number = 10; // 最大コンテキストメッセージ数

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
            baseUrl: config.llm.useFreeModel ? config.llm.freeModelBaseUrl : config.llm.baseUrl,
            apiKey: config.llm.apiKey || undefined,
            maxTokens: config.llm.maxTokens,
            temperature: config.llm.temperature,
            description: 'Default model configuration',
            isEnabled: true
        };

        // セッションメモリの初期化
        this.sessionMemory = MemorySaverManager.getInstance();

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
                // Mask baseUrl for security
                baseUrl: this.modelConfig.baseUrl ? '********' + this.modelConfig.baseUrl.slice(-4) : '未設定'
            });
    
            // プロバイダータイプに応じて適切な環境変数を設定
            if (this.modelConfig.provider === 'ollama') {
                process.env.OLLAMA_BASE_URL = this.modelConfig.baseUrl.replace('/v1', '');
                // Mask OLLAMA_BASE_URL for logging
                Logger.debug('Set OLLAMA_BASE_URL', { 
                    url: process.env.OLLAMA_BASE_URL ? '********' + process.env.OLLAMA_BASE_URL.slice(-4) : '未設定' 
                });
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
    
            Logger.info('LLM initialized successfully, connecting to MCP servers...');
    
            // Initialize MCP servers with resilient error handling
            // If some servers fail, we'll still use the ones that succeeded
            try {
                Logger.info('Starting MCP server initialization...');
                await initializeMCPServers();
                Logger.info('MCP servers initialization completed (some may have failed)');
            } catch (mcpError) {
                // This shouldn't happen anymore since we catch errors per-server,
                // but keep it as a safety net
                Logger.error('Unexpected error during MCP server initialization', {
                    error: (mcpError as Error).message,
                    stack: (mcpError as Error).stack
                });
            }
            
            // Get MCP tools as LangChain tools (will only include tools from successful servers)
            Logger.info('Retrieving MCP tools from available servers...');
            const mcpTools = await getMCPTools();
            
            if (mcpTools.length === 0) {
                Logger.warn('No MCP tools available. Agent will run without external tools.');
            } else {
                Logger.info('MCP tools loaded successfully', {
                    toolCount: mcpTools.length,
                    tools: mcpTools.map(t => t.name)
                });
            }
    
            // Create PostgresSaver for persistence
            Logger.debug('Initializing Postgres checkpointer...');
            const postgresMemory = PostgresMemoryManager.getInstance();
            this.checkpointer = await postgresMemory.getCheckpointer();
    
            // Create the agent using createReactAgent with MCP tools
            Logger.debug('Creating React Agent with MCP tools...');
            this.agent = createReactAgent({
                llm: llm,
                tools: mcpTools,
                checkpointSaver: this.checkpointer,
                messageModifier: this.systemPrompt
            });
    
            this.isInitialized = true;
            Logger.info(`Legal Agent initialized successfully with model: ${this.modelConfig.name}`);
    
        } catch (error) {
            Logger.error('Failed to initialize Legal Agent', {
                error: (error as Error).message,
                stack: (error as Error).stack
            });
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
                        
                    if (messageChunk) {
                        const messageType = messageChunk._getType ? messageChunk._getType() : 'ai';
                        
                        // Check for tool calls in AIMessage
                        if (messageType === 'ai' && messageChunk.tool_calls && messageChunk.tool_calls.length > 0) {
                            for (const toolCall of messageChunk.tool_calls) {
                                yield {
                                    type: 'tool_start',
                                    tool: toolCall.name,
                                    args: toolCall.args,
                                    messageType: 'tool_call'
                                };
                            }
                        }

                        if (typeof messageChunk.content === 'string' && messageChunk.content.length > 0) {
                            const isToolMessage = messageType === 'tool' || messageType === 'ToolMessage';
                            
                            yield {
                                type: isToolMessage ? 'tool' : 'llm',
                                content: messageChunk.content,
                                messageType: messageType,
                                toolName: isToolMessage ? messageChunk.name : undefined
                            };
                        }
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
}