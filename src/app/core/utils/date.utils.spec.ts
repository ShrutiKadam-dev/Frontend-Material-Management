import { describe, expect, it } from 'vitest';
import {
  formatLocalDate,
  formatLocalDateTime,
  parseLocalDate,
  parseLocalDateTime,
} from './date.utils';

describe('date.utils', () => {
  describe('formatLocalDate', () => {
    it('should format a local Date to YYYY-MM-DD', () => {
      const d = new Date(2026, 8, 10); // Sept 10, 2026
      expect(formatLocalDate(d)).toBe('2026-09-10');
    });

    it('should handle Date with single digit month and day', () => {
      const d = new Date(2026, 0, 5); // Jan 5, 2026
      expect(formatLocalDate(d)).toBe('2026-01-05');
    });

    it('should preserve already formatted YYYY-MM-DD string', () => {
      expect(formatLocalDate('2026-09-10')).toBe('2026-09-10');
    });

    it('should extract YYYY-MM-DD from ISO-like string', () => {
      expect(formatLocalDate('2026-09-10T15:30:00')).toBe('2026-09-10');
    });

    it('should convert DD-MM-YYYY string to YYYY-MM-DD', () => {
      expect(formatLocalDate('10-09-2026')).toBe('2026-09-10');
      expect(formatLocalDate('10/09/2026')).toBe('2026-09-10');
    });

    it('should return empty string for null or undefined', () => {
      expect(formatLocalDate(null)).toBe('');
      expect(formatLocalDate(undefined)).toBe('');
    });
  });

  describe('formatLocalDateTime', () => {
    it('should format Date to YYYY-MM-DDTHH:mm:ss in local time', () => {
      const d = new Date(2026, 8, 10, 14, 30, 45);
      expect(formatLocalDateTime(d)).toBe('2026-09-10T14:30:45');
    });

    it('should pad single digit hours, minutes, and seconds', () => {
      const d = new Date(2026, 8, 5, 9, 5, 2);
      expect(formatLocalDateTime(d)).toBe('2026-09-05T09:05:02');
    });

    it('should return undefined for null or undefined', () => {
      expect(formatLocalDateTime(null)).toBeUndefined();
      expect(formatLocalDateTime(undefined)).toBeUndefined();
    });
  });

  describe('parseLocalDate', () => {
    it('should parse YYYY-MM-DD to local Date at midnight', () => {
      const result = parseLocalDate('2026-09-10');
      expect(result).not.toBeNull();
      expect(result!.getFullYear()).toBe(2026);
      expect(result!.getMonth()).toBe(8); // September (0-indexed)
      expect(result!.getDate()).toBe(10);
    });

    it('should parse DD-MM-YYYY to local Date at midnight', () => {
      const result = parseLocalDate('10-09-2026');
      expect(result).not.toBeNull();
      expect(result!.getFullYear()).toBe(2026);
      expect(result!.getMonth()).toBe(8);
      expect(result!.getDate()).toBe(10);
    });

    it('should parse date string with T separator', () => {
      const result = parseLocalDate('2026-09-10T00:00:00');
      expect(result).not.toBeNull();
      expect(result!.getFullYear()).toBe(2026);
      expect(result!.getMonth()).toBe(8);
      expect(result!.getDate()).toBe(10);
    });

    it('should return null for null, undefined, or empty string', () => {
      expect(parseLocalDate(null)).toBeNull();
      expect(parseLocalDate(undefined)).toBeNull();
      expect(parseLocalDate('')).toBeNull();
    });
  });

  describe('parseLocalDateTime', () => {
    it('should parse ISO datetime string', () => {
      const result = parseLocalDateTime('2026-09-10T14:30:00');
      expect(result).not.toBeNull();
      expect(result!.getFullYear()).toBe(2026);
      expect(result!.getMonth()).toBe(8);
      expect(result!.getDate()).toBe(10);
    });

    it('should return null for invalid or empty input', () => {
      expect(parseLocalDateTime(null)).toBeNull();
      expect(parseLocalDateTime('')).toBeNull();
    });
  });
});
