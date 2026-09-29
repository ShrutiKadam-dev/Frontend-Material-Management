import { StepRemarkItem } from '../models/step-remark.model';

function normalizeRemarkCreatedAt(val?: string): string {
  if (!val) return new Date().toISOString();
  const trimmed = val.trim();
  if (!trimmed) return new Date().toISOString();
  const matchDmy = trimmed.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (matchDmy) {
    const day = parseInt(matchDmy[1], 10);
    const month = parseInt(matchDmy[2], 10) - 1;
    const year = parseInt(matchDmy[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  }
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString();
  }
  return trimmed;
}

/**
 * Standard parser for remarks as an array of strings: `['Remark 1', 'Remark 2']`.
 * Converts string array into StepRemarkItem[] for timeline and UI display.
 */
export function parseStepRemarks(rawRemark?: unknown, defaultDate?: string): StepRemarkItem[] {
  if (!rawRemark) {
    return [];
  }

  const safeDefaultDate = normalizeRemarkCreatedAt(defaultDate);

  // Standard approach: Array of strings: ['Remark 1', 'Remark 2']
  if (Array.isArray(rawRemark)) {
    return rawRemark
      .map((item: unknown, idx: number) => {
        if (typeof item === 'string') {
          const trimmed = item.trim();
          if (!trimmed) return null;
          return {
            id: `rmk-${idx + 1}`,
            text: trimmed,
            created_at: safeDefaultDate,
          };
        }
        if (item && typeof item === 'object') {
          const rec = item as Record<string, unknown>;
          const text = String(rec['text'] ?? rec['remark'] ?? '').trim();
          if (!text) return null;
          const id = rec['id'] ? String(rec['id']) : `rmk-${idx + 1}`;
          const createdAt = rec['created_at'] ? normalizeRemarkCreatedAt(String(rec['created_at'])) : safeDefaultDate;
          const user = rec['user'] ? String(rec['user']) : undefined;
          const userId = rec['user_id'] != null ? Number(rec['user_id']) : undefined;
          return {
            id,
            text,
            created_at: createdAt,
            user,
            user_id: userId,
          };
        }
        return null;
      })
      .filter((r): r is StepRemarkItem => r !== null && !!r.text.trim());
  }

  // Fallback for single string or JSON encoded string array
  if (typeof rawRemark === 'string') {
    const trimmed = rawRemark.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parseStepRemarks(parsed, defaultDate);
        }
      } catch {
        // Fallback below
      }
    }
    return [
      {
        id: 'rmk-1',
        text: trimmed,
        created_at: safeDefaultDate,
      },
    ];
  }

  return [];
}

/**
 * Serializes remarks into standard payload format:
 * Array of strings: `['Remark 1', 'Remark 2']`
 */
export function serializeStepRemarks(
  remarks?: Array<StepRemarkItem | string | { text?: string; remark?: string }> | null
): string[] {
  if (!remarks || !Array.isArray(remarks)) {
    return [];
  }

  return remarks
    .map((r) => {
      if (typeof r === 'string') {
        return r.trim();
      }
      if (r && typeof r === 'object') {
        if ('text' in r && typeof r.text === 'string') {
          return r.text.trim();
        }
        if ('remark' in r && typeof r.remark === 'string') {
          return r.remark.trim();
        }
      }
      return '';
    })
    .filter((text) => text.length > 0);
}
