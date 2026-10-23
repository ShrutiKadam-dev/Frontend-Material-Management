import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';

import { AiAssistantService } from './ai-assistant.service';
import { AiQueryResponse, ChatMessage } from '../models/ai-assistant.models';

describe('AiAssistantService', () => {
  function createTestService(mockHttp: unknown) {
    const service = Object.create(AiAssistantService.prototype) as Record<string, unknown>;
    service['http'] = mockHttp;
    service['apiBaseUrl'] = 'http://localhost:5000';
    service['messages'] = signal<ChatMessage[]>([
      {
        id: 'greeting-msg',
        role: 'assistant',
        content: 'Hello! Ask me anything.',
        timestamp: new Date(),
      },
    ]);
    service['loading'] = signal<boolean>(false);
    service['error'] = signal<string | null>(null);
    service['schemaTables'] = signal([]);
    service['suggestedPrompts'] = [
      { label: 'Top 10 Customers', query: 'Show top 10 customers', category: 'customers', icon: 'pi pi-users' },
    ];
    return service as unknown as AiAssistantService;
  }

  it('should initialize with greeting message and inactive loading', () => {
    const mockHttp = { post: vi.fn(), get: vi.fn() };
    const service = createTestService(mockHttp);

    expect(service.messages().length).toBe(1);
    expect(service.messages()[0].role).toBe('assistant');
    expect(service.loading()).toBe(false);
  });

  it('should send query and record assistant table response', async () => {
    const mockResponse: AiQueryResponse = {
      success: true,
      type: 'table',
      question: 'Show top 10 customers',
      summary: 'Here are the top 10 customers',
      sql: 'SELECT id, name FROM customers LIMIT 10',
      columns: ['id', 'name'],
      rows: [{ id: 1, name: 'Stantech Corp' }],
      total_rows: 1,
      execution_time_ms: 12.3,
      error: null,
      is_refusal: false,
    };

    const mockHttp = {
      post: vi.fn().mockReturnValue(of(mockResponse)),
      get: vi.fn(),
    };

    const service = createTestService(mockHttp);

    const result = await new Promise<AiQueryResponse>((resolve) => {
      service.sendQuestion('Show top 10 customers').subscribe(resolve);
    });

    expect(mockHttp.post).toHaveBeenCalledWith(
      'http://localhost:5000/api/v1/ai-assistant/query',
      expect.objectContaining({ question: 'Show top 10 customers' }),
    );
    expect(result.success).toBe(true);
    expect(result.rows.length).toBe(1);

    const msgs = service.messages();
    expect(msgs.length).toBe(3); // Greeting + User message + Assistant message
    expect(msgs[1].role).toBe('user');
    expect(msgs[1].content).toBe('Show top 10 customers');
    expect(msgs[2].role).toBe('assistant');
    expect(msgs[2].queryResult?.sql).toBe('SELECT id, name FROM customers LIMIT 10');
  });

  it('should handle refusal for data modification gracefully', async () => {
    const refusalResponse: AiQueryResponse = {
      success: true,
      type: 'refusal',
      question: 'Delete all customers',
      summary: 'I cannot modify, delete, or update database records.',
      sql: null,
      columns: [],
      rows: [],
      total_rows: 0,
      execution_time_ms: 0.1,
      error: null,
      is_refusal: true,
    };

    const mockHttp = {
      post: vi.fn().mockReturnValue(of(refusalResponse)),
      get: vi.fn(),
    };

    const service = createTestService(mockHttp);

    await new Promise<AiQueryResponse>((resolve) => {
      service.sendQuestion('Delete all customers').subscribe(resolve);
    });

    const msgs = service.messages();
    expect(msgs[msgs.length - 1].queryResult?.is_refusal).toBe(true);
    expect(msgs[msgs.length - 1].content).toContain('cannot modify');
  });

  it('should toggle SQL view state for a message', () => {
    const mockHttp = { post: vi.fn(), get: vi.fn() };
    const service = createTestService(mockHttp);

    service.toggleSqlView('greeting-msg');
    expect(service.messages()[0].sqlExpanded).toBe(true);

    service.toggleSqlView('greeting-msg');
    expect(service.messages()[0].sqlExpanded).toBe(false);
  });

  it('should clear chat back to initial state', () => {
    const mockHttp = { post: vi.fn(), get: vi.fn() };
    const service = createTestService(mockHttp);

    service.clearChat();
    expect(service.messages().length).toBe(1);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBeNull();
  });
});
