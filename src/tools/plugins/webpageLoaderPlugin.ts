import { DynamicTool } from '@langchain/core/tools';
import { Document } from '@langchain/core/documents';
import { BaseToolPlugin, createToolFactory } from './basePlugin.js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Logger } from '../../utils/logger.js';
import { chromium } from 'rebrowser-playwright';

interface WebpageLoadResult {
  success: boolean;
  document?: Document;
  content_length?: number;
  title?: string;
  error?: string;
}

export class WebpageLoaderPlugin extends BaseToolPlugin {
  readonly name = 'webpage-loader';
  readonly description = '加载网页并提取文本内容';
  readonly version = '1.0.0';
  
  private usePlaywright: boolean;
  private headless: boolean;
  private language: string;
  private timeout: number;

  constructor(config?: Record<string, any>) {
    super(config);
    this.usePlaywright = config?.usePlaywright ?? false;
    this.headless = config?.headless ?? false;
    this.language = config?.language || 'ja-JP';
    this.timeout = config?.timeout || 30000;
  }

  get isEnabled(): boolean {
    const enabledVar = 'TOOL_WEBPAGE_LOADER_ENABLED';
    const envValue = process.env[enabledVar];
    
    if (envValue === 'false' || envValue === '0') {
      return false;
    }
    
    return true;
  }

  createTool(): DynamicTool {
    return new DynamicTool({
      name: 'load_webpage',
      description: `使用 ${this.usePlaywright ? 'Playwright 浏览器自动化' : 'axios HTTP 请求'} 加载网页，提取文本内容，并转换为 LangChain Document 对象。`,
      func: async (input: string) => {
        return await this.loadWebpage(input);
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

  private async loadWebpageWithPlaywright(url: string): Promise<string> {
    let browser;
    try {
      Logger.info('Playwright でウェブページの読み込みを開始します', { url });

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
        locale: this.language,
        timezoneId: this.getTimezoneId(this.language)
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

      await page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
          route.abort();
        } else {
          route.continue();
        }
      });

      const response = await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: this.timeout
      });

      await page.waitForTimeout(1000);

      await page.evaluate(() => {
        const tagsToRemove = ['img', 'svg', 'canvas', 'video', 'picture', 'iframe', 'object'];
              
        tagsToRemove.forEach(tag => {
          document.querySelectorAll(tag).forEach(el => el.remove());
        });
      
        document.querySelectorAll('*').forEach(el => {
          if (el instanceof HTMLElement) {
            const computedStyle = getComputedStyle(el);
            if (computedStyle.backgroundImage !== 'none') {
              el.style.backgroundImage = 'none';
            }
          }
        });
              
        document.querySelectorAll('*').forEach(el => {
          if (!el.hasChildNodes() && !el.textContent?.trim()) {
            const tagName = el.tagName.toLowerCase();
            if (!['br', 'hr', 'input', 'meta', 'link'].includes(tagName)) {
              el.remove();
            }
          }
        });
      });

      await page.waitForTimeout(500);

      const html = await page.content();
      const pageTitle = await page.title();
      const contentType = response?.headers()['content-type'] || 'unknown';

      await browser.close();

      const $ = cheerio.load(html);

      $('script').remove();
      $('style').remove();
      $('noscript').remove();
      $('nav').remove();
      $('footer').remove();
      $('aside').remove();
      $('header').remove();

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

      const textContent = contentElement.text().trim();

      let finalText = textContent;
      if (textContent.length < 100) {
        finalText = $('body').text().trim();
      }

      finalText = finalText.replace(/\s+/g, ' ').trim();

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

  private async loadWebpageWithAxios(url: string): Promise<string> {
    try {
      Logger.info('ウェブページの読み込みを開始します', { url });

      try {
        new URL(url);
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: '無効な URL 形式'
        } as WebpageLoadResult);
      }

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

      const $ = cheerio.load(html);

      $('script').remove();
      $('style').remove();
      $('nav').remove();
      $('footer').remove();
      $('aside').remove();

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

      const textContent = contentElement.text().trim();
      
      let finalText = textContent;
      if (textContent.length < 100) {
        finalText = $('body').text().trim();
      }

      finalText = finalText.replace(/\s+/g, ' ').trim();

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

  async loadWebpage(url: string): Promise<string> {
    if (this.usePlaywright) {
      return this.loadWebpageWithPlaywright(url);
    } else {
      return this.loadWebpageWithAxios(url);
    }
  }

  getConfig(): Record<string, any> {
    return {
      ...super.getConfig(),
      usePlaywright: this.usePlaywright,
      headless: this.headless,
      language: this.language,
      timeout: this.timeout
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

export const webpageLoaderFactory = createToolFactory(WebpageLoaderPlugin);
