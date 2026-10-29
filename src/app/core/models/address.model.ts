import { getCleanAddress } from './contact.model';

export interface StructuredAddress {
  street: string;
  area?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface EntityAddressSource {
  address?: string | null;
  street?: string | null;
  area?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
}

/**
 * Formats a structured address object into a standard postal address string.
 */
export function formatStructuredAddress(addr: Partial<StructuredAddress>): string {
  const parts: string[] = [];

  const street = addr.street?.trim();
  if (street) {
    parts.push(street);
  }

  const area = addr.area?.trim();
  if (area) {
    parts.push(area);
  }

  const city = addr.city?.trim();
  const state = addr.state?.trim();
  const pin = addr.pincode?.trim();

  const localityParts: string[] = [];
  if (city) {
    localityParts.push(city);
  }

  if (state && pin) {
    localityParts.push(`${state} - ${pin}`);
  } else if (state) {
    localityParts.push(state);
  } else if (pin) {
    localityParts.push(pin);
  }

  if (localityParts.length > 0) {
    parts.push(localityParts.join(', '));
  }

  const country = addr.country?.trim();
  if (country) {
    parts.push(country);
  }

  return parts.join(', ');
}

/**
 * Formats the full address of a supplier or customer entity, gracefully handling
 * segregated address fields (street, area, city, state, pincode, country) as well
 * as legacy raw address strings.
 */
export function getEntityFullAddress(
  entity: EntityAddressSource | string | null | undefined,
): string {
  if (!entity) return '';
  if (typeof entity === 'string') {
    return getCleanAddress(entity);
  }

  const structured = formatStructuredAddress({
    street: entity.street ?? undefined,
    area: entity.area ?? undefined,
    city: entity.city ?? undefined,
    state: entity.state ?? undefined,
    pincode: entity.pincode ?? undefined,
    country: entity.country ?? undefined,
  });

  if (structured && structured.trim().length > 0) {
    return structured.trim();
  }

  if (entity.address) {
    return getCleanAddress(entity.address);
  }

  return '';
}

/**
 * Intelligently parses an address string (legacy or formatted) into structured address fields.
 */
export function parseAddressString(raw: string | null | undefined): StructuredAddress {
  const defaultAddr: StructuredAddress = {
    street: '',
    area: '',
    city: '',
    state: '',
    pincode: '',
    country: '',
  };

  if (!raw || typeof raw !== 'string') {
    return defaultAddr;
  }

  // Strip any embedded POC metadata block before parsing postal address
  const beforePocs = raw.split('\n---\nPOCs:')[0];
  const trimmed = beforePocs.trim();
  if (!trimmed) {
    return defaultAddr;
  }

  // Handle JSON format if saved as stringified object
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      return {
        street: parsed.street || '',
        area: parsed.area || '',
        city: parsed.city || '',
        state: parsed.state || '',
        pincode: parsed.pincode || parsed.pin || '',
        country: parsed.country || '',
      };
    } catch {
      // Fall through to standard parsing
    }
  }

  const tokens = trimmed.split(',').map((t) => t.trim()).filter(Boolean);

  if (tokens.length === 1) {
    return {
      ...defaultAddr,
      street: tokens[0],
    };
  }

  // Detect country from last token
  let country = '';
  const lastToken = tokens[tokens.length - 1];
  const knownCountries = [
    'india',
    'bharat',
    'usa',
    'united states',
    'uk',
    'united kingdom',
    'uae',
    'germany',
    'singapore',
    'australia',
    'canada',
    'france',
    'japan',
    'china',
  ];
  if (lastToken && knownCountries.some((c) => lastToken.toLowerCase() === c)) {
    country = tokens.pop()!;
  }

  let pincode = '';
  let state = '';
  let city = '';
  let area = '';

  // Extract PIN and State (e.g., "Maharashtra - 400705" or "400705")
  const pinRegex = /\b(\d{5,6})\b/;
  let statePinIndex = -1;

  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    const match = token.match(pinRegex);
    if (match) {
      pincode = match[1];
      statePinIndex = i;
      const statePart = token
        .replace(match[0], '')
        .replace(/[-–—]/g, '')
        .trim();
      if (statePart) {
        state = statePart;
      }
      break;
    }
  }

  if (statePinIndex !== -1) {
    tokens.splice(statePinIndex, 1);
  }

  // Next from right: State (if not already captured)
  if (!state && tokens.length > 0) {
    state = tokens.pop()!;
  }

  // Next from right: City
  if (tokens.length > 0) {
    city = tokens.pop()!;
  }

  // Next from right: Area (if more than 1 item remains for street)
  if (tokens.length > 1) {
    area = tokens.pop()!;
  }

  // Remaining tokens form the Street
  const street = tokens.join(', ');

  return {
    street: street || (area ? '' : ''),
    area: area || '',
    city: city || '',
    state: state || '',
    pincode: pincode || '',
    country: country || '',
  };
}



