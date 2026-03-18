/**
 * Cloudflare Worker - api.suanli.cn へのリクエスト転送 (OpenAI 互換 LLM API)
 * 
 * 機能：
 * - すべての HTTP メソッドを転送 (GET, POST, PUT, DELETE など)
 * - 元のリクエストの headers、query parameters、body を保持
 * - CORS 跨域問題の処理
 * - バックエンドの実際のアドレスを隠蔽
 * - LLM ストリーミングレスポンスをサポート (SSE - Server-Sent Events)
 */

export default {
  async fetch(request, env, ctx) {
    // ターゲット API アドレス (OpenAI 互換 LLM API)
    const TARGET_URL = 'https://api.suanli.cn';
    
    try {
      // 現在のリクエスト URL を解析
      const url = new URL(request.url);
      
      // ターゲット URL を構築 (path と query parameters を保持)
      const targetURL = `${TARGET_URL}${url.pathname}${url.search}`;
      
      // 転送リクエストの headers を作成
      const headers = new Headers(request.headers);
      
      // 転送不应该持つ headers を削除
     headers.delete('host');
     headers.delete('content-length');
     headers.delete('cf-connecting-ip');
     headers.delete('cf-ray');
     headers.delete('x-forwarded-for');
     headers.delete('x-forwarded-proto');
      
      // ターゲット host を設定
     headers.set('Host', 'api.suanli.cn');
      
      // 転送リクエストのオプションを準備
      const init = {
       method: request.method,
       headers: headers,
        duplex: 'half', // ストリーミングリクエストをサポート
      };
      
      // body を持つリクエスト (POST, PUT, PATCH など) の場合、body を転送
      if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
        const contentType = request.headers.get('content-type') || '';
        
        // ストリーミングリクエストかどうかを検出 (LLM 一般的シナリオ)
        if (contentType.includes('application/json')) {
          init.body = await request.clone().text();
        } else {
          init.body = await request.clone().text();
        }
      }
      
      // ターゲットリクエストを送信
     const response = await fetch(targetURL, init);
      
      // レスポンスステータスコードを確認、エラーの場合は詳細なエラー情報を返す
      if (response.status >= 400) {
       const errorBody = await response.text();
       console.error(`Target API returned ${response.status}:`, errorBody);
        
        return new Response(
          JSON.stringify({
            success: false,
            error: `Backend returned ${response.status}`,
          message: 'ターゲットサーバーがエラーを返しました',
            details: errorBody.substring(0, 500), // 長さを制限
          }),
          {
            status: response.status,
           headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }
      
      // レスポンス headers を作成
     const responseHeaders = new Headers(response.headers);
      
      // CORS ヘッダーを追加し、クロスドメインアクセスを許可
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', '*');
      responseHeaders.set('Access-Control-Expose-Headers', '*');
      
      // OPTIONS プリフライトリクエストを処理
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
         headers: responseHeaders,
        });
      }
      
      // ストリーミングレスポンスを処理 (SSE - Server-Sent Events)
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream') || contentType.includes('application/x-ndjson')) {
        // TransformStream を作成してストリーミングデータを処理
        const { readable, writable } = new TransformStream();
        
        // ストリーミング処理を開始
        this.streamResponse(response.body, writable).catch((error) => {
          console.error('Stream error:', error);
          writable.getWriter().abort(error);
        });
        
        return new Response(readable, {
          status: response.status,
          statusText: response.statusText,
         headers: responseHeaders,
        });
      }
      
      // 通常レスポンスを返す
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
       headers: responseHeaders,
      });
      
    } catch (error) {
      // エラー処理
      console.error('Forward request error:', error);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to forward request',
         message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 502,
         headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  },
  
  /**
   * ストリーミングレスポンスデータを処理
   * SSE イベントがクライアントに正しく渡されることを確認
   */
  async streamResponse(readable, writable) {
    if (!readable) {
      await writable.close();
      return;
    }
    
    const writer = writable.getWriter();
    const reader = readable.getReader();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        // 生データチャンクを直接転送し、SSE 形式を完全に保持
        await writer.write(value);
      }
    } catch (error) {
      console.error('Stream processing error:', error);
      throw error;
    } finally {
      await writer.close();
    }
  },
};
