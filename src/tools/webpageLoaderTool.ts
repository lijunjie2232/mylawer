import { DynamicTool } from '@langchain/core/tools';
import { Document } from '@langchain/core/documents';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Logger } from '../utils/logger.js';
import { chromium } from 'rebrowser-playwright';

interface WebpageLoadResult {
  success: boolean;
  document?: Document;
  content_length?: number;
  title?: string;
  error?: string;
}

interface WebpageLoaderToolConfig {
  usePlaywright?: boolean;
  headless?: boolean;
  language?: string;
  timeout?: number;
}

export class WebpageLoaderTool extends DynamicTool {
  private usePlaywright: boolean = true;
  private headless: boolean = false;
  private language: string = 'ja-JP';
  private timeout: number = 60000;

  constructor(config?: WebpageLoaderToolConfig) {
    const usePlaywright = config?.usePlaywright ?? false;
    const headless = config?.headless ?? false;
    const language = config?.language || 'ja-JP';
    const timeout = config?.timeout || 30000;
    

    super({
      name: 'load_webpage',
      description: `Load a webpage using ${usePlaywright ? 'Playwright browser automation' : 'axios HTTP request'}, extract text content, and convert to a LangChain Document object.`,
      func: async (input: string) => {
        return await this.loadWebpage(input);
      }
    });

    this.usePlaywright = usePlaywright;
    this.headless = headless;
    this.language = language;
    this.timeout = timeout;
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
    return 'Asia/Tokyo';
  }

  /**
   * 使用 Playwright 加载网页
   */
  private async loadWebpageWithPlaywright(url: string): Promise<string> {
    let browser;
    try {
      Logger.info('开始使用 Playwright 加载网页', { url });

      // 启动浏览器
      browser = await chromium.launch({
        headless: this.headless,
        channel: 'chrome',
        args: ['--lang=' + this.language],
        firefoxUserPrefs: {
          'intl.accept_languages': this.language,
        },
      });

      // 创建上下文并移除 webdriver 特征
      const context = await browser.newContext({
        locale: this.language,
        timezoneId: this.getTimezoneId(this.language)
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

      // 1. 阻止资源加载（网络层面）- 在请求发起前拦截图片、字体、CSS 等资源
      await page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        // 阻止图片、媒体、字体和样式表，从源头阻止数据下载，大幅提升加载速度
        if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
          route.abort();
        } else {
          route.continue();
        }
      });

      // 访问页面
      const response = await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: this.timeout
      });

      // 等待页面基本加载
      await page.waitForTimeout(1000);

      // 2. 通过 JS 注入清理 DOM（页面层面）- 清理已下载的 DOM 节点
      await page.evaluate(() => {
        // 定义需要清理的标签类型
        const tagsToRemove = ['img', 'svg', 'canvas', 'video', 'picture', 'iframe', 'object'];
              
        tagsToRemove.forEach(tag => {
          document.querySelectorAll(tag).forEach(el => el.remove());
        });
      
        // 可选：移除所有背景图片
        document.querySelectorAll('*').forEach(el => {
          // 检查是否为 HTMLElement 以访问 style 属性
          if (el instanceof HTMLElement) {
            const computedStyle = getComputedStyle(el);
            if (computedStyle.backgroundImage !== 'none') {
              el.style.backgroundImage = 'none';
            }
          }
        });
              
        // 移除空的容器元素，清理布局空隙
        document.querySelectorAll('*').forEach(el => {
          if (!el.hasChildNodes() && !el.textContent?.trim()) {
            const tagName = el.tagName.toLowerCase();
            // 保留一些可能有语义的空标签
            if (!['br', 'hr', 'input', 'meta', 'link'].includes(tagName)) {
              el.remove();
            }
          }
        });
      });

      // 等待 DOM理完成
      await page.waitForTimeout(500);

      // 获取页面内容
      const html = await page.content();
      const pageTitle = await page.title();
      const contentType = response?.headers()['content-type'] || 'unknown';

      await browser.close();

      // 使用 cheerio 解析 HTML 并提取文本
      const $ = cheerio.load(html);

      // 移除脚本和样式标签
      $('script').remove();
      $('style').remove();
      $('noscript').remove(); // 移除 noscript 标签
      $('nav').remove(); // 移除导航栏
      $('footer').remove(); // 移除页脚
      $('aside').remove(); // 移除侧边栏
      $('header').remove(); // 移除页眉（可能包含大量导航元素）

      // 提取主要内容区域
      let contentElement = $('main').first();
      if (contentElement.length === 0) {
        contentElement = $('article').first();
      }
      if (contentElement.length === 0) {
        contentElement = $('div.content, div.main, .content, .main').first();
      }
      if (contentElement.length === 0) {
        contentElement = $('body');
      }

      // 提取文本内容
      const textContent = contentElement.text().trim();

      // 如果文本内容太少，使用整个 body
      let finalText = textContent;
      if (textContent.length < 100) {
        finalText = $('body').text().trim();
      }

      // 清理文本
      finalText = finalText.replace(/\s+/g, ' ').trim();

      // 创建 LangChain Document 对象
      const doc = new Document({
        pageContent: finalText,
        metadata: {
          url,
          title: pageTitle || $('title').text().trim() || '无标题',
          source: 'webpage',
          fetchedAt: new Date().toISOString(),
          contentType
        }
      });

      const result: WebpageLoadResult = {
        success: true,
        document: doc,
        content_length: finalText.length,
        title: doc.metadata.title
      };

      Logger.info('Playwright ウェブページの読み込みに成功しました', {
        url,
        title: doc.metadata.title,
        content_length: finalText.length
      });

      return JSON.stringify(result);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      Logger.error('Playwright ウェブページの読み込みに失敗しました', { url, error: errorMessage });

      if (browser) {
        await browser.close().catch(() => { });
      }

      const result: WebpageLoadResult = {
        success: false,
        error: `Playwright ウェブページの読み込み中にエラーが発生しました：${errorMessage}`
      };

      return JSON.stringify(result);
    }
  }

  /**
   * 使用 axios 加载网页（原有方法）
   */
  private async loadWebpageWithAxios(url: string): Promise<string> {
    try {
      Logger.info('开始加载网页', { url });

      // 验证 URL 格式
      try {
        new URL(url);
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: '无效的 URL 格式'
        } as WebpageLoadResult);
      }

      // 使用 axios 获取网页内容
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: this.timeout,
        maxRedirects: 5
      });

      const html = response.data;

      // 使用 cheerio 解析 HTML 并提取文本
      const $ = cheerio.load(html);

      // 移除脚本和样式标签
      $('script').remove();
      $('style').remove();
      $('nav').remove(); // 移除导航栏
      $('footer').remove(); // 移除页脚
      $('aside').remove(); // 移除侧边栏

      // 提取主要内容区域（如果有）
      let contentElement = $('main').first();
      if (contentElement.length === 0) {
        contentElement = $('article').first();
      }
      if (contentElement.length === 0) {
        contentElement = $('div.content, div.main, .content, .main').first();
      }
      if (contentElement.length === 0) {
        contentElement = $('body');
      }

      // 提取文本内容
      const textContent = contentElement.text().trim();

      // 如果文本内容太少，使用整个body
      let finalText = textContent;
      if (textContent.length < 100) {
        finalText = $('body').text().trim();
      }

      // 清理文本（移除多余空白字符）
      finalText = finalText.replace(/\s+/g, ' ').trim();

      // 创建 LangChain Document 对象
      const doc = new Document({
        pageContent: finalText,
        metadata: {
          url,
          title: $('title').text().trim() || '无标题',
          source: 'webpage',
          fetchedAt: new Date().toISOString(),
          contentType: response.headers['content-type'] || 'unknown'
        }
      });

      const result: WebpageLoadResult = {
        success: true,
        document: doc,
        content_length: finalText.length,
        title: doc.metadata.title
      };

      Logger.info('ウェブページの読み込みに成功しました', {
        url,
        title: doc.metadata.title,
        content_length: finalText.length
      });

      return JSON.stringify(result);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      Logger.error('ウェブページの読み込みに失敗しました', { url, error: errorMessage });

      const result: WebpageLoadResult = {
        success: false,
        error: `ウェブページの読み込み中にエラーが発生しました：${errorMessage}`
      };

      return JSON.stringify(result);
    }
  }

  /**
   * 加载网页主方法（根据配置选择使用 Playwright 或 axios）
   */
  async loadWebpage(url: string): Promise<string> {
    if (this.usePlaywright) {
      return this.loadWebpageWithPlaywright(url);
    } else {
      return this.loadWebpageWithAxios(url);
    }
  }
}