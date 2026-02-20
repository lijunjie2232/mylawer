import { initChatModel } from "langchain";
import { createAgent } from "langchain";
import { tool } from "@langchain/core/tools";
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { TavilySearchTool } from '../tools/tavilySearchTool';
import { WebpageLoaderTool } from '../tools/webpageLoaderTool';
import { DeepSearchTool } from '../tools/deepSearchTool';
import { config } from '../config/environment';
import { Logger } from '../utils/logger';
import { z } from "zod";
import { ModelConfig } from '../models/modelManager';
import { MemorySaverManager } from '../memory/memorySaverManager';

export class LegalAgent {
    private agent: any;
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
//     private readonly systemPrompt = `
// あなたは日本の法律に特化した役立つ弁護士アシスタントです。
// すべての回答は真実でなければならず、回答を作成してはいけません。
// `;

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
        
        // 初始化会话内存管理器
        this.sessionMemory = MemorySaverManager.getInstance();
        
        this.initializeAgent().catch(error => {
            Logger.error('Agent initialization failed', { error: error.message });
        });
    }

    /**
     * Agentを初期化
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
                    baseURL: this.modelConfig.baseUrl,
                    apiKey: this.modelConfig.apiKey,
                    maxTokens: this.modelConfig.maxTokens,
                    temperature: this.modelConfig.temperature,
                }
            );

            Logger.info('LLM initialized, creating agent...');

            // ツールインスタンスを作成
            //   const bingSearchTool = new BingSearchTool({ maxResults: 3 });
            //   const webpageLoaderTool = new WebpageLoaderTool();
            const deepSearchTool = new DeepSearchTool({ maxResults: 3 }); // デフォルトの maxResults を設定

            //   // Bing検索ツールを定義
            //   const bingSearch = tool(
            //     async (input: { query: string }): Promise<string> => {
            //       return await bingSearchTool.search(input.query);
            //     },
            //     {
            //       name: "bing_search",
            //       description: "指定されたクエリでBingを検索して結果を返します。",
            //       schema: z.object({
            //         query: z.string().describe("検索クエリやキーワード")
            //       }),
            //     }
            //   );

            //   // 定义网页加载工具
            //   const webpageLoader = tool(
            //     async (input: { url: string }): Promise<string> => {
            //       return await webpageLoaderTool.loadWebpage(input.url);
            //     },
            //     {
            //       name: "webpage_loader",
            //       description: "Bing検索からもらったURLを指定し、ウェブページの内容を返します。",
            //       schema: z.object({
            //         url: z.string().describe("ウェブページのURL")
            //       }),
            //     }
            //   );

            // 定义深度搜索工具
            const deepSearch = tool(
                async (input: { query: string }): Promise<string> => {
                    return await deepSearchTool.deepSearch(input.query);
                },
                {
                    name: "deep_search",
                    description: "Tavily検索の上位の結果を取得し、自動的にウェブページを読み込んでコンテンツを返します。失敗したページがあっても、成功したドキュメントを返します。",
                    schema: z.object({
                        query: z.string().describe("検索クエリやキーワード")
                    }),
                }
            );

            // 创建Agent
            this.agent = createAgent({
                model: llm,
                // tools: [bingSearch, webpageLoader, deepSearch],
                // tools: [deepSearch],
                systemPrompt: this.systemPrompt,
            });

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
            // デフォルトセッションIDを生成（未提供の場合）
            const effectiveSessionId = sessionId || this.generateDefaultSessionId();
            
            Logger.info('Processing legal query with session', { 
                query: query.substring(0, 100) + '...',
                sessionId: effectiveSessionId
            });

            // セッション履歴メッセージを取得
            const sessionMessages = this.sessionMemory.getMessages(effectiveSessionId);
            
            // コンテキストサイズを維持するためにメッセージをトリム
            const trimmedMessages = this.trimMessages([...sessionMessages]);
            
            // 新しいユーザーメッセージを追加
            const newUserMessage = new HumanMessage({ content: query });
            const allMessages = [...trimmedMessages, newUserMessage];
            
            // ストリーミング出力を使用
            const stream = await this.agent.stream({
                messages: allMessages,
            }, {
                streamMode: "messages"
            });

            let fullResponse = '';
            let aiMessage: AIMessage | null = null;

            // ストリーミング出力をリアルタイムで収集
            for await (const chunk of stream) {
                if (Array.isArray(chunk) && chunk.length > 0) {
                    const [message, metadata] = chunk;
                    if (message && typeof message.content === 'string') {
                        fullResponse += message.content;
                        aiMessage = message as AIMessage;
                    }
                }
            }

            // メッセージをセッションメモリに保存
            this.sessionMemory.addMessage(effectiveSessionId, newUserMessage);
            if (aiMessage) {
                this.sessionMemory.addMessage(effectiveSessionId, aiMessage);
            }

            Logger.info('クエリが正常に処理されました', { 
                responseLength: fullResponse.length,
                sessionId: effectiveSessionId,
                messageCount: this.sessionMemory.getMessages(effectiveSessionId).length
            });
            return fullResponse;

        } catch (error) {
            Logger.error('クエリ処理中にエラーが発生しました', { error: (error as Error).message, query });
            throw new Error(`クエリ処理に失敗しました: ${(error as Error).message}`);
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
            // デフォルトセッションIDを生成（未提供の場合）
            const effectiveSessionId = sessionId || this.generateDefaultSessionId();
            
            Logger.info('Processing legal query stream with session', { 
                query: query.substring(0, 100) + '...',
                sessionId: effectiveSessionId
            });

            // セッション履歴メッセージを取得
            const sessionMessages = this.sessionMemory.getMessages(effectiveSessionId);
            
            // コンテキストサイズを維持するためにメッセージをトリム
            const trimmedMessages = this.trimMessages([...sessionMessages]);
            
            // 新しいユーザーメッセージを追加
            const newUserMessage = new HumanMessage({ content: query });
            const allMessages = [...trimmedMessages, newUserMessage];

            // ストリーム出力を使用
            const stream = await this.agent.stream({
                messages: allMessages,
            }, {
                streamMode: "messages"
            });
            
            // ストリームを監視してAI応答を保存
            const monitoredStream = this.monitorStream(stream, effectiveSessionId, newUserMessage);
            
            return monitoredStream;

        } catch (error) {
            Logger.error('Error processing stream query', { error: (error as Error).message, query });
            throw new Error(`ストリーム処理に失敗しました: ${(error as Error).message}`);
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
     * 既定の会话IDを生成
     */
    private generateDefaultSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 消息リストを修剪してコンテキストサイズを維持
     */
    private trimMessages(messages: BaseMessage[]): BaseMessage[] {
        if (messages.length <= this.maxContextMessages) {
            return messages;
        }
        
        // システムメッセージを保ち、最近のメッセージを取得
        const systemMessages = messages.filter(msg => msg._getType() === 'system');
        const recentMessages = messages.slice(-this.maxContextMessages);
        
        return [...systemMessages, ...recentMessages];
    }

    /**
     * ストリームを監視してAI応答を保存
     */
    private async *monitorStream(
        stream: AsyncIterable<any>, 
        sessionId: string, 
        userMessage: HumanMessage
    ): AsyncIterable<any> {
        let fullResponse = '';
        let aiMessage: AIMessage | null = null;

        // ユーザーメッセージを保存
        this.sessionMemory.addMessage(sessionId, userMessage);

        try {
            for await (const chunk of stream) {
                yield chunk;
                
                if (Array.isArray(chunk) && chunk.length > 0) {
                    const [message, metadata] = chunk;
                    if (message && typeof message.content === 'string') {
                        fullResponse += message.content;
                        aiMessage = message as AIMessage;
                    }
                }
            }

            // AI応答を保存
            if (aiMessage) {
                this.sessionMemory.addMessage(sessionId, aiMessage);
            }

            Logger.info('Stream completed and messages saved', { 
                sessionId, 
                responseLength: fullResponse.length 
            });

        } catch (error) {
            Logger.error('Stream monitoring error', { 
                error: (error as Error).message, 
                sessionId 
            });
            throw error;
        }
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