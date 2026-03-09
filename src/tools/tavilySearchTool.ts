import { DynamicTool } from '@langchain/core/tools';
import { Logger } from '../utils/logger.js';

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  position: number;
}

interface TavilySearchToolConfig {
  maxResults?: number;
  apiKey?: string;
  searchDepth?: 'basic' | 'advanced';
}

export class TavilySearchTool extends DynamicTool {
  private apiKey: string;
  private maxResults: number;
  private searchDepth: 'basic' | 'advanced';

  constructor(config?: TavilySearchToolConfig) {
    const maxResults = config?.maxResults || 3;
    const apiKey = config?.apiKey || process.env.TAVILY_API_KEY;
    const searchDepth = config?.searchDepth || 'basic';
    
    super({
      name: 'tavily_search',
      description: `使用Tavily搜索引擎进行高质量搜索，返回最多${maxResults}个相关结果。支持基础和高级搜索模式。`,
      func: async (input: string) => {
        return await this.search(input);
      }
    });
    
    if (!apiKey) {
      throw new Error('TAVILY_API_KEY 未设置，请在环境变量中配置或通过构造函数传入');
    }
    
    this.apiKey = apiKey;
    this.maxResults = maxResults;
    this.searchDepth = searchDepth;
  }

  /**
   * 执行Tavily搜索
   */
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

    Logger.info('开始Tavily搜索', { query, maxResults: this.maxResults, searchDepth: this.searchDepth });

    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: this.apiKey,
          query: query,
          search_depth: this.searchDepth,
          include_answer: true,
          include_images: false,
          include_raw_content: false,
          max_results: this.maxResults,
          include_domains: [],
          exclude_domains: []
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      Logger.info('Tavily搜索完成', { 
        query, 
        resultCount: data.results?.length || 0 
      });

      if (!data.results || data.results.length === 0) {
        return JSON.stringify({
          success: true,
          results: [],
          resultCount: 0,
          maxResults: this.maxResults,
          message: '未找到相关搜索结果'
        });
      }

      // 格式化结果
      const formattedResults: TavilySearchResult[] = data.results.map((result: any, index: number) => ({
        title: result.title || '无标题',
        url: result.url,
        content: result.content?.substring(0, 500) || '',
        score: result.score || 0,
        position: index + 1
      }));

      const result = {
        success: true,
        results: formattedResults,
        resultCount: formattedResults.length,
        maxResults: this.maxResults,
        answer: data.answer || null,
        message: `${formattedResults.length}件の検索結果を正常に取得しました`
      };

      return JSON.stringify(result);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      Logger.error('Tavily検索に失敗しました', { query, error: errorMessage });
      
      return JSON.stringify({
        success: false,
        results: [],
        resultCount: 0,
        maxResults: this.maxResults,
        error: `Tavily検索の実行に失敗しました: ${errorMessage}`
      });
    }
  }

  /**
   * 生検索結果を取得（deepSearchTool用）
   */
  async getRawResults(query: string): Promise<TavilySearchResult[]> {
    const resultJson = await this.search(query);
    const result = JSON.parse(resultJson);
    
    if (result.success && result.results) {
      return result.results as TavilySearchResult[];
    }
    
    return [];
  }
}