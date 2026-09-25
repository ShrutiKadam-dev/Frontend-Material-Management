/**
 * Date utilities for local date formatting and parsing.
 * Avoids timezone shift / UTC offset bugs where selecting a date in a positive UTC timezone (e.g. IST +05:30)
 * causes `.toISOString()` to subtract hours and shift the date back to the previous day.
 */

/**
 * Formats a Date or date string to local YYYY-MM-DD.
 * Preserves the exact day, month, and year selected by the user in their local timezone.
 */
export function formatLocalDate(val: Date | string | null | undefined): string {
  if (!val) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return '';
    const matchYmd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (matchYmd) {
      return `${matchYmd[1]}-${matchYmd[2]}-${matchYmd[3]}`;
    }
    const matchDmy = trimmed.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
    if (matchDmy) {
      return `${matchDmy[3]}-${matchDmy[2]}-${matchDmy[1]}`;
    }
    const parsed = new Date(trimmed);
    if (isNaN(parsed.getTime())) return trimmed;
    val = parsed;
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return '';
}

/**
 * Formats a Date or datetime string to local YYYY-MM-DDTHH:mm:ss.
 * Preserves the exact date and time selected by the user without converting to UTC.
 */
export function formatLocalDateTime(val: Date | string | null | undefined): string | undefined {
  if (!val) return undefined;
  let d: Date;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return undefined;
    d = new Date(trimmed);
  } else if (val instanceof Date) {
    d = val;
  } else {
    return undefined;
  }
  if (isNaN(d.getTime())) return undefined;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day}T${hh}:${mm}:${ss}`;
}

/**
 * Parses a YYYY-MM-DD or DD-MM-YYYY string into a Date object representing midnight in the local timezone.
 * Avoids the standard `new Date("YYYY-MM-DD")` behavior which parses as UTC midnight and may shift days in non-UTC timezones.
 */
export function parseLocalDate(val: string | Date | null | undefined): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  const str = String(val).trim();
  if (!str) return null;
  const matchYmd = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matchYmd) {
    const year = parseInt(matchYmd[1], 10);
    const month = parseInt(matchYmd[2], 10) - 1;
    const day = parseInt(matchYmd[3], 10);
    return new Date(year, month, day);
  }
  const matchDmy = str.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (matchDmy) {
    const day = parseInt(matchDmy[1], 10);
    const month = parseInt(matchDmy[2], 10) - 1;
    const year = parseInt(matchDmy[3], 10);
    return new Date(year, month, day);
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Parses a datetime string into a local Date object.
 */
export function parseLocalDateTime(val: string | Date | null | undefined): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  const str = String(val).trim();
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}
