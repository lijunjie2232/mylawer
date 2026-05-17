import { DynamicTool } from '@langchain/core/tools';
import { Logger } from '../../utils/logger.js';

/**
 * 工具插件接口定义
 */
export interface ToolPlugin {
  /** 工具名称（唯一标识） */
  name: string;
  
  /** 工具描述 */
  description: string;
  
  /** 是否启用 */
  isEnabled: boolean;
  
  /** 创建工具实例 */
  createTool(): DynamicTool;
  
  /** 获取工具配置信息 */
  getConfig(): Record<string, any>;
}

/**
 * 工具插件工厂接口
 */
export interface ToolPluginFactory {
  /** 创建工具插件实例 */
  create(config?: Record<string, any>): ToolPlugin;
  
  /** 获取插件元数据 */
  getMetadata(): {
    name: string;
    version: string;
    description: string;
    requiredEnvVars?: string[];
  };
}

/**
 * 工具注册表
 */
export class ToolRegistry {
  private static instance: ToolRegistry;
  private plugins: Map<string, ToolPlugin> = new Map();
  private factories: Map<string, ToolPluginFactory> = new Map();

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  /**
   * 注册工具工厂
   */
  registerFactory(name: string, factory: ToolPluginFactory): void {
    this.factories.set(name.toLowerCase(), factory);
    Logger.info('工具工厂已注册', { name });
  }

  /**
   * 根据配置创建并注册工具插件
   */
  registerFromConfig(name: string, config?: Record<string, any>): ToolPlugin | null {
    const factory = this.factories.get(name.toLowerCase());
    if (!factory) {
      Logger.warn('未找到工具工厂', { name });
      return null;
    }

    try {
      const plugin = factory.create(config);
      if (plugin.isEnabled) {
        this.plugins.set(plugin.name, plugin);
        Logger.info('工具插件已注册', { 
          name: plugin.name, 
          description: plugin.description 
        });
        return plugin;
      } else {
        Logger.info('工具插件已禁用', { name });
        return null;
      }
    } catch (error) {
      Logger.error('工具插件注册失败', { 
        name, 
        error: (error as Error).message 
      });
      return null;
    }
  }

  /**
   * 获取所有已启用的工具
   */
  getEnabledTools(): DynamicTool[] {
    const tools: DynamicTool[] = [];
    for (const plugin of this.plugins.values()) {
      if (plugin.isEnabled) {
        try {
          const tool = plugin.createTool();
          tools.push(tool);
        } catch (error) {
          Logger.error('创建工具实例失败', { 
            name: plugin.name, 
            error: (error as Error).message 
          });
        }
      }
    }
    return tools;
  }

  /**
   * 获取特定工具
   */
  getTool(name: string): ToolPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * 检查工具是否已启用
   */
  isToolEnabled(name: string): boolean {
    const plugin = this.plugins.get(name);
    return plugin?.isEnabled ?? false;
  }

  /**
   * 获取所有已注册工具的列表
   */
  getRegisteredTools(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * 清除所有注册的工具
   */
  clear(): void {
    this.plugins.clear();
  }
}
