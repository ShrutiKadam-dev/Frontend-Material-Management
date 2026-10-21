import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, Observable, tap, throwError } from 'rxjs';

import { API_BASE_URL } from '../../../core/tokens/api-base-url.token';
import {
  AiQueryRequest,
  AiQueryResponse,
  ChatMessage,
  SchemaResponse,
  SchemaTable,
  SuggestedPrompt,
} from '../models/ai-assistant.models';

const INITIAL_GREETING: ChatMessage = {
  id: 'greeting-msg',
  role: 'assistant',
  content:
    'Hello! I am your Read-Only Database Assistant. Ask me anything about your material management data—such as customers, suppliers, active projects, purchase orders, or financial summaries.',
  timestamp: new Date(),
};

@Injectable({
  providedIn: 'root',
})
export class AiAssistantService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  readonly messages = signal<ChatMessage[]>([INITIAL_GREETING]);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly schemaTables = signal<SchemaTable[]>([]);

  readonly suggestedPrompts: SuggestedPrompt[] = [
    {
      label: 'Top 10 Customers',
      query: 'Show me the top 10 customers sorted by most recent entry.',
      category: 'customers',
      icon: 'pi pi-users',
    },
    {
      label: 'Active Projects',
      query: 'List all client projects with their customer names and current status.',
      category: 'projects',
      icon: 'pi pi-briefcase',
    },
    {
      label: 'Supplier Contacts',
      query: 'List all registered suppliers and their contact details.',
      category: 'suppliers',
      icon: 'pi pi-truck',
    },
    {
      label: 'Customer Count',
      query: 'How many total customers are registered in the database?',
      category: 'analytics',
      icon: 'pi pi-chart-bar',
    },
    {
      label: 'Recent Payments',
      query: 'Show recent customer payments with payment mode and amount.',
      category: 'analytics',
      icon: 'pi pi-dollar',
    },
  ];

  sendQuestion(question: string): Observable<AiQueryResponse> {
    const trimmed = question.trim();
    if (!trimmed) {
      return throwError(() => new Error('Question cannot be empty.'));
    }

    const userMessage: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    // Update conversation with user's message
    this.messages.update((msgs) => [...msgs, userMessage]);
    this.loading.set(true);
    this.error.set(null);

    // Build recent conversation context (last 4 items)
    const history = this.messages()
      .slice(-4)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    const payload: AiQueryRequest = {
      question: trimmed,
      history,
    };

    return this.http
      .post<AiQueryResponse>(`${this.apiBaseUrl}/api/v1/ai-assistant/query`, payload)
      .pipe(
        tap((response) => {
          this.loading.set(false);

          let assistantText = response.summary;
          if (!assistantText) {
            if (response.is_refusal) {
              assistantText = response.error || 'Request refused.';
            } else if (response.error) {
              assistantText = response.error;
            } else if (response.total_rows === 0) {
              assistantText = 'No matching records were found in the database.';
            } else {
              assistantText = `Found ${response.total_rows} record(s).`;
            }
          }

          const assistantMessage: ChatMessage = {
            id: `ai-${Date.now()}`,
            role: 'assistant',
            content: assistantText,
            timestamp: new Date(),
            queryResult: response,
            sqlExpanded: false,
          };

          this.messages.update((msgs) => [...msgs, assistantMessage]);
        }),
        catchError((err: unknown) => {
          this.loading.set(false);
          const errorMessage =
            'An error occurred while connecting to the AI Assistant. Please ensure the backend is reachable.';
          this.error.set(errorMessage);

          const errorChatMessage: ChatMessage = {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: errorMessage,
            timestamp: new Date(),
            queryResult: {
              success: false,
              type: 'error',
              question: trimmed,
              summary: null,
              sql: null,
              columns: [],
              rows: [],
              total_rows: 0,
              execution_time_ms: 0,
              error: errorMessage,
              is_refusal: false,
            },
          };

          this.messages.update((msgs) => [...msgs, errorChatMessage]);
          return throwError(() => err);
        }),
      );
  }

  fetchSchema(): Observable<SchemaResponse> {
    return this.http
      .get<SchemaResponse>(`${this.apiBaseUrl}/api/v1/ai-assistant/schema`)
      .pipe(
        tap((res) => {
          this.schemaTables.set(res.tables || []);
        }),
      );
  }

  clearChat(): void {
    this.messages.set([INITIAL_GREETING]);
    this.error.set(null);
    this.loading.set(false);
  }

  toggleSqlView(messageId: string): void {
    this.messages.update((msgs) =>
      msgs.map((m) => (m.id === messageId ? { ...m, sqlExpanded: !m.sqlExpanded } : m)),
    );
  }
}
