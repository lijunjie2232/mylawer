import { DynamicTool } from '@langchain/core/tools';
import { BaseToolPlugin, createToolFactory } from './basePlugin.js';
import { Logger } from '../../utils/logger.js';
import { chromium } from 'rebrowser-playwright';
import * as cheerio from 'cheerio';

interface BingSearchResult {
  title: string;
  url: string;
  abstract: string;
  position: number;
}

export class WebSearchPlugin extends BaseToolPlugin {
  readonly name = 'web-search';
  readonly description = '使用浏览器进行网页搜索（支持Bing、Google、Yahoo）';
  readonly version = '1.0.0';
  
  private maxResults: number;
  private headless: boolean;
  private searchEngine: 'bing' | 'google' | 'yahoo';
  private language: string;

  constructor(config?: Record<string, any>) {
    super(config);
    this.maxResults = config?.maxResults || 3;
    this.headless = config?.headless ?? false;
    this.searchEngine = config?.searchEngine || 'bing';
    this.language = config?.language || 'ja-JP';
  }

  get isEnabled(): boolean {
    const enabledVar = 'TOOL_WEB_SEARCH_ENABLED';
    const envValue = process.env[enabledVar];
    
    if (envValue === 'false' || envValue === '0') {
      return false;
    }
    
    // Web search 不需要 API key，默认启用
    return true;
  }

  createTool(): DynamicTool {
    return new DynamicTool({
      name: `${this.searchEngine}_search`,
      description: `使用${this.searchEngine}搜索引擎进行搜索，返回最多${this.maxResults}个相关结果（包含 URL、标题和摘要）`,
      func: async (input: string) => {
        return await this.search(input);
      }
    });
  }

  private getTimezoneId(language: string): string {
    const lang = language.toLowerCase();
    if (lang.startsWith('ja')) return 'Asia/Tokyo';
    if (lang.startsWith('zh')) return 'Asia/Shanghai';
    if (lang.startsWith('en')) return 'America/New_York';
    if (lang.startsWith('ko')) return 'Asia/Seoul';
    if (lang.startsWith('fr')) return 'Europe/Paris';
    if (lang.startsWith('de')) return 'Europe/Berlin';
    if (lang.startsWith('es')) return 'Europe/Madrid';
    return 'Asia/Tokyo';
  }

  private getSearchUrl(query: string): string {
    switch (this.searchEngine) {
      case 'google': {
        const googleLang = this.language.split('-')[0] || 'ja';
        const googleRegion = this.language.split('-')[1] || 'JP';
        const baseUrl = 'https://www.google.com/search';
        const url = new URL(baseUrl);
        url.searchParams.append('q', query);
        url.searchParams.append('hl', googleLang);
        url.searchParams.append('gl', googleRegion.toUpperCase());
        return url.toString();
      }
      case 'yahoo': {
        const baseUrl = 'https://search.yahoo.co.jp/search';
        const url = new URL(baseUrl);
        url.searchParams.append('p', query);
        url.searchParams.append('ei', 'UTF-8');
        url.searchParams.append('fr', 'top_ga1_sa');
        url.searchParams.append('x', 'wrt');
        url.searchParams.append('ml', '10');
        url.searchParams.append('aq', '-1');
        url.searchParams.append('oq', '');
        url.searchParams.append('at', '');
        url.searchParams.append('ai', '');
        url.searchParams.append('b', this.language.split('-')[0] || 'ja');
        return url.toString();
      }
      case 'bing':
      default: {
        const bingLang = this.language.replace('-', '_');
        const bingRegion = this.language.split('-')[1] || 'JP';
        const baseUrl = 'https://www.bing.com/search';
        const url = new URL(baseUrl);
        url.searchParams.append('q', query);
        url.searchParams.append('setlang', bingLang);
        url.searchParams.append('cc', bingRegion.toLowerCase());
        return url.toString();
      }
    }
  }

  private parseSearchResults(html: string): BingSearchResult[] {
    const $ = cheerio.load(html);
    const results: BingSearchResult[] = [];

    if (this.searchEngine === 'bing') {
      $('#b_results .b_algo').each((index, element) => {
        if (index >= this.maxResults) return;

        const titleElement = $(element).find('h2 a');
        const title = titleElement.text().trim();
        const url = titleElement.attr('href') || '';
        const abstract = $(element).find('.b_caption p').text().trim();

        if (title && url) {
          results.push({
            title,
            url,
            abstract,
            position: index + 1
          });
        }
      });
    } else if (this.searchEngine === 'google') {
      const resultSelectors = ['div.g', 'div.tF2Cxc', 'div.yuRUbf', '[data-header-feature="0"]'];

      for (const selector of resultSelectors) {
        $(selector).each((index, element) => {
          if (results.length >= this.maxResults) return;

          const titleElement = $(element).find('h3 a, a h3').first();
          const title = titleElement.text().trim();
          let url = titleElement.attr('href') || $(element).find('a').first().attr('href') || '';

          if (url.startsWith('/url?q=')) {
            const urlMatch = url.match(/\/url\?q=([^&]+)/);
            if (urlMatch && urlMatch[1]) {
              url = decodeURIComponent(urlMatch[1]);
            }
          }

          let abstract = '';
          const abstractSelectors = ['.VwiC3b', 'div.VwiC3b', 'span.yDYNvb', '.yDYNvb', 'div[data-sncf]', 'span[data-sncf]'];
          for (const absSelector of abstractSelectors) {
            abstract = $(element).find(absSelector).first().text().trim();
            if (abstract) break;
          }

          if (!abstract) {
            abstract = $(element).find('div:not(h3):not(a)').first().text().trim().substring(0, 200);
          }

          if (title && url && !url.startsWith('#')) {
            results.push({
              title,
              url,
              abstract,
              position: results.length + 1
            });
          }
        });

        if (results.length >= this.maxResults) break;
      }
    } else if (this.searchEngine === 'yahoo') {
      $('.sw-CardBase').each((index, element) => {
        if (results.length >= this.maxResults) return;

        if ($(element).hasClass('Ad')) {
          return;
        }

        const titleElement = $(element).find('.sw-Card__title a').first();
        const title = titleElement.text().trim();
        let url = titleElement.attr('href') || '';

        if (url.includes('search.yahoo.co.jp/clear.gif')) {
          const realUrl = $(element).find('.sw-Card__title a').attr('data-cl-params');
          if (realUrl && realUrl.includes('targurl:')) {
            const match = realUrl.match(/targurl:([^;]+)/);
            if (match && match[1]) {
              url = decodeURIComponent(match[1].replace(/%3A/g, ':').replace(/%2F/g, '/'));
            }
          }
        }

        let abstract = '';
        const abstractSelectors = ['.sw-Card__summary', '.Algo__summary', 'p.sw-Card__summary'];
        for (const selector of abstractSelectors) {
          abstract = $(element).find(selector).first().text().trim();
          if (abstract) break;
        }

        if (!abstract) {
          abstract = $(element).find('.sw-Card__space').first().text().trim().substring(0, 200);
        }

        if (title && url && !url.startsWith('#')) {
          results.push({
            title,
            url,
            abstract,
            position: results.length + 1
          });
        }
      });
    }

    return results;
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

    Logger.info('开始搜索', {
      query,
      searchEngine: this.searchEngine,
      maxResults: this.maxResults
    });

    let browser;
    try {
      browser = await chromium.launch({
        headless: this.headless,
        channel: 'chrome',
        args: [
          '--lang=' + this.language,
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-setuid-sandbox',
          '--no-first-run',
          '--no-sandbox',
          '--no-zygote',
          '--deterministic-fetch',
          '--disable-features=IsolateOrigins',
          '--disable-site-isolation-trials',
        ],
        firefoxUserPrefs: {
          'intl.accept_languages': this.language,
        },
      });

      const context = await browser.newContext({
        geolocation: {
          latitude: 35.478883,
          longitude: 139.720481
        },
        locale: 'ja-JP',
        permissions: ['geolocation'],
        timezoneId: 'Asia/Tokyo',
      });

      await context.addInitScript(() => {
        delete Object.getPrototypeOf(navigator).webdriver;

        Object.defineProperty(navigator, 'language', {
          get: () => window.navigator.language || 'ja-JP'
        });

        Object.defineProperty(navigator, 'languages', {
          get: () => [window.navigator.language || 'ja-JP']
        });
      });

      const page = await context.newPage();

      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': `${this.language},${this.language.split('-')[0] || 'ja'};q=0.9,en;q=0.8`
      });

      const searchUrl = this.getSearchUrl(query);
      Logger.info('访问搜索 URL', { url: searchUrl });

      await page.goto(searchUrl, {
        waitUntil: 'networkidle',
        timeout: 60000
      });

      await page.waitForTimeout(5000);

      const content = await page.content();
      const results = this.parseSearchResults(content);

      Logger.info('搜索完成', {
        query,
        resultCount: results.length
      });

      await browser.close();

      if (results.length === 0) {
        return JSON.stringify({
          success: true,
          results: [],
          resultCount: 0,
          maxResults: this.maxResults,
          message: '未找到相关搜索结果'
        });
      }

      const result = {
        success: true,
        results,
        resultCount: results.length,
        maxResults: this.maxResults,
        message: `${results.length} 个搜索结果已成功获取`
      };

      return JSON.stringify(result);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      Logger.error('搜索失败', { query, error: errorMessage });

      if (browser) {
        await browser.close().catch(() => { });
      }

      return JSON.stringify({
        success: false,
        results: [],
        resultCount: 0,
        maxResults: this.maxResults,
        error: `搜索执行失败：${errorMessage}`
      });
    }
  }

  getConfig(): Record<string, any> {
    return {
      ...super.getConfig(),
      maxResults: this.maxResults,
      headless: this.headless,
      searchEngine: this.searchEngine,
      language: this.language
    };
  }

  getMetadata() {
    return {
      name: this.name,
      version: this.version,
      description: this.description,
      requiredEnvVars: []
    };
  }
}

export const webSearchFactory = createToolFactory(WebSearchPlugin);
