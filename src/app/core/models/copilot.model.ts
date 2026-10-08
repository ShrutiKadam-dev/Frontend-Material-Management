export type CopilotSender = 'user' | 'assistant' | 'system';

export interface CopilotAction {
  label: string;
  icon?: string;
  route?: string;
  queryParams?: Record<string, string | number>;
  actionType?: 'navigate' | 'query' | 'external';
  payload?: string;
}

export interface CopilotMessage {
  id: string;
  sender: CopilotSender;
  text: string;
  timestamp: string;
  actions?: CopilotAction[];
  isError?: boolean;
  provider?: 'ollama' | 'gemini' | 'rule_based' | 'simulation';
  model?: string;
}

export interface CopilotContext {
  currentRoute: string;
  projectId?: number | null;
  stepId?: number | null;
  stepName?: string | null;
}

export interface CopilotRuntimeDiagnosis {
  ollamaConnected: boolean;
  ollamaUrl: string;
  availableModels: string[];
  activeModel: string | null;
  preferredModel: string;
  geminiConfigured: boolean;
  activeProvider: 'ollama' | 'gemini' | 'rule_based';
  statusMessage: string;
  checkedAt: string;
}

export interface CopilotChatRequest {
  message: string;
  context?: CopilotContext;
  conversationHistory?: Array<{ role: 'user' | 'model'; parts: string }>;
}

export interface CopilotChatResponse {
  reply: string;
  actions?: CopilotAction[];
  suggestedFollowUps?: string[];
  provider?: 'ollama' | 'gemini' | 'rule_based';
  model?: string;
  diagnosis?: CopilotRuntimeDiagnosis;
}
