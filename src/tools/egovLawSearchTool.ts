import { DynamicTool } from '@langchain/core/tools';
import { Logger } from '../utils/logger.js';
import axios from 'axios';

interface EGovLawSearchResult {
  law_info: {
    law_type: string;
    law_id: string;
    law_num: string;
    law_num_era: string;
    law_num_year: number;
    law_num_type: string;
    law_num_num: string;
    promulgation_date: string;
  };
  revision_info: {
    law_revision_id: string;
    law_type: string;
    law_title: string;
    law_title_kana: string;
    abbrev: string;
    category: string;
    updated: string;
    amendment_promulgate_date: string;
    amendment_enforcement_date: string;
    amendment_enforcement_comment: string | null;
    amendment_scheduled_enforcement_date: string | null;
    amendment_law_id: string;
    amendment_law_title: string;
    amendment_law_title_kana: string | null;
    amendment_law_num: string;
    amendment_type: string;
    repeal_status: string;
    repeal_date: string | null;
    remain_in_force: boolean;
    mission: string;
    current_revision_status: string;
  };
  sentences: Array<{
    position: string;
    text: string;
  }>;
}

interface EGovLawSearchResponse {
  total_count: number;
  sentence_count: number;
  next_offset: number;
  items: EGovLawSearchResult[];
}

interface ExtractedLawResult {
  source: string;
  law_title: string;
  sentence: string;
  law_id: string;
  promulgation_date: string;
  category: string;
}

interface EGovLawSearchToolConfig {
  maxResults?: number;
  language?: string;
}

export class EGovLawSearchTool extends DynamicTool {
  private maxResults: number;
  private language: string;
  private readonly baseUrl = 'https://laws.e-gov.go.jp/api/2/keyword';

  constructor(config?: EGovLawSearchToolConfig) {
    const maxResults = config?.maxResults || 5;
    const language = config?.language || 'ja';

    super({
      name: 'egov_law_search',
      description: `日本の e-gov 法令検索 API を使用して法令を検索し、最大${maxResults}件の結果を返します。
      法令名、条文、関連情報を抽出します。キーワードで法令を検索しますので、専門的及び抽象的で短いキーワードを使用し、
      キーワードは二つ以内。`,
      func: async (input: string) => {
        return await this.search(input);
      }
    });

    this.maxResults = maxResults;
    this.language = language;
  }

  /**
   * e-gov 法令検索を実行
   */
  async search(keyword: string): Promise<string> {
    if (!keyword.trim()) {
      return JSON.stringify({
        success: false,
        results: [],
        resultCount: 0,
        maxResults: this.maxResults,
        error: '有効なキーワードを入力してください'
      });
    }

    // limit keyword into 2 words
    keyword = keyword.split(' ').slice(0, 2).join(' ');

    Logger.info('e-gov 法令検索を開始', { 
      keyword, 
      maxResults: this.maxResults,
      language: this.language
    });

    try {
      // URL エンコードされたキーワードを使用
      const encodedKeyword = encodeURIComponent(keyword);
      const url = `${this.baseUrl}?keyword=${encodedKeyword}&response_format=json`;

      Logger.info('e-gov 法令検索を開始', { 
        keyword, 
        maxResults: this.maxResults,
        language: this.language,
        url
      });

      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; LawAssistantBot/1.0)'
        },
        timeout: 10000 // 10 秒タイムアウト
      });

      const jsonData: EGovLawSearchResponse = response.data;
      
      Logger.info('e-gov 法令検索が完了しました', { 
        keyword, 
        totalCount: jsonData.total_count,
        itemCount: jsonData.items?.length || 0 
      });

      if (!jsonData.items || jsonData.items.length === 0) {
        return JSON.stringify({
          success: true,
          results: [],
          resultCount: 0,
          total_count: jsonData.total_count || 0,
          maxResults: this.maxResults,
          message: '関連する法令が見つかりませんでした'
        });
      }

      // 結果を抽出してフォーマット
      const extractedResults: ExtractedLawResult[] = jsonData.items
        .slice(0, this.maxResults)
        .flatMap((item: EGovLawSearchResult) => {
          // 各項目の文章を抽出
          if (!item.sentences || item.sentences.length === 0) {
            return [];
          }

          return item.sentences.map(sentence => ({
            source: item.revision_info.law_revision_id,
            law_title: item.revision_info.law_title,
            sentence: this.cleanHtmlTags(sentence.text),
            law_id: item.law_info.law_id,
            promulgation_date: item.law_info.promulgation_date,
            category: item.revision_info.category || ''
          }));
        });

      const resultObj = {
        success: true,
        results: extractedResults,
        resultCount: extractedResults.length,
        total_count: jsonData.total_count,
        sentence_count: jsonData.sentence_count,
        next_offset: jsonData.next_offset,
        maxResults: this.maxResults,
        message: `${extractedResults.length}件の法令情報を正常に取得しました`
      };

      return JSON.stringify(resultObj, null, 2);

    } catch (error) {
      let errorMessage = '不明なエラー';
      
      if (axios.isAxiosError(error)) {
        // Axios 错误处理
        if (error.response) {
          errorMessage = `HTTP ${error.response.status}: ${error.response.data || error.message}`;
        } else if (error.request) {
          errorMessage = `リクエスト送信失敗：${error.message}`;
        } else {
          errorMessage = `リクエスト設定エラー：${error.message}`;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      Logger.error('e-gov 法令検索に失敗しました', { keyword, error: errorMessage });
      
      return JSON.stringify({
        success: false,
        results: [],
        resultCount: 0,
        maxResults: this.maxResults,
        error: `e-gov 法令検索の実行に失敗しました：${errorMessage}`
      });
    }
  }

  /**
   * HTML タグをクリーンアップ
   */
  private cleanHtmlTags(text: string): string {
    return text
      .replace(/<span[^>]*>/g, '')
      .replace(/<\/span>/g, '')
      .replace(/<[^>]*>/g, '');
  }

  /**
   * 生の検索結果を取得（他のツール用）
   */
  async getRawResults(keyword: string): Promise<ExtractedLawResult[]> {
    const resultJson = await this.search(keyword);
    const result = JSON.parse(resultJson);
    
    if (result.success && result.results) {
      return result.results as ExtractedLawResult[];
    }
    
    return [];
  }

  /**
   * 特定の法令 ID で検索
   */
  async searchByLawId(lawId: string): Promise<string> {
    Logger.info('法令 ID で検索', { lawId });
    
    // 実装は後日、必要に応じて追加
    return JSON.stringify({
      success: false,
      error: 'searchByLawId はまだ実装されていません'
    });
  }

  /**
   * 最大結果数を設定
   */
  setMaxResults(maxResults: number): void {
    this.maxResults = maxResults;
  }
}
