import { StepRemarkItem } from '../models/step-remark.model';

/**
 * Robust parser for remarks in any backend or local format:
 * - Array of backend objects: `[{ id: 1, remark: '...', created_at: '...' }]`
 * - Array of frontend objects: `[{ id: 'rmk-1', text: '...', created_at: '...' }]`
 * - Array of strings: `['Remark 1', 'Remark 2']`
 * - JSON encoded string: `'[{"remark":"..."}]'` or `'[{"text":"..."}]'`
 * - Plain string / legacy text: `'Urgent requirement'`
 */
export function parseStepRemarks(rawRemark?: unknown, defaultDate?: string): StepRemarkItem[] {
  if (!rawRemark) {
    return [];
  }

  if (Array.isArray(rawRemark)) {
    return rawRemark
      .map((item: unknown, idx: number) => {
        if (typeof item === 'string') {
          const trimmed = item.trim();
          if (!trimmed) return null;
          return {
            id: `rmk-${idx + 1}-${Date.now()}`,
            text: trimmed,
            created_at: defaultDate || new Date().toISOString(),
          };
        }
        if (typeof item === 'object' && item !== null) {
          const rec = item as Record<string, unknown>;
          const text = String(rec['remark'] ?? rec['text'] ?? '').trim();
          if (!text) return null;
          const id = rec['id'] ? String(rec['id']) : `rmk-${idx + 1}-${Date.now()}`;
          const createdAt = rec['created_at'] ? String(rec['created_at']) : defaultDate || new Date().toISOString();
          return {
            id,
            text,
            created_at: createdAt,
          };
        }
        return null;
      })
      .filter((r): r is StepRemarkItem => r !== null && !!r.text.trim());
  }

  if (typeof rawRemark === 'string') {
    const trimmed = rawRemark.trim();
    if (!trimmed) return [];
    if (
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('{') && trimmed.endsWith('}'))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        return parseStepRemarks(parsed, defaultDate);
      } catch {
        // Fallback below
      }
    }
    return [
      {
        id: 'legacy-1',
        text: trimmed,
        created_at: defaultDate || new Date().toISOString(),
      },
    ];
  }

  if (typeof rawRemark === 'object' && rawRemark !== null) {
    const rec = rawRemark as Record<string, unknown>;
    const text = String(rec['remark'] ?? rec['text'] ?? '').trim();
    if (text) {
      return [
        {
          id: rec['id'] ? String(rec['id']) : 'rmk-obj-1',
          text,
          created_at: rec['created_at'] ? String(rec['created_at']) : defaultDate || new Date().toISOString(),
        },
      ];
    }
  }

  return [];
}

/**
 * Serializes remarks into strict payload format expected by backend:
 * `remarks: [{ remark: "..." }]`
 * When empty, sends `[{ remark: "" }]` as requested.
 */
export function serializeStepRemarks(
  remarks: Array<StepRemarkItem | { text?: string; remark?: string }>
): Array<{ remark: string }> {
  if (!remarks || !Array.isArray(remarks)) {
    return [{ remark: '' }];
  }

  const valid = remarks
    .map((r) => {
      if ('text' in r && typeof r.text === 'string') {
        return r.text.trim();
      }
      if ('remark' in r && typeof r.remark === 'string') {
        return r.remark.trim();
      }
      return '';
    })
    .filter((text) => !!text);

  if (valid.length === 0) {
    return [{ remark: '' }];
  }

  return valid.map((remark) => ({ remark }));
}
