import { beforeEach, describe, expect, it } from 'vitest';
import { createStepRemarkItem, getCurrentUserFromStorage, parseStepRemarks, serializeStepRemarks } from './remark.utils';
import { StepRemarkItem } from '../models/step-remark.model';

describe('remark.utils', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('parseStepRemarks', () => {
    it('should return empty array for null/undefined/empty input', () => {
      expect(parseStepRemarks(null)).toEqual([]);
      expect(parseStepRemarks(undefined)).toEqual([]);
      expect(parseStepRemarks('')).toEqual([]);
      expect(parseStepRemarks([])).toEqual([]);
    });

    it('should parse an array of strings into StepRemarkItem[]', () => {
      const input = ['First remark', 'Second remark'];
      const result = parseStepRemarks(input, '2026-09-25T10:00:00.000Z');

      expect(result.length).toBe(2);
      expect(result[0].id).toBe('rmk-1');
      expect(result[0].text).toBe('First remark');
      expect(result[0].created_at).toBe('2026-09-25T10:00:00.000Z');

      expect(result[1].id).toBe('rmk-2');
      expect(result[1].text).toBe('Second remark');
      expect(result[1].created_at).toBe('2026-09-25T10:00:00.000Z');
    });

    it('should ignore empty and whitespace-only strings', () => {
      const input = ['  ', 'Valid note', '', '   '];
      const result = parseStepRemarks(input);

      expect(result.length).toBe(1);
      expect(result[0].text).toBe('Valid note');
    });

    it('should parse single plain string into a single StepRemarkItem', () => {
      const result = parseStepRemarks('Single urgent note', '2026-09-25');
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('rmk-1');
      expect(result[0].text).toBe('Single urgent note');
      expect(result[0].created_at).toContain('2026-09-25');
    });

    it('should parse JSON-encoded array of strings', () => {
      const json = JSON.stringify(['JSON Note 1', 'JSON Note 2']);
      const result = parseStepRemarks(json);

      expect(result.length).toBe(2);
      expect(result[0].text).toBe('JSON Note 1');
      expect(result[1].text).toBe('JSON Note 2');
    });

    it('should gracefully handle objects with text or remark property and user fields', () => {
      const input = [
        { id: 'custom-1', text: 'Object note', created_at: '2026-09-24', user: 'Shruti Kadam', user_id: 1 },
        { remark: 'Remark prop note' },
      ];
      const result = parseStepRemarks(input);

      expect(result.length).toBe(2);
      expect(result[0].id).toBe('custom-1');
      expect(result[0].text).toBe('Object note');
      expect(result[0].user).toBe('Shruti Kadam');
      expect(result[0].user_id).toBe(1);
      expect(result[1].id).toBe('rmk-2');
      expect(result[1].text).toBe('Remark prop note');
    });
  });

  describe('createStepRemarkItem', () => {
    it('should create a remark item with user info from localStorage if available', () => {
      localStorage.setItem('material-management.auth-session', JSON.stringify({
        user: { id: 5, name: 'Test Operator' }
      }));

      const item = createStepRemarkItem('A new note');
      expect(item.text).toBe('A new note');
      expect(item.user).toBe('Test Operator');
      expect(item.user_id).toBe(5);
      expect(item.id).toMatch(/^rmk-/);
      expect(item.created_at).toBeTruthy();
    });
  });

  describe('serializeStepRemarks', () => {
    it('should return empty array for null/undefined/empty input', () => {
      expect(serializeStepRemarks(null)).toEqual([]);
      expect(serializeStepRemarks(undefined)).toEqual([]);
      expect(serializeStepRemarks([])).toEqual([]);
    });

    it('should serialize StepRemarkItem[] into RemarkPayloadItem[] including user and user_id', () => {
      localStorage.setItem('material-management.auth-session', JSON.stringify({
        user: { id: 1, name: 'string string' }
      }));

      const items: StepRemarkItem[] = [
        { id: 'rmk-1', text: 'Remark 1', created_at: '2026-09-25T10:00:00.000Z', user: 'string string', user_id: 1 },
        { id: '2', text: 'Remark 2', created_at: '2026-09-25T11:00:00.000Z', user: 'John Doe', user_id: 2 },
      ];
      const result = serializeStepRemarks(items);

      expect(result).toEqual([
        { remark: 'Remark 1', user: 'string string', user_id: 1, created_at: '2026-09-25T10:00:00.000Z' },
        { id: 2, remark: 'Remark 2', user: 'John Doe', user_id: 2, created_at: '2026-09-25T11:00:00.000Z' },
      ]);
    });

    it('should serialize string[] and attach current user info from session or explicit argument', () => {
      const items = ['  Note A  ', 'Note B'];
      const result = serializeStepRemarks(items, { user: 'Admin User', user_id: 42 });

      expect(result).toEqual([
        { remark: 'Note A', user: 'Admin User', user_id: 42 },
        { remark: 'Note B', user: 'Admin User', user_id: 42 },
      ]);
    });

    it('should filter out empty or whitespace-only items', () => {
      const items: any[] = [
        { text: 'Valid', user: 'string string', user_id: 1 },
        { text: '   ' },
        '',
        '   ',
        { remark: 'Another valid', user: 'string string', user_id: 1 },
      ];
      const result = serializeStepRemarks(items);

      expect(result).toEqual([
        { remark: 'Valid', user: 'string string', user_id: 1 },
        { remark: 'Another valid', user: 'string string', user_id: 1 },
      ]);
    });
  });
});
