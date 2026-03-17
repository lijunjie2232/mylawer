import { DynamicTool } from '@langchain/core/tools';
import { chromium } from 'rebrowser-playwright';
import { Logger } from '../utils/logger.js';
import * as cheerio from 'cheerio';

interface BingSearchResult {
  title: string;
  url: string;
  abstract: string;
  position: number;
}

interface WebSearchToolConfig {
  maxResults?: number;
  headless?: boolean;
  searchEngine?: 'bing' | 'google' | 'yahoo';
  language?: string;  // 例如：'ja-JP', 'en-US', 'zh-CN'
}

export class WebSearchTool extends DynamicTool {
  private maxResults: number;
  private headless: boolean;
  private searchEngine: 'bing' | 'google' | 'yahoo';
  private language: string;  // 浏览器语言设置

  constructor(config?: WebSearchToolConfig) {
    const maxResults = config?.maxResults || 3;
    const headless = config?.headless ?? false;
    const searchEngine = config?.searchEngine || 'bing';
    const language = config?.language || 'ja-JP';  // 默认日语

    super({
      name: 'bing_search',
      description: `使用${searchEngine}搜索引擎进行搜索，返回最多${maxResults}个相关结果（包含 URL、标题和摘要）`,
      func: async (input: string) => {
        return await this.search(input);
      }
    });

    this.maxResults = maxResults;
    this.headless = headless;
    this.searchEngine = searchEngine;
    this.language = language;
  }

  /**
   * 根据语言代码获取时区 ID
   */
  private getTimezoneId(language: string): string {
    const lang = language.toLowerCase();
    if (lang.startsWith('ja')) return 'Asia/Tokyo';
    if (lang.startsWith('zh')) return 'Asia/Shanghai';
    if (lang.startsWith('en')) return 'America/New_York';
    if (lang.startsWith('ko')) return 'Asia/Seoul';
    if (lang.startsWith('fr')) return 'Europe/Paris';
    if (lang.startsWith('de')) return 'Europe/Berlin';
    if (lang.startsWith('es')) return 'Europe/Madrid';
    return 'Asia/Tokyo';  // 默认日本时区
  }

  /**
   * 获取搜索引擎的 URL
   */
  private getSearchUrl(query: string): string {
    switch (this.searchEngine) {
      case 'google': {
        // Google: 使用 hl 参数指定界面语言，gl 指定地区
        const googleLang = this.language.split('-')[0] || 'ja';  // 从 ja-JP 提取 ja
        const googleRegion = this.language.split('-')[1] || 'JP';
        const baseUrl = 'https://www.google.com/search';
        const url = new URL(baseUrl);
        url.searchParams.append('q', query);
        url.searchParams.append('hl', googleLang);
        url.searchParams.append('gl', googleRegion.toUpperCase());
        return url.toString();
      }
      case 'yahoo': {
        // Yahoo Japan: 使用 ei=UTF-8 和 fr 参数
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
        // Bing: 使用 setlang 指定语言，cc 指定地区
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

  /**
   * 解析搜索结果页面
   */
  private parseSearchResults(html: string): BingSearchResult[] {
    const $ = cheerio.load(html);
    const results: BingSearchResult[] = [];

    if (this.searchEngine === 'bing') {
      // Bing 搜索结果选择器
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
      // Google 搜索结果选择器 - 使用多种选择器以适应不同的页面布局
      const resultSelectors = ['div.g', 'div.tF2Cxc', 'div.yuRUbf', '[data-header-feature="0"]'];

      for (const selector of resultSelectors) {
        $(selector).each((index, element) => {
          if (results.length >= this.maxResults) return; // 跳过多余的结果

          const titleElement = $(element).find('h3 a, a h3').first();
          const title = titleElement.text().trim();
          let url = titleElement.attr('href') || $(element).find('a').first().attr('href') || '';

          // 如果是相对 URL，转换为绝对 URL
          if (url.startsWith('/url?q=')) {
            const urlMatch = url.match(/\/url\?q=([^&]+)/);
            if (urlMatch && urlMatch[1]) {
              url = decodeURIComponent(urlMatch[1]);
            }
          }

          // 尝试多种可能的摘要选择器
          let abstract = '';
          const abstractSelectors = ['.VwiC3b', 'div.VwiC3b', 'span.yDYNvb', '.yDYNvb', 'div[data-sncf]', 'span[data-sncf]'];
          for (const absSelector of abstractSelectors) {
            abstract = $(element).find(absSelector).first().text().trim();
            if (abstract) break;
          }

          // 如果还是找不到摘要，尝试获取所有文本
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
      // Yahoo Japan 搜索结果选择器
      // 主要结果容器：.sw-CardBase.Algo（非广告）和 .sw-CardBase.Ad（广告）
      $('.sw-CardBase').each((index, element) => {
        if (results.length >= this.maxResults) return;

        // 跳过广告（带有 Ad 类的）
        if ($(element).hasClass('Ad')) {
          return;
        }

        const titleElement = $(element).find('.sw-Card__title a').first();
        const title = titleElement.text().trim();
        let url = titleElement.attr('href') || '';

        // 提取真实 URL（去除 Yahoo 的重定向链接）
        if (url.includes('search.yahoo.co.jp/clear.gif')) {
          // 从 ping 属性或其他地方提取真实 URL
          const realUrl = $(element).find('.sw-Card__title a').attr('data-cl-params');
          if (realUrl && realUrl.includes('targurl:')) {
            const match = realUrl.match(/targurl:([^;]+)/);
            if (match && match[1]) {
              url = decodeURIComponent(match[1].replace(/%3A/g, ':').replace(/%2F/g, '/'));
            }
          }
        }

        // 尝试多种可能的摘要选择器
        let abstract = '';
        const abstractSelectors = ['.sw-Card__summary', '.Algo__summary', 'p.sw-Card__summary'];
        for (const selector of abstractSelectors) {
          abstract = $(element).find(selector).first().text().trim();
          if (abstract) break;
        }

        // 如果还是找不到摘要，尝试获取所有文本并清理
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

  /**
   * 执行搜索
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

    Logger.info('开始搜索', {
      query,
      searchEngine: this.searchEngine,
      maxResults: this.maxResults
    });

    let browser;
    try {
      // 启动浏览器
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
        proxy: { server: "socks5://172.17.0.1:7890" },
      });

      // 创建上下文并移除 webdriver 特征
      const context = await browser.newContext({
        // locale: this.language,  // 设置浏览器区域
        // timezoneId: this.getTimezoneId(this.language)  // 根据语言设置时区
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

        // 设置语言偏好
        Object.defineProperty(navigator, 'language', {
          get: () => window.navigator.language || 'ja-JP'
        });

        Object.defineProperty(navigator, 'languages', {
          get: () => [window.navigator.language || 'ja-JP']
        });
      });

      const page = await context.newPage();

      // 设置用户代理
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': `${this.language},${this.language.split('-')[0] || 'ja'};q=0.9,en;q=0.8`
      });

      // 访问搜索页面
      const searchUrl = this.getSearchUrl(query);
      Logger.info('访问搜索 URL', { url: searchUrl });

      await page.goto(searchUrl, {
        waitUntil: 'networkidle',
        timeout: 60000
      });

      // 等待搜索结果加载
      await page.waitForTimeout(5000);

      // 获取页面内容
      const content = await page.content();

      // 解析搜索结果
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

  /**
   * 获取原始搜索结果数组
   */
  async getRawResults(query: string): Promise<BingSearchResult[]> {
    const resultJson = await this.search(query);
    const result = JSON.parse(resultJson);

    if (result.success && result.results) {
      return result.results as BingSearchResult[];
    }

    return [];
  }
}