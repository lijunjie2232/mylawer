import { BaseMessage, RemoveMessage } from "@langchain/core/messages";
import { REMOVE_ALL_MESSAGES } from "@langchain/langgraph";

/**
 * メッセージトリミングミドルウェア
 * コンテキスト長を制御し、LLMの最大コンテキストウィンドウを超えないように防止
 */
export class MessageTrimmer {
  private readonly maxTokens: number;
  private readonly strategy: TrimStrategy;
  private readonly keepRecent: number;

  constructor(options: TrimmerOptions = {}) {
    this.maxTokens = options.maxTokens || 4000;
    this.strategy = options.strategy || 'recent';
    this.keepRecent = options.keepRecent || 10;
  }

  /**
   * コンテキストウィンドウに適合するようにメッセージをトリム
   */
  public trimMessages(messages: BaseMessage[]): BaseMessage[] {
    if (messages.length <= this.keepRecent) {
      return messages;
    }

    switch (this.strategy) {
      case 'recent':
        return this.trimByRecency(messages);
      case 'important':
        return this.trimByImportance(messages);
      case 'balanced':
        return this.trimBalanced(messages);
      default:
        return this.trimByRecency(messages);
    }
  }

  /**
   * 時間ベースのトリミング：最近のメッセージを保持
   */
  private trimByRecency(messages: BaseMessage[]): BaseMessage[] {
    // システムメッセージを保持（存在する場合）
    const systemMessages = messages.filter(msg => msg._getType() === 'system');
    
    // 最近の数メッセージを保持
    const recentMessages = messages.slice(-this.keepRecent);
    
    return [...systemMessages, ...recentMessages];
  }

  /**
   * 重要性ベースのトリミング：重要なメッセージを識別しようとする
   */
  private trimByImportance(messages: BaseMessage[]): BaseMessage[] {
    // システムメッセージを保持
    const systemMessages = messages.filter(msg => msg._getType() === 'system');
    
    // メッセージの重要性を分析（簡略版）
    const scoredMessages = messages
      .map((msg, index) => ({
        message: msg,
        score: this.calculateMessageScore(msg, index, messages.length),
        index
      }))
      .sort((a, b) => b.score - a.score);

    // 上位N個の最も重要なメッセージを取得
    const importantMessages = scoredMessages
      .slice(0, this.keepRecent)
      .sort((a, b) => a.index - b.index) // 時間順序を維持
      .map(item => item.message);

    return [...systemMessages, ...importantMessages];
  }

  /**
   * バランストリミング：複数の戦略を組み合わせる
   */
  private trimBalanced(messages: BaseMessage[]): BaseMessage[] {
    // システムメッセージを保持
    const systemMessages = messages.filter(msg => msg._getType() === 'system');
    
    // 最初のメッセージを保持（通常は初期プロンプト）
    const firstMessage = messages[0]?._getType() !== 'system' ? [messages[0]] : [];
    
    // 最後の数メッセージを保持
    const recentMessages = messages.slice(-Math.max(1, this.keepRecent - firstMessage.length));
    
    return [...systemMessages, ...firstMessage, ...recentMessages];
  }

  /**
   * メッセージの重要性スコアを計算
   */
  private calculateMessageScore(message: BaseMessage, index: number, totalLength: number): number {
    let score = 0;
    
    // 基本スコアは位置に基づく（以前のメッセージは通常より重要）
    const positionScore = (totalLength - index) / totalLength;
    score += positionScore * 0.3;
    
    // コンテンツ長スコア
    const content = typeof message.content === 'string' ? message.content : '';
    const lengthScore = Math.min(content.length / 1000, 1); // 長さスコアを標準化
    score += lengthScore * 0.2;
    
    // タイプスコア
    switch (message._getType()) {
      case 'system':
        score += 0.5; // システムメッセージが最も重要
        break;
      case 'human':
        score += 0.3; // ユーザーメッセージは比較的重要
        break;
      case 'ai':
        score += 0.4; // AIレスポンスは重要
        break;
      default:
        score += 0.1;
    }
    
    // キーワードスコア
    const importantKeywords = ['重要', '关键', '必須', '重要性', '核心', '主要'];
    const keywordScore = importantKeywords.some(keyword => 
      content.includes(keyword)
    ) ? 0.2 : 0;
    score += keywordScore;
    
    return score;
  }

  /**
   * メッセージのトークン数を推定（簡略版）
   */
  public estimateTokens(messages: BaseMessage[]): number {
    return messages.reduce((total, message) => {
      const content = typeof message.content === 'string' ? message.content : '';
      // 簡略化されたトークン推定：各文字約0.25トークン
      return total + Math.ceil(content.length * 0.25);
    }, 0);
  }

  /**
   * トリミングが必要かどうかを確認
   */
  public needsTrimming(messages: BaseMessage[]): boolean {
    const estimatedTokens = this.estimateTokens(messages);
    return estimatedTokens > this.maxTokens;
  }

  /**
   * LangGraph用の削除指示を生成
   */
  public generateRemoveInstructions(originalMessages: BaseMessage[], trimmedMessages: BaseMessage[]): RemoveMessage[] {
    const trimmedIds = new Set(trimmedMessages.map(msg => msg.id));
    const messagesToRemove = originalMessages.filter(msg => !trimmedIds.has(msg.id));
    
    if (messagesToRemove.length === 0) {
      return [];
    }

    // 特定メッセージを削除
    const validMessages = messagesToRemove.filter(msg => msg.id !== undefined);
    return validMessages.map(msg => new RemoveMessage({ id: msg.id as string }));
  }
}

/**
 * トリミング戦略列挙型
 */
type TrimStrategy = 'recent' | 'important' | 'balanced';

/**
 * トリミングオプションインターフェース
 */
interface TrimmerOptions {
  maxTokens?: number;
  strategy?: TrimStrategy;
  keepRecent?: number;
}