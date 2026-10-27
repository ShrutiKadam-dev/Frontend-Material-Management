import { describe, expect, it } from 'vitest';
import {
  formatDisplayDate,
  formatLocalDate,
  formatLocalDateTime,
  parseLocalDate,
  parseLocalDateTime,
  sanitizePayloadDates,
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

  describe('formatDisplayDate', () => {
    it('should preserve and return DD-MM-YYYY string as-is', () => {
      expect(formatDisplayDate('16-05-2025')).toBe('16-05-2025');
      expect(formatDisplayDate('01-12-2026')).toBe('01-12-2026');
    });

    it('should format YYYY-MM-DD string to DD-MM-YYYY', () => {
      expect(formatDisplayDate('2025-05-16')).toBe('16-05-2025');
    });

    it('should format DD/MM/YYYY or DD.MM.YYYY string to DD-MM-YYYY', () => {
      expect(formatDisplayDate('16/05/2025')).toBe('16-05-2025');
      expect(formatDisplayDate('16.05.2025')).toBe('16-05-2025');
    });

    it('should format local Date object to DD-MM-YYYY', () => {
      const d = new Date(2025, 4, 16);
      expect(formatDisplayDate(d)).toBe('16-05-2025');
    });

    it('should format ISO datetime string to DD-MM-YYYY', () => {
      expect(formatDisplayDate('2026-09-22T03:46:19.783392')).toBe('22-09-2026');
    });

    it('should format SQL datetime string with space separator', () => {
      expect(formatDisplayDate('2026-09-22 03:46:19.783392')).toBe('22-09-2026');
    });

    it('should support d MMMM yyyy format', () => {
      expect(formatDisplayDate('16-05-2025', 'd MMMM yyyy')).toBe('16 May 2025');
      expect(formatDisplayDate('2025-05-16', 'd MMMM yyyy')).toBe('16 May 2025');
    });

    it('should support dd-MM-yyyy, HH:mm format', () => {
      expect(formatDisplayDate('2026-09-10T14:30:00', 'dd-MM-yyyy, HH:mm')).toBe('10-09-2026, 14:30');
    });

    it('should format 1/10/2026 accurately to 01-10-2026 without shifting to 30/09/2026', () => {
      const d = new Date(2026, 9, 1); // 1 October 2026
      expect(formatDisplayDate(d)).toBe('01-10-2026');
      expect(formatDisplayDate('2026-10-01')).toBe('01-10-2026');
      expect(formatDisplayDate('1/10/2026')).toBe('01-10-2026');
    });

    it('should return fallback for null, undefined, or empty string', () => {
      expect(formatDisplayDate(null)).toBe('—');
      expect(formatDisplayDate(undefined)).toBe('—');
      expect(formatDisplayDate('')).toBe('—');
      expect(formatDisplayDate(null, 'dd-MM-yyyy', '')).toBe('');
    });
  });

  describe('sanitizePayloadDates', () => {
    it('should convert local Date object for 1/10/2026 to 2026-10-01 string preventing UTC shift to 30/09/2026', () => {
      const payload = {
        pqb_issuing_date: new Date(2026, 9, 1), // Oct 1, 2026
        pqb_title: 'National Pre-Qualification Bid (PQB)',
        items: [
          { sr_no: 1, delivery_date: new Date(2026, 9, 15) },
        ],
      };

      const result = sanitizePayloadDates(payload, [
        { key: 'pqb_issuing_date', type: 'date' },
        { key: 'pqb_title', type: 'text' },
      ], [
        { key: 'delivery_date', type: 'date' },
      ]);

      expect(result.pqb_issuing_date).toBe('2026-10-01');
      expect(result.pqb_title).toBe('National Pre-Qualification Bid (PQB)');
      expect(result.items[0].delivery_date).toBe('2026-10-15');

      // Crucially, JSON.stringify must produce "2026-10-01", NOT "2026-09-30T18:30:00.000Z"
      const json = JSON.stringify(result);
      expect(json).toContain('"pqb_issuing_date":"2026-10-01"');
      expect(json).not.toContain('2026-09-30');
    });

    it('should convert datetime field to local ISO string without converting to UTC', () => {
      const payload = {
        pqb_closing_date_time: new Date(2026, 9, 1, 14, 30, 0),
      };

      const result = sanitizePayloadDates(payload, [
        { key: 'pqb_closing_date_time', type: 'datetime' },
      ]);

      expect(result.pqb_closing_date_time).toBe('2026-10-01T14:30:00');
    });
  });
});

