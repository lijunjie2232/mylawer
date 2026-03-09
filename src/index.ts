#!/usr/bin/env node

import { LegalAgent } from './agents/legalAgent.js';
import { Logger } from './utils/logger.js';
import { config } from './config/environment.js';
import { Server } from './server.js';
import { Xvfb } from 'xvfb-ts';

class LawAssistant {
  private legalAgent: LegalAgent;

  constructor() {
    this.legalAgent = new LegalAgent();
    Logger.info('法的アシスタントが起動しました', {
      version: '1.0.0',
      model: config.llm.modelName,
      provider: config.llm.modelProvider,
      environment: config.app.env
    });
  }

  /**
   * 法律問題照会の処理（Agentモード使用、ツール呼び出し可能）
   */
  async askLegalQuestion(question: string): Promise<string> {
    return await this.legalAgent.processQuery(question);
  }

  /**
   * 複雑な法律照会の処理（Agentモード、ツール呼び出し）
   */
  async processComplexQuery(query: string): Promise<string> {
    return await this.legalAgent.processQuery(query);
  }

  /**
   * インタラクティブコマンドラインインターフェースの起動
   */
  async startCLI() {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('=== 法律アシスタント ===');
    console.log('「quit」または「exit」と入力してプログラムを終了');
    console.log('「help」と入力してヘルプ情報を表示\n');

    const askQuestion = () => {
      rl.question('法律問題を入力してください: ', async (input: string) => {
        if (input.toLowerCase() === 'quit' || input.toLowerCase() === 'exit') {
          console.log('さようなら！');
          rl.close();
          return;
        }

        if (input.toLowerCase() === 'help') {
          console.log('\nヘルプ情報:');
          console.log('- 法律関連問題を入力して回答を取得');
          console.log('- 契約、労働法、消費者権利など様々な法律相談に対応');
          console.log('- 「quit」または「exit」と入力してプログラムを終了\n');
          askQuestion();
          return;
        }

        if (!input.trim()) {
          console.log('有効な問題を入力してください');
          askQuestion();
          return;
        }

        try {
          console.log('\nご質問を処理中です...\n');

          // 問題の複雑さに応じて処理方法を選択
          let response: string;
          if (input.length > 100 || input.includes('検索') || input.includes('探す')) {
            response = await this.processComplexQuery(input);
          } else {
            response = await this.askLegalQuestion(input);
          }

          console.log('回答:');
          console.log(response);
          console.log('\n' + '='.repeat(50) + '\n');
        } catch (error) {
          console.error('問題処理中にエラーが発生しました:', error);
          console.log('\n' + '='.repeat(50) + '\n');
        }

        askQuestion();
      });
    };

    askQuestion();
  }
}

// メイン関数
async function main() {
  // 実行モードの確認
  const isServerMode = process.argv.includes('--server') || process.argv.includes('-s');

  if (isServerMode) {
    // サーバーモード
    Logger.info('サーバーモードを起動');
    const server = new Server();
    await server.start();
  } else {
    // CLI モード
    const assistant = new LawAssistant();

    // コマンドライン引数から呼び出された場合
    if (process.argv.length > 2) {
      const question = process.argv.slice(2).join(' ');
      try {
        const answer = await assistant.askLegalQuestion(question);
        console.log(answer);
      } catch (error) {
        console.error('エラー:', error);
        process.exit(1);
      }
    } else {
      // インタラクティブモードを起動
      await assistant.startCLI();
    }
  }
}

// エラー処理
process.on('unhandledRejection', (reason, promise) => {
  Logger.error('未処理の Promise 拒否', {
    reason: reason ? (reason as Error).message || reason : 'unknown',
    stack: (reason as Error)?.stack
  });
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  Logger.error('キャッチされていない例外', {
    error: error ? (error as Error).message || error : 'unknown',
    stack: (error as Error)?.stack
  });
  process.exit(1);
});

// アプリケーションを起動
// ESM モードでは import.meta.url を使用
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('index.ts') ||
  process.argv[1].endsWith('index.js')
);

if (isMainModule) {
  (async () => {
    const xvfb = new Xvfb();
    try {
      // Start the virtual display
      await xvfb.start();
      Logger.info('Virtual display started');

      // プロセス終了時に Xvfb を停止
      process.on('exit', () => {
        xvfb.stop();
        Logger.info('Virtual display stopped on exit');
      });

      process.on('SIGINT', () => {
        Logger.info('Received SIGINT, stopping...');
        xvfb.stop();
        Logger.info('Virtual display stopped');
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        Logger.info('Received SIGTERM, stopping...');
        xvfb.stop();
        Logger.info('Virtual display stopped');
        process.exit(0);
      });

      await main();
    } catch (error: any) {
      // 详细的错误处理
      console.error('=== 启动错误详情 ===');
      console.error('Error value:', error);
      console.error('Error type:', typeof error);
      console.error('Error constructor:', error?.constructor?.name);
      console.error('Error message:', error?.message);
      console.error('Error stack:', error?.stack);
      console.error('Error keys:', Object.keys(error || {}));
      console.error('===================');
      
      Logger.error('アプリケーション起動失敗', {
        error: error ? (error as Error).message || error : 'unknown',
        stack: (error as Error)?.stack,
        errorType: typeof error,
        errorCode: (error as any)?.code,
        errorErrno: (error as any)?.errno
      });
      
      xvfb.stop();
      Logger.info('Virtual display stopped on error');
      process.exit(1);
    }
  })();
}

export { LawAssistant };