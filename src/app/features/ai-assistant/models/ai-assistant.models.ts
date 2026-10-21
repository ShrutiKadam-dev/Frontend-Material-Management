export interface AiQueryRequest {
  question: string;
  history?: Array<{ role: string; content: string }>;
}

export interface AiQueryResponse {
  success: boolean;
  type: 'table' | 'refusal' | 'error' | 'validation_error' | 'execution_error';
  question: string;
  summary: string | null;
  sql: string | null;
  columns: string[];
  rows: Record<string, unknown>[];
  total_rows: number;
  execution_time_ms: number;
  error: string | null;
  is_refusal: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  queryResult?: AiQueryResponse;
  sqlExpanded?: boolean;
}

export interface SuggestedPrompt {
  label: string;
  query: string;
  category: 'customers' | 'suppliers' | 'projects' | 'analytics';
  icon: string;
}

export interface SchemaTableColumn {
  name: string;
  type: string;
  nullable: boolean;
  primary_key: boolean;
  foreign_key: string | null;
}

export interface SchemaTable {
  name: string;
  description: string | null;
  columns: SchemaTableColumn[];
}

export interface SchemaResponse {
  tables: SchemaTable[];
}
