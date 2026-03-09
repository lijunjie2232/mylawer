export interface LegalQuestion {
  question: string;
  category?: string;
  userId?: string;
  model?: string;
}

export interface LegalResponse {
  answer: string;
  confidence?: number;
  sources?: string[];
  timestamp: Date;
}

export interface AssistantConfig {
  modelName: string;
  maxTokens: number;
  temperature: number;
  tools?: string[];
}

// 模型相关接口
export interface ModelInfo {
  name: string;
  displayName: string;
  provider: string;
  description?: string;
  isEnabled: boolean;
  isHealthy?: boolean;
  responseTime?: number;
}

export interface ModelListResponse {
  models: ModelInfo[];
  defaultModel: string;
  timestamp: string;
}

// API请求/响应接口
export interface LegalQueryRequest {
  question: string;
  model?: string;
  userId?: string;
}

export interface LegalQueryResponse {
  success: boolean;
  question: string;
  answer: string;
  modelUsed?: string;
  sessionId?: string;
  timestamp: string;
  error?: string;
}

export interface ModelsApiResponse {
  success: boolean;
  models: ModelInfo[];
  defaultModel: string;
  timestamp: string;
  error?: string;
}

// LLM API 返回的原始模型数据格式
export interface LlmModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export interface LlmModelsResponse {
  object: string;
  data: LlmModel[];
}

// e-gov 法令検索 API 関連の型
export interface EGovLawInfo {
  law_type: string;
  law_id: string;
  law_num: string;
  law_num_era: string;
  law_num_year: number;
  law_num_type: string;
  law_num_num: string;
  promulgation_date: string;
}

export interface EGovRevisionInfo {
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
}

export interface EGovSentence {
  position: string;
  text: string;
}

export interface EGovLawSearchResult {
  law_info: EGovLawInfo;
  revision_info: EGovRevisionInfo;
  sentences: EGovSentence[];
}

export interface EGovLawSearchResponse {
  total_count: number;
  sentence_count: number;
  next_offset: number;
  items: EGovLawSearchResult[];
}

export interface ExtractedEGovLawResult {
  source: string; // law_revision_id
  law_title: string;
  sentence: string;
  law_id: string;
  promulgation_date: string;
  category: string;
}