import { DynamicTool } from '@langchain/core/tools';
import { BaseToolPlugin, createToolFactory } from './basePlugin.js';
import { Logger } from '../../utils/logger.js';
import { request } from 'https';

interface JinaSearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
  position: number;
}

export class JinaSearchPlugin extends BaseToolPlugin {
  readonly name = 'jina-search';
  readonly description = '使用Jina搜索引擎进行高质量搜索';
  readonly version = '1.0.0';
  
  private apiKey: string;
  private maxResults: number;
  private countryCode: string;
  private languageCode: string;
  private respondWith: 'no-content' | 'text' | 'markdown' | 'html' | 'screenshot';

  constructor(config?: Record<string, any>) {
    super(config);
    this.apiKey = config?.apiKey || process.env.JINA_API_KEY || '';
    this.maxResults = config?.maxResults || 3;
    this.countryCode = config?.countryCode || 'US';
    this.languageCode = config?.languageCode || 'en';
    this.respondWith = config?.respondWith || 'no-content';
  }

  get isEnabled(): boolean {
    const enabledVar = 'TOOL_JINA_SEARCH_ENABLED';
    const envValue = process.env[enabledVar];
    
    if (envValue === 'false' || envValue === '0') {
      return false;
    }
    
    if (!this.apiKey) {
      Logger.warn('Jina Search 缺少 JINA_API_KEY');
      return false;
    }
    
    return true;
  }

  createTool(): DynamicTool {
    return new DynamicTool({
      name: 'jina_search',
      description: `使用Jina搜索引擎进行高质量搜索，返回最多${this.maxResults}个相关结果。支持多语言和地区定制。`,
      func: async (input: string) => {
        return await this.search(input);
      }
    });
  }

  async search(query: string): Promise<string> {
    if (!query.trim()) {
      return JSON.stringify({
        success: false,
        results: [],
        resultCount: 0,
        maxResults: this.maxResults,
        error: '请输入有效的搜索查询'
      });
    }

    Logger.info('开始Jina搜索', { 
      query, 
      maxResults: this.maxResults, 
      countryCode: this.countryCode,
      languageCode: this.languageCode,
      respondWith: this.respondWith
    });

    try {
      const data = JSON.stringify({
        q: query,
        gl: this.countryCode,
        hl: this.languageCode
      });

      const options = {
        hostname: 's.jina.ai',
        path: '/',
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-Respond-With': this.respondWith,
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const result = await new Promise<string>((resolve, reject) => {
        const req = request(options, (res) => {
          let responseData = '';

          res.on('data', (chunk) => {
            responseData += chunk;
          });

          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(responseData);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
            }
          });
        });

        req.on('error', (e) => {
          reject(new Error(`请求错误: ${e.message}`));
        });

        req.write(data);
        req.end();
      });

      const jsonData = JSON.parse(result);
      
      Logger.info('Jina検索が完了しました', { 
        query, 
        resultCount: jsonData.data?.length || 0 
      });

      if (!jsonData.data || jsonData.data.length === 0) {
        return JSON.stringify({
          success: true,
          results: [],
          resultCount: 0,
          maxResults: this.maxResults,
          message: '関連する検索結果が見つかりませんでした'
        });
      }

      const formattedResults: JinaSearchResult[] = jsonData.data.slice(0, this.maxResults).map((item: any, index: number) => ({
        title: item.title || 'タイトルなし',
        url: item.url,
        content: item.content?.substring(0, 500) || '',
        score: item.score || 0,
        position: index + 1
      }));

      const resultObj = {
        success: true,
        results: formattedResults,
        resultCount: formattedResults.length,
        maxResults: this.maxResults,
        message: `${formattedResults.length}件の検索結果を正常に取得しました`
      };

      return JSON.stringify(resultObj);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      Logger.error('Jina検索に失敗しました', { query, error: errorMessage });
      
      return JSON.stringify({
        success: false,
        results: [],
        resultCount: 0,
        maxResults: this.maxResults,
        error: `Jina検索の実行に失敗しました: ${errorMessage}`
      });
    }
  }

  getConfig(): Record<string, any> {
    return {
      ...super.getConfig(),
      maxResults: this.maxResults,
      countryCode: this.countryCode,
      languageCode: this.languageCode,
      respondWith: this.respondWith
    };
  }

  getMetadata() {
    return {
      name: this.name,
      version: this.version,
      description: this.description,
      requiredEnvVars: ['JINA_API_KEY']
    };
  }
}

export const jinaSearchFactory = createToolFactory(JinaSearchPlugin);
