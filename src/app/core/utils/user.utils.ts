import { User } from '../models/user.model';

/**
 * Formats a string to Title Case if it is all lowercase.
 * Keeps acronyms/all-uppercase strings as-is (e.g. "STC").
 * Discards OpenAPI/Swagger placeholder values such as "string".
 */
export function formatNameTitleCase(val?: string | null): string {
  if (!val) return '';
  const trimmed = val.trim();
  if (!trimmed || trimmed.toLowerCase() === 'string') return '';

  if (trimmed === trimmed.toLowerCase()) {
    return trimmed
      .split(/\s+/)
      .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ''))
      .join(' ');
  }
  return trimmed;
}

/**
 * Extracts a human-readable name from an email local-part.
 * Example: "shruti.kadam@stcpl.com" -> "Shruti Kadam"
 */
export function extractNameFromEmail(email?: string | null): string {
  if (!email) return '';
  const localPart = email.split('@')[0] || '';
  if (!localPart || localPart.toLowerCase() === 'string') return '';

  const segments = localPart.split(/[._-]+/).filter(Boolean);
  return segments
    .map((s) => formatNameTitleCase(s))
    .filter(Boolean)
    .join(' ');
}

/**
 * Resolves the full display name (First Name + Last Name) for a user.
 * 1. Combines explicit `first_name`/`firstName` and `last_name`/`lastName` if available.
 * 2. Formats and validates `user.name` if present and not a placeholder "string".
 * 3. Falls back to extracting name from `user.email`.
 * 4. Defaults to "Admin" if no valid name can be determined.
 */
export function resolveUserDisplayName(user?: User | null): string {
  if (!user) {
    return 'Admin';
  }

  // 1. Try explicit first and last name fields
  const first = formatNameTitleCase(user.first_name);
  const last = formatNameTitleCase(user.last_name);
  const fromParts = [first, last].filter(Boolean).join(' ');
  if (fromParts) {
    return fromParts;
  }

  // 2. Try user.name (filter out dummy "string" tokens)
  if (user.name && user.name.trim().toLowerCase() !== 'string') {
    const parts = user.name
      .trim()
      .split(/\s+/)
      .filter((part) => part.toLowerCase() !== 'string')
      .map((part) => formatNameTitleCase(part))
      .filter(Boolean);

    const fromName = parts.join(' ');
    if (fromName) {
      return fromName;
    }
  }

  // 3. Fallback to extracting name from email local part
  const fromEmail = extractNameFromEmail(user.email);
  if (fromEmail) {
    return fromEmail;
  }

  return 'Admin';
}

/**
 * Returns a time-appropriate greeting based on the hour.
 */
export function resolveTimeGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 12 && hour < 17) {
    return 'Good afternoon';
  } else if (hour >= 17) {
    return 'Good evening';
  }
  return 'Good morning';
}
