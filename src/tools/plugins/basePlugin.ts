import { DynamicTool } from '@langchain/core/tools';
import { ToolPlugin, ToolPluginFactory } from './toolRegistry.js';
import { Logger } from '../../utils/logger.js';

/**
 * 基础工具插件类
 */
export abstract class BaseToolPlugin implements ToolPlugin {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly version: string;
  
  protected config: Record<string, any>;
  
  constructor(config?: Record<string, any>) {
    this.config = config || {};
  }

  /**
   * 检查是否启用（默认实现，子类可重写）
   */
  get isEnabled(): boolean {
    const enabledVar = `TOOL_${this.name.toUpperCase().replace(/-/g, '_')}_ENABLED`;
    const envValue = process.env[enabledVar];
    
    // 如果环境变量明确设置为 'false' 或 '0'，则禁用
    if (envValue === 'false' || envValue === '0') {
      return false;
    }
    
    // 如果设置了其他值或未设置，检查必需的 API key
    return this.checkRequiredEnvVars();
  }

  /**
   * 检查必需的环境变量
   */
  protected checkRequiredEnvVars(): boolean {
    const metadata = this.getMetadata();
    if (!metadata.requiredEnvVars || metadata.requiredEnvVars.length === 0) {
      return true;
    }

    for (const envVar of metadata.requiredEnvVars) {
      if (!process.env[envVar]) {
        Logger.warn(`工具 ${this.name} 缺少必需的环境变量`, { envVar });
        return false;
      }
    }
    
    return true;
  }

  /**
   * 创建工具实例（由子类实现）
   */
  abstract createTool(): DynamicTool;

  /**
   * 获取配置
   */
  getConfig(): Record<string, any> {
    return { ...this.config };
  }

  /**
   * 获取元数据（由子类实现）
   */
  abstract getMetadata(): {
    name: string;
    version: string;
    description: string;
    requiredEnvVars?: string[];
  };
}

/**
 * 创建工具工厂的辅助函数
 */
export function createToolFactory<T extends BaseToolPlugin>(
  PluginClass: new (config?: Record<string, any>) => T
): ToolPluginFactory {
  return {
    create(config?: Record<string, any>): ToolPlugin {
      return new PluginClass(config);
    },
    
    getMetadata() {
      // 创建一个临时实例来获取元数据
      const instance = new PluginClass();
      return instance.getMetadata();
    }
  };
}
