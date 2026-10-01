import { RemarkPayloadItem, StepRemarkItem } from '../models/step-remark.model';

const AUTH_SESSION_KEY = 'material-management.auth-session';

/**
 * Reads stored session from localStorage to obtain the current user's name and ID.
 */
export function getCurrentUserFromStorage(): { user?: string; user_id?: number } | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    const u = session?.user;
    if (!u) return null;
    const name = typeof u.name === 'string' && u.name.trim() ? u.name.trim() : undefined;
    const uid = u.id != null && !isNaN(Number(u.id)) ? Number(u.id) : undefined;
    return {
      user: name,
      user_id: uid,
    };
  } catch {
    return null;
  }
}

/**
 * Creates a new StepRemarkItem with current user details and timestamp.
 */
export function createStepRemarkItem(
  text: string,
  user?: string,
  userId?: number
): StepRemarkItem {
  const storedUser = getCurrentUserFromStorage();
  return {
    id: `rmk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    text: text.trim(),
    created_at: new Date().toISOString(),
    user: user ?? storedUser?.user,
    user_id: userId ?? storedUser?.user_id,
  };
}

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
 * Standard parser for remarks as an array of strings or objects.
 * Converts raw remarks into StepRemarkItem[] for timeline and UI display.
 */
export function parseStepRemarks(rawRemark?: unknown, defaultDate?: string): StepRemarkItem[] {
  if (!rawRemark) {
    return [];
  }

  const safeDefaultDate = normalizeRemarkCreatedAt(defaultDate);

  // Standard approach: Array of strings or objects: `['Remark 1']` or `[{ remark: '...', user: '...', user_id: 1 }]`
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
 * Serializes remarks into standard payload format for API updates:
 * Array of RemarkPayloadItem objects containing remark text, user, user_id, and metadata.
 * Example:
 * [
 *   {
 *     "remark": "Urgent delivery required",
 *     "user": "string string",
 *     "user_id": 1
 *   }
 * ]
 */
export function serializeStepRemarks(
  remarks?: Array<
    | StepRemarkItem
    | string
    | {
        text?: string;
        remark?: string;
        user?: string;
        user_id?: number;
        id?: number | string;
        created_at?: string;
      }
  > | null,
  currentUser?: { user?: string; name?: string; user_id?: number; id?: string | number } | null
): RemarkPayloadItem[] {
  if (!remarks || !Array.isArray(remarks)) {
    return [];
  }

  const storedUser = getCurrentUserFromStorage();
  const defaultUser =
    currentUser?.user ??
    currentUser?.name ??
    storedUser?.user;
  const defaultUserId =
    currentUser?.user_id != null
      ? Number(currentUser.user_id)
      : currentUser?.id != null
      ? Number(currentUser.id)
      : storedUser?.user_id;

  return remarks
    .map((r) => {
      if (typeof r === 'string') {
        const text = r.trim();
        if (!text) return null;
        const item: RemarkPayloadItem = {
          remark: text,
          user: defaultUser,
          ...(defaultUserId != null ? { user_id: defaultUserId } : {}),
        };
        return item;
      }

      if (r && typeof r === 'object') {
        const text = (
          ('text' in r && typeof r.text === 'string' ? r.text : '') ||
          ('remark' in r && typeof r.remark === 'string' ? r.remark : '')
        ).trim();

        if (!text) return null;

        const resolvedUser = r.user || defaultUser;
        const resolvedUserId = r.user_id != null ? Number(r.user_id) : defaultUserId;

        const item: RemarkPayloadItem = {
          remark: text,
          user: resolvedUser,
          ...(resolvedUserId != null ? { user_id: resolvedUserId } : {}),
        };

        if (r.id != null) {
          const rawId = String(r.id);
          if (/^\d+$/.test(rawId)) {
            item.id = Number(rawId);
          }
        }

        if (r.created_at) {
          item.created_at = r.created_at;
        }

        return item;
      }

      return null;
    })
    .filter((item): item is RemarkPayloadItem => item !== null && item.remark.length > 0);
}
