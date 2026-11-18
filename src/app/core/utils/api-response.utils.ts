const NON_SUBSTANTIVE_ENVELOPE_KEYS = new Set([
  'message',
  'success',
  'status',
  'statusCode',
  'status_code',
  'code',
  'count',
  'total',
  'data',
  'error',
  'errors',
  'detail',
  'timestamp',
  'path',
]);

/**
 * Returns true if the given response object represents an API error envelope,
 * e.g. `{ error: { code: 'NOT_FOUND', message: '...' }, success: false }`.
 */
export function isApiErrorEnvelope(obj: Record<string, unknown> | null | undefined): boolean {
  if (!obj || typeof obj !== 'object') return false;
  if (obj['success'] === false) return true;
  if ('error' in obj) {
    const err = obj['error'];
    if (err !== null && err !== undefined && err !== false && err !== '') {
      if (typeof err !== 'object' || Object.keys(err as Record<string, unknown>).length > 0) {
        return true;
      }
    }
  }
  if (Array.isArray(obj['errors']) && obj['errors'].length > 0) {
    return true;
  }
  return false;
}

/**
 * Returns true if the object contains actual entity fields rather than only
 * status/error envelope metadata or empty values.
 */
export function hasSubstantiveRecordData(obj: Record<string, unknown> | null | undefined): boolean {
  if (!obj || typeof obj !== 'object' || isApiErrorEnvelope(obj)) {
    return false;
  }

  const substantiveKeys = Object.keys(obj).filter((k) => !NON_SUBSTANTIVE_ENVELOPE_KEYS.has(k));
  if (substantiveKeys.length === 0) {
    return false;
  }

  if (Boolean(obj['id'])) {
    return true;
  }

  return substantiveKeys.some((k) => {
    const val = obj[k];
    if (val === null || val === undefined || val === '') return false;
    if (Array.isArray(val)) return val.length > 0;
    return true;
  });
}

/**
 * Unwraps a `/latest` API response into a substantive record object, or returns
 * `null` when the API returned an error envelope (`success: false` / `error`),
 * `data: null`, an empty array, or an object with no substantive record data.
 */
export function unwrapLatestApiRecord(res: unknown): Record<string, unknown> | null {
  if (!res || typeof res !== 'object') {
    return null;
  }

  if (Array.isArray(res)) {
    if (res.length === 0) return null;
    const first = res[0];
    if (!first || typeof first !== 'object' || Array.isArray(first)) return null;
    const rec = first as Record<string, unknown>;
    return hasSubstantiveRecordData(rec) ? rec : null;
  }

  const resObj = res as Record<string, unknown>;
  if (isApiErrorEnvelope(resObj)) {
    return null;
  }

  let item: Record<string, unknown> | null = null;
  if ('data' in resObj) {
    const rawData = resObj['data'];
    if (rawData === null || rawData === undefined || rawData === '') {
      return null;
    }

    const outerSubstantive: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(resObj)) {
      if (!NON_SUBSTANTIVE_ENVELOPE_KEYS.has(k)) {
        outerSubstantive[k] = v;
      }
    }

    if (typeof rawData === 'string') {
      try {
        const parsed: unknown = JSON.parse(rawData);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return null;
        }
        const parsedObj = parsed as Record<string, unknown>;
        if (isApiErrorEnvelope(parsedObj)) {
          return null;
        }
        item = { ...outerSubstantive, ...parsedObj };
      } catch {
        return null;
      }
    } else if (Array.isArray(rawData)) {
      if (rawData.length === 0) return null;
      const first = rawData[0];
      if (!first || typeof first !== 'object' || Array.isArray(first)) return null;
      const firstObj = first as Record<string, unknown>;
      if (isApiErrorEnvelope(firstObj)) return null;
      item = firstObj;
    } else if (typeof rawData === 'object') {
      const dataObj = rawData as Record<string, unknown>;
      if (isApiErrorEnvelope(dataObj)) {
        return null;
      }
      item = { ...outerSubstantive, ...dataObj };
    }
  } else {
    item = resObj;
  }

  if (!item || typeof item !== 'object') {
    return null;
  }

  return hasSubstantiveRecordData(item) ? item : null;
}
