import { DynamicTool } from '@langchain/core/tools';
import { Document } from '@langchain/core/documents';
import { TavilySearchTool } from './tavilySearchTool.js';
import { WebSearchTool } from './webSearchTool.js';
import { WebpageLoaderTool } from './webpageLoaderTool.js';
import { Logger } from '../utils/logger.js';
import * as cheerio from 'cheerio';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  position: number;
  score?: number;
}

interface DeepSearchResult {
  success: boolean;
  documents: Document[];
  searchResultsCount: number;
  loadedDocumentsCount: number;
  failedUrls: string[];
  maxResults: number;
  message?: string;
  error?: string;
}

export interface DeepSearchToolConfig {
  maxResults?: number;
  searchEngine?: 'tavily' | 'web';
  webSearchConfig?: {
    maxResults?: number;
    headless?: boolean;
    searchEngine?: 'bing' | 'google' | 'yahoo';
    language?: string;
  };
  webpageLoaderConfig?: {
    usePlaywright?: boolean;
    headless?: boolean;
    language?: string;
    timeout?: number;
  };
  maxConcurrentLoads?: number;
}

export class DeepSearchTool extends DynamicTool {
  private tavilySearchTool?: TavilySearchTool;
  private webSearchTool?: WebSearchTool;
  private webpageLoaderTool: WebpageLoaderTool;
  private maxConcurrentLoads: number = 5;
  private maxResults: number;
  private searchEngine: 'tavily' | 'web';


  constructor(config?: DeepSearchToolConfig) {
    const maxResults = config?.maxResults || 3;
    const searchEngine = config?.searchEngine || 'tavily';
    
    super({
      name: 'deep_search',
      description: `执行深度搜索：使用${searchEngine === 'tavily' ? 'Tavily' : 'Web'}搜索获取结果，然后自动加载网页内容并返回最多${maxResults}个文档。如果部分页面加载失败，会尝试加载额外页面以达到目标数量。`,
      func: async (input: string) => {
        return await this.deepSearch(input);
      }
    });
        
    this.maxResults = maxResults;
    this.searchEngine = searchEngine;
    this.maxConcurrentLoads = config?.maxConcurrentLoads || 5;
        
    // 根据配置初始化搜索引擎
    if (searchEngine === 'tavily') {
      this.tavilySearchTool = new TavilySearchTool({ maxResults: this.maxResults + 2 });
    } else {
      this.webSearchTool = new WebSearchTool(config?.webSearchConfig);
    }
        
    this.webpageLoaderTool = new WebpageLoaderTool(config?.webpageLoaderConfig);
  }

  /**
   * 将 Bing 搜索结果转换为统一格式
   */
  private convertBingResults(results: any[]): SearchResult[] {
    return results.map((result, index) => ({
      title: result.title || '无标题',
      url: result.url,
      snippet: result.abstract?.substring(0, 200) || '',
      position: index + 1,
      score: 0 // Bing 不提供分数
    }));
  }
  
  /**
   * 将 Tavily 搜索结果转换为统一格式
   */
  private convertTavilyResults(results: any[]): SearchResult[] {
    return results.map((result, index) => ({
      title: result.title || '无标题',
      url: result.url,
      snippet: result.content?.substring(0, 200) || '',
      position: index + 1,
      score: result.score || 0
    }));
  }



  /**
   * 并行加载多个网页
   */
  private async loadWebpagesConcurrently(urls: string[]): Promise<{
    documents: Document[];
    failedUrls: string[];
  }> {
    const documents: Document[] = [];
    const failedUrls: string[] = [];
    
    // 控制并发数量
    const chunks: string[][] = [];
    for (let i = 0; i < urls.length; i += this.maxConcurrentLoads) {
      chunks.push(urls.slice(i, i + this.maxConcurrentLoads));
    }
    
    for (const chunk of chunks) {
      const promises = chunk.map(async (url) => {
        try {
          Logger.info('开始加载网页', { url });
          const resultJson = await this.webpageLoaderTool.loadWebpage(url);
          const result = JSON.parse(resultJson);
          
          if (result.success && result.document) {
            Logger.info('网页加载成功', { 
              url, 
              title: result.title,
              content_length: result.content_length 
            });
            return { document: result.document as Document, url, success: true };
          } else {
            Logger.warn('网页加载失败', { url, error: result.error });
            return { document: null, url, success: false, error: result.error };
          }
        } catch (error) {
          Logger.error('网页加载异常', { url, error: (error as Error).message });
          return { document: null, url, success: false, error: (error as Error).message };
        }
      });
      
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        if (result.success && result.document) {
          documents.push(result.document);
        } else {
          failedUrls.push(result.url);
        }
      });
    }
    
    return { documents, failedUrls };
  }

  /**
   * 加载额外的网页以补偿失败的加载
   */
  private async loadAdditionalPages(
    initialResults: SearchResult[], 
    loadedUrls: string[], 
    failedUrls: string[], 
    targetCount: number
  ): Promise<{
    additionalDocuments: Document[];
    additionalFailedUrls: string[];
  }> {
    const additionalDocuments: Document[] = [];
    const additionalFailedUrls: string[] = [];
    
    // 找到尚未尝试加载的URL
    const availableResults = initialResults.filter(result => 
      !loadedUrls.includes(result.url) && !failedUrls.includes(result.url)
    );
    
    Logger.info('尝试加载额外页面', { 
      availableCount: availableResults.length, 
      targetCount, 
      currentLoaded: loadedUrls.length 
    });
    
    let currentIndex = 0;
    while (additionalDocuments.length < targetCount && currentIndex < availableResults.length) {
      const nextResult = availableResults[currentIndex];
      currentIndex++;
      
      try {
        Logger.info('加载额外页面', { url: nextResult.url, position: nextResult.position });
        const resultJson = await this.webpageLoaderTool.loadWebpage(nextResult.url);
        const result = JSON.parse(resultJson);
        
        if (result.success && result.document) {
          Logger.info('额外页面加载成功', { 
            url: nextResult.url,
            title: result.title,
            content_length: result.content_length
          });
          additionalDocuments.push(result.document as Document);
        } else {
          Logger.warn('额外页面加载失败', { url: nextResult.url, error: result.error });
          additionalFailedUrls.push(nextResult.url);
        }
      } catch (error) {
        Logger.error('额外页面加载异常', { url: nextResult.url, error: (error as Error).message });
        additionalFailedUrls.push(nextResult.url);
      }
    }
    
    return { additionalDocuments, additionalFailedUrls };
  }

  /**
   * 执行深度搜索
   */
  async deepSearch(query: string): Promise<string> {
    if (!query.trim()) {
      return JSON.stringify({
        success: false,
        documents: [],
        searchResultsCount: 0,
        loadedDocumentsCount: 0,
        failedUrls: [],
        maxResults: this.maxResults,
        error: '请输入有效的搜索查询'
      } as DeepSearchResult);
    }
    
    Logger.info('开始深度搜索', { query });

    try {
      // 第一步：执行搜索（根据配置选择搜索引擎）
      let rawResults: any[];
          
      if (this.searchEngine === 'tavily') {
        Logger.info('使用 Tavily 进行搜索', { query });
        rawResults = await this.tavilySearchTool!.getRawResults(query);
        Logger.info('Tavily 搜索完成', { 
          query, 
          resultCount: rawResults.length 
        });
      } else if (this.searchEngine === 'web' ) { // bing/google/yahoo
        Logger.info(`使用 ${this.searchEngine} 进行搜索`, { query });
        const bingResultJson = await this.webSearchTool!.search(query);
        const bingResult = JSON.parse(bingResultJson);
        rawResults = bingResult.results || [];
        Logger.info('Bing 搜索完成', { 
          query, 
          resultCount: rawResults.length 
        });
      } else {
        throw new Error(`不支持的搜索引擎：${this.searchEngine}`);
      }
          
      const searchResults = this.searchEngine !== 'tavily'
        ? this.convertBingResults(rawResults)
        : this.convertTavilyResults(rawResults);
      
      if (searchResults.length === 0) {
        return JSON.stringify({
          success: true,
          documents: [],
          searchResultsCount: 0,
          loadedDocumentsCount: 0,
          failedUrls: [],
          maxResults: this.maxResults,
          message: '未找到相关搜索结果'
        } as DeepSearchResult);
      }
      
      // 第二步：并行加载网页内容
      const urls = searchResults.map(result => result.url);
      Logger.info('开始并行加载网页', { 
        urlCount: urls.length, 
        maxResults: this.maxResults,
        searchEngine: this.searchEngine 
      });
      
      const { documents, failedUrls } = await this.loadWebpagesConcurrently(urls);
      
      // 如果加载的文档数量不足，尝试加载额外的页面
      let finalDocuments = documents;
      let finalFailedUrls = [...failedUrls];
      
      if (documents.length < this.maxResults && failedUrls.length > 0) {
        const neededMore = this.maxResults - documents.length;
        Logger.info('需要加载更多页面', { 
          currentLoaded: documents.length, 
          neededMore, 
          totalAvailable: searchResults.length 
        });
        
        const { additionalDocuments, additionalFailedUrls } = await this.loadAdditionalPages(
          searchResults,
          urls, // 已经尝试加载的URL
          failedUrls, // 失败的URL
          neededMore
        );
        
        finalDocuments = [...documents, ...additionalDocuments];
        finalFailedUrls = [...finalFailedUrls, ...additionalFailedUrls];
      }
      
      const result: DeepSearchResult = {
        success: true,
        documents: finalDocuments,
        searchResultsCount: searchResults.length,
        loadedDocumentsCount: finalDocuments.length,
        failedUrls: finalFailedUrls,
        maxResults: this.maxResults,
        message: finalDocuments.length > 0 
          ? `成功加载${finalDocuments.length}个文档 (目标: ${this.maxResults})`
          : '未能加载任何网页内容'
      };
      
      Logger.info('深度搜索完成', {
        searchResultsCount: searchResults.length,
        loadedDocumentsCount: finalDocuments.length,
        failedCount: finalFailedUrls.length,
        maxResults: this.maxResults
      });
      
      return JSON.stringify(result);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      Logger.error('深度搜索失败', { query, error: errorMessage });
      
      return JSON.stringify({
        success: false,
        documents: [],
        searchResultsCount: 0,
        loadedDocumentsCount: 0,
        failedUrls: [],
        maxResults: this.maxResults,
        error: `深度搜索执行失败: ${errorMessage}`
      } as DeepSearchResult);
    }
  }
}