import { describe, expect, it } from 'vitest';
import { parseStepRemarks, serializeStepRemarks } from './remark.utils';
import { StepRemarkItem } from '../models/step-remark.model';

describe('remark.utils', () => {
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
      expect(result[0].created_at).toBe('2026-09-25');
    });

    it('should parse JSON-encoded array of strings', () => {
      const json = JSON.stringify(['JSON Note 1', 'JSON Note 2']);
      const result = parseStepRemarks(json);

      expect(result.length).toBe(2);
      expect(result[0].text).toBe('JSON Note 1');
      expect(result[1].text).toBe('JSON Note 2');
    });

    it('should gracefully handle objects with text or remark property', () => {
      const input = [
        { id: 'custom-1', text: 'Object note', created_at: '2026-09-24' },
        { remark: 'Remark prop note' },
      ];
      const result = parseStepRemarks(input);

      expect(result.length).toBe(2);
      expect(result[0].id).toBe('custom-1');
      expect(result[0].text).toBe('Object note');
      expect(result[1].id).toBe('rmk-2');
      expect(result[1].text).toBe('Remark prop note');
    });
  });

  describe('serializeStepRemarks', () => {
    it('should return empty array for null/undefined/empty input', () => {
      expect(serializeStepRemarks(null)).toEqual([]);
      expect(serializeStepRemarks(undefined)).toEqual([]);
      expect(serializeStepRemarks([])).toEqual([]);
    });

    it('should serialize StepRemarkItem[] into string[]', () => {
      const items: StepRemarkItem[] = [
        { id: 'rmk-1', text: 'Remark 1', created_at: '2026-09-25' },
        { id: 'rmk-2', text: 'Remark 2', created_at: '2026-09-25' },
      ];
      const result = serializeStepRemarks(items);

      expect(result).toEqual(['Remark 1', 'Remark 2']);
    });

    it('should serialize string[] directly and trim strings', () => {
      const items = ['  Note A  ', 'Note B'];
      const result = serializeStepRemarks(items);

      expect(result).toEqual(['Note A', 'Note B']);
    });

    it('should filter out empty or whitespace-only items', () => {
      const items: any[] = [
        { text: 'Valid' },
        { text: '   ' },
        '',
        '   ',
        { remark: 'Another valid' },
      ];
      const result = serializeStepRemarks(items);

      expect(result).toEqual(['Valid', 'Another valid']);
    });
  });
});
