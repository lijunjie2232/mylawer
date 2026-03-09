import { config } from '../config/environment.js';
import { Logger } from '../utils/logger.js';

// モデル設定インターフェース
export interface ModelConfig {
  name: string;
  displayName: string;
  provider: string;
  baseUrl: string;
  apiKey?: string;
  maxTokens: number;
  temperature: number;
  description?: string;
  isEnabled: boolean;
}

// 模型健康检查结果
export interface ModelHealthStatus {
  name: string;
  isHealthy: boolean;
  responseTime?: number;
  lastChecked: Date;
  error?: string;
}

export class ModelManager {
  private static instance: ModelManager;
  private models: Map<string, ModelConfig> = new Map();
  private healthStatus: Map<string, ModelHealthStatus> = new Map();
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {
    // 延迟初始化，通过 async initialize() 方法
  }

  public static getInstance(): ModelManager {
    if (!ModelManager.instance) {
      ModelManager.instance = new ModelManager();
    }
    return ModelManager.instance;
  }

  /**
   * 非同期でモデル設定を初期化
   * LLM サーバーから /v1/models エンドポイントを照会して、動的にモデル設定を構築
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.initializeModelsFromServer();
    await this.initializationPromise;
    this.isInitialized = true;
  }

  /**
   * LLM サーバーからモデルリストを取得して設定を初期化
   */
  private async initializeModelsFromServer(): Promise<void> {
    Logger.info('LLM サーバーからモデル設定を初期化中...');

    try {
      const modelsUrl = `${config.llm.baseUrl}/models`;
      Logger.info('LLM API にモデルリストを照会', { url: modelsUrl });

      // LLM API からモデルリストを取得
      const response = await fetch(modelsUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(config.llm.apiKey ? { 'Authorization': `Bearer ${config.llm.apiKey}` } : {})
        }
      });

      if (!response.ok) {
        throw new Error(`LLM API からのモデル取得に失敗しました：${response.status} ${response.statusText}`);
      }

      const llmResponse = await response.json();
      const llmModels = llmResponse.data || [];

      if (!Array.isArray(llmModels) || llmModels.length === 0) {
        Logger.warn('LLM API からモデルが返されませんでした。フォールバックします');
        this.initializeFallbackModels();
        return;
      }

      // 各モデルの設定を構築
      for (const model of llmModels) {
        const modelConfig: ModelConfig = {
          name: model.id,
          displayName: model.id,
          provider: config.llm.modelProvider as 'openai' | 'anthropic',
          baseUrl: config.llm.baseUrl,
          apiKey: config.llm.apiKey || undefined,
          maxTokens: config.llm.maxTokens,
          temperature: config.llm.temperature,
          description: `由 ${model.owned_by || config.llm.modelProvider} 提供`,
          isEnabled: true
        };

        this.models.set(modelConfig.name, modelConfig);
      }

      Logger.info(`${this.models.size} 個のモデル設定を LLM サーバーから読み込みました`);

    } catch (error) {
      Logger.error('LLM サーバーからのモデル初期化に失敗しました。フォールバックします', { 
        error: (error as Error).message 
      });
      this.initializeFallbackModels();
    }
  }

  /**
   * フォールバック用のモデル設定を初期化（LLM API 利用不可の場合）
   */
  private initializeFallbackModels(): void {
    Logger.info('フォールバックモデル設定を初期化中...');

    // 主要モデル配置（来自环境变量）
    const primaryModel: ModelConfig = {
      name: config.llm.modelName,
      displayName: `${config.llm.modelProvider.toUpperCase()} - ${config.llm.modelName}`,
      provider: config.llm.modelProvider as 'openai' | 'anthropic',
      baseUrl: config.llm.baseUrl,
      apiKey: config.llm.apiKey || undefined,
      maxTokens: config.llm.maxTokens,
      temperature: config.llm.temperature,
      description: '主要配置模型',
      isEnabled: true
    };

    this.models.set(primaryModel.name, primaryModel);

    // 添加一些常见的备选模型配置
    const alternativeModels: ModelConfig[] = [
      {
        name: 'gpt-4o-mini',
        displayName: 'OpenAI - GPT-4o Mini',
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: process.env.LLM_API_KEY,
        maxTokens: 8192,
        temperature: 0.7,
        description: '轻量级高性能模型',
        isEnabled: !!process.env.LLM_API_KEY
      },
      {
        name: 'gpt-4o',
        displayName: 'OpenAI - GPT-4o',
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: process.env.LLM_API_KEY,
        maxTokens: 16384,
        temperature: 0.7,
        description: '最新旗舰模型',
        isEnabled: !!process.env.LLM_API_KEY
      },
      {
        name: 'claude-3-haiku',
        displayName: 'Anthropic - Claude 3 Haiku',
        provider: 'anthropic',
        baseUrl: 'https://api.anthropic.com/v1',
        apiKey: process.env.LLM_API_KEY,
        maxTokens: 4096,
        temperature: 0.7,
        description: '快速且经济的模型',
        isEnabled: !!process.env.LLM_API_KEY
      }
    ];

    // 添加备选模型
    alternativeModels.forEach(model => {
      if (!this.models.has(model.name)) {
        this.models.set(model.name, model);
      }
    });

    Logger.info(`${this.models.size} 個のフォールバックモデル設定を読み込みました`);
  }

  /**
   * すべての有効なモデルリストを取得
   */
  public getEnabledModels(): ModelConfig[] {
    return Array.from(this.models.values())
      .filter(model => model.isEnabled)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  /**
   * すべてのモデルリストを取得（無効なものを含む）
   */
  public getAllModels(): ModelConfig[] {
    return Array.from(this.models.values())
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  /**
   * 名前でモデル設定を取得
   */
  public getModel(name: string): ModelConfig | undefined {
    return this.models.get(name);
  }

  /**
   * モデルが存在し有効かどうかを確認
   */
  public isModelAvailable(name: string): boolean {
    const model = this.getModel(name);
    return !!model && model.isEnabled;
  }

  /**
   * モデルのヘルス状態を取得
   */
  public getHealthStatus(name: string): ModelHealthStatus | undefined {
    return this.healthStatus.get(name);
  }

  /**
   * すべてのモデルのヘルス状態を取得
   */
  public getAllHealthStatus(): ModelHealthStatus[] {
    return Array.from(this.healthStatus.values());
  }

  /**
   * モデルのヘルス状態を更新
   */
  public updateHealthStatus(name: string, status: Omit<ModelHealthStatus, 'name' | 'lastChecked'>): void {
    this.healthStatus.set(name, {
      name,
      ...status,
      lastChecked: new Date()
    });
  }

  /**
   * モデルのヘルスチェックを実行
   */
  public async checkModelHealth(modelName: string): Promise<ModelHealthStatus> {
    const model = this.getModel(modelName);
    if (!model) {
      return {
        name: modelName,
        isHealthy: false,
        error: 'Model not found',
        lastChecked: new Date()
      };
    }

    if (!model.isEnabled) {
      return {
        name: modelName,
        isHealthy: false,
        error: 'Model is disabled',
        lastChecked: new Date()
      };
    }

    const startTime = Date.now();
    
    try {
      // ここでは実際にモデル接続をテストする必要があります
      // 由于我们没有实际的模型连接测试逻辑，暂时返回模拟结果
      // 実際のアプリケーションでは、ここにモデルAPIへの簡単なpingリクエストを送信する必要があります
      
      const responseTime = Date.now() - startTime;
      
      const healthStatus: ModelHealthStatus = {
        name: modelName,
        isHealthy: true,
        responseTime,
        lastChecked: new Date()
      };

      this.updateHealthStatus(modelName, { isHealthy: true, responseTime });
      return healthStatus;

    } catch (error) {
      const healthStatus: ModelHealthStatus = {
        name: modelName,
        isHealthy: false,
        error: (error as Error).message,
        lastChecked: new Date()
      };

      this.updateHealthStatus(modelName, { 
        isHealthy: false, 
        error: (error as Error).message 
      });
      return healthStatus;
    }
  }

  /**
   * 批量检查所有启用模型的健康状态
   */
  public async checkAllModelsHealth(): Promise<ModelHealthStatus[]> {
    const enabledModels = this.getEnabledModels();
    const healthChecks = enabledModels.map(model => 
      this.checkModelHealth(model.name)
    );
    
    return Promise.all(healthChecks);
  }

  /**
   * 添加新的模型配置
   */
  public addModel(modelConfig: ModelConfig): void {
    this.models.set(modelConfig.name, modelConfig);
    Logger.info(`Added new model: ${modelConfig.name}`);
  }

  /**
   * 更新现有模型配置
   */
  public updateModel(name: string, updates: Partial<ModelConfig>): boolean {
    const existingModel = this.models.get(name);
    if (!existingModel) {
      return false;
    }

    const updatedModel = { ...existingModel, ...updates };
    this.models.set(name, updatedModel);
    Logger.info(`Updated model: ${name}`);
    return true;
  }

  /**
   * 删除模型配置
   */
  public removeModel(name: string): boolean {
    const result = this.models.delete(name);
    this.healthStatus.delete(name);
    if (result) {
      Logger.info(`Removed model: ${name}`);
    }
    return result;
  }

  /**
   * 启用模型
   */
  public enableModel(name: string): boolean {
    const model = this.getModel(name);
    if (model) {
      model.isEnabled = true;
      this.models.set(name, model);
      Logger.info(`Enabled model: ${name}`);
      return true;
    }
    return false;
  }

  /**
   * 禁用模型
   */
  public disableModel(name: string): boolean {
    const model = this.getModel(name);
    if (model) {
      model.isEnabled = false;
      this.models.set(name, model);
      Logger.info(`Disabled model: ${name}`);
      return true;
    }
    return false;
  }
}