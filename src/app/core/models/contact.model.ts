export interface PointOfContact {
  name: string;
  email: string;
  contact_number: string;
  designation?: string;
}

/**
 * Extracts base company name and nickname if formatted as "Company Name [NICK]" or "Company Name (NICK)".
 */
export function extractNameAndNickname(fullName: string | null | undefined): {
  name: string;
  nickname: string;
} {
  if (!fullName) return { name: '', nickname: '' };
  const trimmed = fullName.trim();
  const bracketMatch = trimmed.match(/^(.*?)\s*\[(.*?)\]$/);
  if (bracketMatch) {
    return { name: bracketMatch[1].trim(), nickname: bracketMatch[2].trim() };
  }
  const parenMatch = trimmed.match(/^(.*?)\s*\((.*?)\)$/);
  if (parenMatch) {
    return { name: parenMatch[1].trim(), nickname: parenMatch[2].trim() };
  }
  return { name: trimmed, nickname: '' };
}

/**
 * Formats company name with nickname into a single string for storage.
 */
export function formatNameWithNickname(name: string, nickname?: string | null): string {
  const cleanName = (name || '').trim();
  const cleanNick = (nickname || '').trim();
  if (!cleanNick) return cleanName;
  return `${cleanName} [${cleanNick}]`;
}

/**
 * Delimiter used to embed structured POCs into the persistent address field.
 */
export const POC_DELIMITER = '\n---\nPOCs:';

/**
 * Encodes structured postal address and POCs into a single storage string.
 */
export function formatAddressWithPocs(baseAddress: string, pocs: PointOfContact[]): string {
  const cleanAddress = (baseAddress || '').split(POC_DELIMITER)[0].trim();
  if (!pocs || pocs.length === 0) {
    return cleanAddress;
  }
  const json = JSON.stringify(pocs);
  return `${cleanAddress}${POC_DELIMITER}${json}`;
}

/**
 * Extracts clean postal address string without POC metadata.
 */
export function getCleanAddress(rawAddress: string | null | undefined): string {
  if (!rawAddress) return '';
  return rawAddress.split(POC_DELIMITER)[0].trim();
}

/**
 * Extracts POCs list from an entity, inspecting embedded metadata or falling back to entity email/phone.
 */
export function extractEntityPocs(
  rawAddress: string | null | undefined,
  fallbackEmail?: string | null,
  fallbackPhone?: string | null,
  entityName?: string | null,
): PointOfContact[] {
  if (rawAddress && rawAddress.includes(POC_DELIMITER)) {
    const parts = rawAddress.split(POC_DELIMITER);
    if (parts.length > 1 && parts[1].trim()) {
      try {
        const parsed = JSON.parse(parts[1].trim());
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((p) => ({
            name: p.name || '',
            email: p.email || '',
            contact_number: p.contact_number || p.phone || '',
            designation: p.designation || '',
          }));
        }
      } catch {
        // Fallback below
      }
    }
  }

  // Fallback to top-level email/phone if available
  if (fallbackEmail || fallbackPhone) {
    const parsedName = extractNameAndNickname(entityName || '');
    return [
      {
        name: parsedName.name ? `${parsedName.name} Contact` : 'Primary Contact',
        email: fallbackEmail || '',
        contact_number: fallbackPhone || '',
        designation: 'Primary Contact',
      },
    ];
  }

  return [];
}
