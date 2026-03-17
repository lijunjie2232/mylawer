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
   * 言語コードからタイムゾーン ID を取得
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
   * Playwright を使用してウェブページを読み込み
   */
  private async loadWebpageWithPlaywright(url: string): Promise<string> {
    let browser;
    try {
      Logger.info('Playwright でウェブページの読み込みを開始します', { url });

      // ブラウザを起動
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
        // proxy: { server: "socks5://172.17.0.1:7890"},
      });

      // コンテキストを作成し、webdriver の特徴を削除
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

      // 1. リソースの読み込みをブロック（ネットワークレベル）- リクエストが送信される前に画像、フォント、CSS などのリソースをインターセプト
      await page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        // 画像、メディア、フォント、スタイルシートをブロックし、データダウンロードを根本から防ぎ、読み込み速度を大幅に向上
        if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
          route.abort();
        } else {
          route.continue();
        }
      });

      // ページにアクセス
      const response = await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: this.timeout
      });

      // 基本的なページの読み込みを待つ
      await page.waitForTimeout(1000);

      // 2. JS インジェクトにより DOM をクリーンアップ（ページレベル）- ダウンロード済みの DOM ノードをクリーンアップ
      await page.evaluate(() => {
        // 定义需要清理的标签类型
        const tagsToRemove = ['img', 'svg', 'canvas', 'video', 'picture', 'iframe', 'object'];
              
        tagsToRemove.forEach(tag => {
          document.querySelectorAll(tag).forEach(el => el.remove());
        });
      
        // オプション：すべての背景画像を削除
        document.querySelectorAll('*').forEach(el => {
          // HTMLElement かどうかをチェックして style プロパティにアクセス
          if (el instanceof HTMLElement) {
            const computedStyle = getComputedStyle(el);
            if (computedStyle.backgroundImage !== 'none') {
              el.style.backgroundImage = 'none';
            }
          }
        });
              
        // 空のコンテナ要素を削除してレイアウトの隙間をクリーンアップ
        document.querySelectorAll('*').forEach(el => {
          if (!el.hasChildNodes() && !el.textContent?.trim()) {
            const tagName = el.tagName.toLowerCase();
            // いくつかの意味のある空タグは保持
            if (!['br', 'hr', 'input', 'meta', 'link'].includes(tagName)) {
              el.remove();
            }
          }
        });
      });

      // DOM の処理完了を待つ
      await page.waitForTimeout(500);

      // ページコンテンツを取得
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

      // メインコンテンツエリアを抽出
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

      // テキストコンテンツが少なすぎる場合は body 全体を使用
      let finalText = textContent;
      if (textContent.length < 100) {
        finalText = $('body').text().trim();
      }

      // テキストをクリーンアップ
      finalText = finalText.replace(/\s+/g, ' ').trim();

      // LangChain Document オブジェクトを作成
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
   * axios を使用してウェブページを読み込み（元の方法）
   */
  private async loadWebpageWithAxios(url: string): Promise<string> {
    try {
      Logger.info('ウェブページの読み込みを開始します', { url });

      // URL 形式を検証
      try {
        new URL(url);
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: '無効な URL 形式'
        } as WebpageLoadResult);
      }

      // axios を使用してウェブページコンテンツを取得
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

      // cheerio を使用して HTML を解析し、テキストを抽出
      const $ = cheerio.load(html);

      // スクリプトとスタイルタグを削除
      $('script').remove();
      $('style').remove();
      $('nav').remove(); // ナビゲーションバーを削除
      $('footer').remove(); // フッターを削除
      $('aside').remove(); // サイドバーを削除

      // メインコンテンツエリアを抽出（ある場合）
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

      // テキストコンテンツを抽出
      const textContent = contentElement.text().trim();
      
      // テキストコンテンツが少なすぎる場合は body 全体を使用
      let finalText = textContent;
      if (textContent.length < 100) {
        finalText = $('body').text().trim();
      }

      // テキストをクリーンアップ（余分な空白文字を削除）
      finalText = finalText.replace(/\s+/g, ' ').trim();

      // LangChain Document オブジェクトを作成
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
   * ウェブページを読み込むメインメソッド（設定に応じて Playwright または axios を使用）
   */
  async loadWebpage(url: string): Promise<string> {
    if (this.usePlaywright) {
      return this.loadWebpageWithPlaywright(url);
    } else {
      return this.loadWebpageWithAxios(url);
    }
  }
}