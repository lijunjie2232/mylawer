import { LegalAgent } from './legalAgent.js';
import { ModelConfig } from '../models/modelManager.js';
import { Logger } from '../utils/logger.js';
import { config } from '../config/environment.js';

/**
 * エージェントマネージャー
 * セッションごとのエージェントインスタンスを管理
 */
export class AgentManager {
  private static instance: AgentManager;
  private agents: Map<string, LegalAgent>;

  private constructor() {
    this.agents = new Map();
    Logger.info('AgentManager initialized');
  }

  public static getInstance(): AgentManager {
    if (!AgentManager.instance) {
      AgentManager.instance = new AgentManager();
    }
    return AgentManager.instance;
  }

  /**
   * セッション ID に基づいてエージェントを取得または作成
   */
  public getOrCreateAgent(sessionId: string, modelConfig: ModelConfig): LegalAgent {
    const existingAgent = this.agents.get(sessionId);
    if (existingAgent) {
      Logger.debug('Using cached agent for session', { sessionId });
      return existingAgent;
    }

    Logger.info('Creating new agent for session', { sessionId, model: modelConfig.name });
    const agent = new LegalAgent(modelConfig);
    this.agents.set(sessionId, agent);
    return agent;
  }

  /**
   * エージェントを取得（互換性のため）
   */
  public async getAgent(sessionId?: string): Promise<LegalAgent> {
    // セッション ID が指定されていない場合はデフォルトエージェントを返す
    const actualSessionId = sessionId || 'default';
    
    Logger.info('エージェント取得開始', {
      sessionId: actualSessionId,
      config_llm_modelName: config.llm.modelName,
      config_llm_provider: config.llm.modelProvider,
      config_llm_baseUrl: config.llm.baseUrl,
      config_llm_apiKey: config.llm.apiKey ? '***' + config.llm.apiKey.slice(-4) : '未設定'
    });
    
    const defaultModelConfig: ModelConfig = {
      name: config.llm.modelName,
      displayName: `${config.llm.modelProvider.toUpperCase()} - ${config.llm.modelName}`,
      provider: config.llm.modelProvider as 'openai' | 'anthropic',
      baseUrl: config.llm.baseUrl,
      apiKey: config.llm.apiKey,
      maxTokens: config.llm.maxTokens,
      temperature: config.llm.temperature,
      description: 'Default model',
      isEnabled: true
    };
    
    Logger.info('エージェント作成', {
      sessionId: actualSessionId,
      modelConfig_name: defaultModelConfig.name,
      modelConfig_provider: defaultModelConfig.provider,
      modelConfig_baseUrl: defaultModelConfig.baseUrl,
      modelConfig_apiKey: defaultModelConfig.apiKey ? '***' + defaultModelConfig.apiKey.slice(-4) : '未設定'
    });
    
    return this.getOrCreateAgent(actualSessionId, defaultModelConfig);
  }

  /**
   * セッションのエージェントをクリア
   */
  public clearAgent(sessionId: string): void {
    this.agents.delete(sessionId);
    Logger.info('Agent cleared for session', { sessionId });
  }

  /**
   * すべてのエージェントキャッシュをクリア
   */
  public clearAllAgents(): void {
    this.agents.clear();
    Logger.info('All agents cleared');
  }

  /**
   * アクティブなセッション数を取得
   */
  public getActiveSessionCount(): number {
    return this.agents.size;
  }
}
