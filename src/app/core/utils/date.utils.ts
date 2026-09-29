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
    const matchYmd = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (matchYmd) {
      const y = matchYmd[1];
      const m = matchYmd[2].padStart(2, '0');
      const d = matchYmd[3].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const matchDmy = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (matchDmy) {
      const d = matchDmy[1].padStart(2, '0');
      const m = matchDmy[2].padStart(2, '0');
      const y = matchDmy[3];
      return `${y}-${m}-${d}`;
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
  const matchYmd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (matchYmd) {
    const year = parseInt(matchYmd[1], 10);
    const month = parseInt(matchYmd[2], 10) - 1;
    const day = parseInt(matchYmd[3], 10);
    return new Date(year, month, day);
  }
  const matchDmy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
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

  // Check for ISO / SQL datetime with YYYY-MM-DD
  const matchYmdTime = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (matchYmdTime) {
    const y = parseInt(matchYmdTime[1], 10);
    const m = parseInt(matchYmdTime[2], 10) - 1;
    const d = parseInt(matchYmdTime[3], 10);
    const hh = parseInt(matchYmdTime[4], 10);
    const mm = parseInt(matchYmdTime[5], 10);
    const ss = matchYmdTime[6] ? parseInt(matchYmdTime[6], 10) : 0;
    return new Date(y, m, d, hh, mm, ss);
  }

  // Check for DD-MM-YYYY HH:mm:ss
  const matchDmyTime = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (matchDmyTime) {
    const d = parseInt(matchDmyTime[1], 10);
    const m = parseInt(matchDmyTime[2], 10) - 1;
    const y = parseInt(matchDmyTime[3], 10);
    const hh = parseInt(matchDmyTime[4], 10);
    const mm = parseInt(matchDmyTime[5], 10);
    const ss = matchDmyTime[6] ? parseInt(matchDmyTime[6], 10) : 0;
    return new Date(y, m, d, hh, mm, ss);
  }

  const parsedLocal = parseLocalDate(str);
  if (parsedLocal) return parsedLocal;

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Safely formats any date (Date object, DD-MM-YYYY string, YYYY-MM-DD string, ISO string, timestamp)
 * for display without throwing Angular DatePipe NG02100 InvalidPipeArgument errors.
 */
export function formatDisplayDate(
  val: Date | string | number | null | undefined,
  format = 'dd-MM-yyyy',
  fallback = '—',
): string {
  if (val === null || val === undefined || val === '') return fallback;

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return fallback;

    // Fast path: if string is already DD-MM-YYYY and format is dd-MM-yyyy, return as is
    if (format === 'dd-MM-yyyy' && /^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
      return trimmed;
    }

    // Fast path: if string is DD/MM/YYYY or DD.MM.YYYY and format is dd-MM-yyyy
    const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (dmyMatch && format === 'dd-MM-yyyy') {
      const d = dmyMatch[1].padStart(2, '0');
      const m = dmyMatch[2].padStart(2, '0');
      const y = dmyMatch[3];
      return `${d}-${m}-${y}`;
    }
  }

  let dateObj: Date | null = null;
  if (val instanceof Date) {
    dateObj = isNaN(val.getTime()) ? null : val;
  } else if (typeof val === 'number') {
    const d = new Date(val);
    dateObj = isNaN(d.getTime()) ? null : d;
  } else if (typeof val === 'string') {
    dateObj = parseLocalDateTime(val) || parseLocalDate(val);
  }

  if (!dateObj || isNaN(dateObj.getTime())) {
    return typeof val === 'string' && val.trim() ? val.trim() : fallback;
  }

  const dayNum = dateObj.getDate();
  const dayStr = String(dayNum).padStart(2, '0');
  const monthNum = dateObj.getMonth();
  const monthStr = String(monthNum + 1).padStart(2, '0');
  const yearStr = String(dateObj.getFullYear());
  const hoursStr = String(dateObj.getHours()).padStart(2, '0');
  const minutesStr = String(dateObj.getMinutes()).padStart(2, '0');

  if (format === 'dd-MM-yyyy') {
    return `${dayStr}-${monthStr}-${yearStr}`;
  }
  if (format.includes('HH:mm') || format.includes('hh:mm')) {
    return `${dayStr}-${monthStr}-${yearStr}, ${hoursStr}:${minutesStr}`;
  }
  if (format === 'd MMMM yyyy') {
    return `${dayNum} ${MONTH_NAMES_FULL[monthNum]} ${yearStr}`;
  }
  if (format === 'd MMM yyyy') {
    return `${dayNum} ${MONTH_NAMES_SHORT[monthNum]} ${yearStr}`;
  }

  return `${dayStr}-${monthStr}-${yearStr}`;
}
