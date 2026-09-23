export interface StructuredAddress {
  street: string;
  area?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
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

/**
 * City-to-State & Country lookup database for dynamic binding and auto-patching.
 */
export const CITY_LOCATION_DATABASE: Record<string, { state: string; country: string }> = {
  // Maharashtra
  'mumbai': { state: 'Maharashtra', country: 'India' },
  'navi mumbai': { state: 'Maharashtra', country: 'India' },
  'thane': { state: 'Maharashtra', country: 'India' },
  'pune': { state: 'Maharashtra', country: 'India' },
  'pimpri-chinchwad': { state: 'Maharashtra', country: 'India' },
  'nagpur': { state: 'Maharashtra', country: 'India' },
  'nashik': { state: 'Maharashtra', country: 'India' },
  'aurangabad': { state: 'Maharashtra', country: 'India' },
  'chhatrapati sambhaji nagar': { state: 'Maharashtra', country: 'India' },
  'solapur': { state: 'Maharashtra', country: 'India' },
  'kolhapur': { state: 'Maharashtra', country: 'India' },
  'amravati': { state: 'Maharashtra', country: 'India' },
  'nanded': { state: 'Maharashtra', country: 'India' },
  'sangli': { state: 'Maharashtra', country: 'India' },
  'jalgaon': { state: 'Maharashtra', country: 'India' },
  'akola': { state: 'Maharashtra', country: 'India' },
  'latur': { state: 'Maharashtra', country: 'India' },
  'dhule': { state: 'Maharashtra', country: 'India' },
  'ahmednagar': { state: 'Maharashtra', country: 'India' },
  'chandrapur': { state: 'Maharashtra', country: 'India' },
  'parbhani': { state: 'Maharashtra', country: 'India' },
  'jalna': { state: 'Maharashtra', country: 'India' },
  'panvel': { state: 'Maharashtra', country: 'India' },
  'satara': { state: 'Maharashtra', country: 'India' },
  'ratnagiri': { state: 'Maharashtra', country: 'India' },

  // Delhi NCR
  'delhi': { state: 'Delhi', country: 'India' },
  'new delhi': { state: 'Delhi', country: 'India' },
  'noida': { state: 'Uttar Pradesh', country: 'India' },
  'greater noida': { state: 'Uttar Pradesh', country: 'India' },
  'ghaziabad': { state: 'Uttar Pradesh', country: 'India' },
  'gurgaon': { state: 'Haryana', country: 'India' },
  'gurugram': { state: 'Haryana', country: 'India' },
  'faridabad': { state: 'Haryana', country: 'India' },

  // Karnataka
  'bengaluru': { state: 'Karnataka', country: 'India' },
  'bangalore': { state: 'Karnataka', country: 'India' },
  'mysuru': { state: 'Karnataka', country: 'India' },
  'mysore': { state: 'Karnataka', country: 'India' },
  'mangaluru': { state: 'Karnataka', country: 'India' },
  'mangalore': { state: 'Karnataka', country: 'India' },
  'hubballi': { state: 'Karnataka', country: 'India' },
  'hubli': { state: 'Karnataka', country: 'India' },
  'dharwad': { state: 'Karnataka', country: 'India' },
  'belagavi': { state: 'Karnataka', country: 'India' },
  'belgaum': { state: 'Karnataka', country: 'India' },
  'kalaburagi': { state: 'Karnataka', country: 'India' },
  'gulbarga': { state: 'Karnataka', country: 'India' },
  'ballari': { state: 'Karnataka', country: 'India' },
  'bellary': { state: 'Karnataka', country: 'India' },
  'davangere': { state: 'Karnataka', country: 'India' },
  'shivamogga': { state: 'Karnataka', country: 'India' },
  'shimoga': { state: 'Karnataka', country: 'India' },
  'tumakuru': { state: 'Karnataka', country: 'India' },
  'tumkur': { state: 'Karnataka', country: 'India' },
  'udupi': { state: 'Karnataka', country: 'India' },

  // Tamil Nadu
  'chennai': { state: 'Tamil Nadu', country: 'India' },
  'madras': { state: 'Tamil Nadu', country: 'India' },
  'coimbatore': { state: 'Tamil Nadu', country: 'India' },
  'madurai': { state: 'Tamil Nadu', country: 'India' },
  'tiruchirappalli': { state: 'Tamil Nadu', country: 'India' },
  'trichy': { state: 'Tamil Nadu', country: 'India' },
  'salem': { state: 'Tamil Nadu', country: 'India' },
  'tiruppur': { state: 'Tamil Nadu', country: 'India' },
  'erode': { state: 'Tamil Nadu', country: 'India' },
  'vellore': { state: 'Tamil Nadu', country: 'India' },
  'tirunelveli': { state: 'Tamil Nadu', country: 'India' },
  'thoothukudi': { state: 'Tamil Nadu', country: 'India' },
  'tuticorin': { state: 'Tamil Nadu', country: 'India' },
  'dindigul': { state: 'Tamil Nadu', country: 'India' },
  'thanjavur': { state: 'Tamil Nadu', country: 'India' },
  'hosur': { state: 'Tamil Nadu', country: 'India' },

  // Telangana
  'hyderabad': { state: 'Telangana', country: 'India' },
  'secunderabad': { state: 'Telangana', country: 'India' },
  'warangal': { state: 'Telangana', country: 'India' },
  'nizamabad': { state: 'Telangana', country: 'India' },
  'karimnagar': { state: 'Telangana', country: 'India' },
  'khammam': { state: 'Telangana', country: 'India' },
  'ramagundam': { state: 'Telangana', country: 'India' },

  // Andhra Pradesh
  'visakhapatnam': { state: 'Andhra Pradesh', country: 'India' },
  'vizag': { state: 'Andhra Pradesh', country: 'India' },
  'vijayawada': { state: 'Andhra Pradesh', country: 'India' },
  'guntur': { state: 'Andhra Pradesh', country: 'India' },
  'nellore': { state: 'Andhra Pradesh', country: 'India' },
  'kurnool': { state: 'Andhra Pradesh', country: 'India' },
  'kakinada': { state: 'Andhra Pradesh', country: 'India' },
  'rajahmundry': { state: 'Andhra Pradesh', country: 'India' },
  'tirupati': { state: 'Andhra Pradesh', country: 'India' },
  'kadapa': { state: 'Andhra Pradesh', country: 'India' },
  'anantapur': { state: 'Andhra Pradesh', country: 'India' },

  // Gujarat
  'ahmedabad': { state: 'Gujarat', country: 'India' },
  'surat': { state: 'Gujarat', country: 'India' },
  'vadodara': { state: 'Gujarat', country: 'India' },
  'baroda': { state: 'Gujarat', country: 'India' },
  'rajkot': { state: 'Gujarat', country: 'India' },
  'bhavnagar': { state: 'Gujarat', country: 'India' },
  'jamnagar': { state: 'Gujarat', country: 'India' },
  'junagadh': { state: 'Gujarat', country: 'India' },
  'gandhinagar': { state: 'Gujarat', country: 'India' },
  'anand': { state: 'Gujarat', country: 'India' },
  'navsari': { state: 'Gujarat', country: 'India' },
  'morbi': { state: 'Gujarat', country: 'India' },
  'bharuch': { state: 'Gujarat', country: 'India' },
  'vapi': { state: 'Gujarat', country: 'India' },
  'ankleshwar': { state: 'Gujarat', country: 'India' },

  // West Bengal
  'kolkata': { state: 'West Bengal', country: 'India' },
  'calcutta': { state: 'West Bengal', country: 'India' },
  'howrah': { state: 'West Bengal', country: 'India' },
  'siliguri': { state: 'West Bengal', country: 'India' },
  'durgapur': { state: 'West Bengal', country: 'India' },
  'asansol': { state: 'West Bengal', country: 'India' },
  'bardhaman': { state: 'West Bengal', country: 'India' },
  'malda': { state: 'West Bengal', country: 'India' },
  'kharagpur': { state: 'West Bengal', country: 'India' },
  'haldia': { state: 'West Bengal', country: 'India' },

  // Uttar Pradesh
  'lucknow': { state: 'Uttar Pradesh', country: 'India' },
  'kanpur': { state: 'Uttar Pradesh', country: 'India' },
  'varanasi': { state: 'Uttar Pradesh', country: 'India' },
  'banaras': { state: 'Uttar Pradesh', country: 'India' },
  'agra': { state: 'Uttar Pradesh', country: 'India' },
  'prayagraj': { state: 'Uttar Pradesh', country: 'India' },
  'allahabad': { state: 'Uttar Pradesh', country: 'India' },
  'meerut': { state: 'Uttar Pradesh', country: 'India' },
  'bareilly': { state: 'Uttar Pradesh', country: 'India' },
  'aligarh': { state: 'Uttar Pradesh', country: 'India' },
  'moradabad': { state: 'Uttar Pradesh', country: 'India' },
  'saharanpur': { state: 'Uttar Pradesh', country: 'India' },
  'gorakhpur': { state: 'Uttar Pradesh', country: 'India' },
  'firozabad': { state: 'Uttar Pradesh', country: 'India' },
  'jhansi': { state: 'Uttar Pradesh', country: 'India' },
  'muzaffarnagar': { state: 'Uttar Pradesh', country: 'India' },
  'mathura': { state: 'Uttar Pradesh', country: 'India' },

  // Rajasthan
  'jaipur': { state: 'Rajasthan', country: 'India' },
  'jodhpur': { state: 'Rajasthan', country: 'India' },
  'kota': { state: 'Rajasthan', country: 'India' },
  'bikaner': { state: 'Rajasthan', country: 'India' },
  'ajmer': { state: 'Rajasthan', country: 'India' },
  'udaipur': { state: 'Rajasthan', country: 'India' },
  'bhilwara': { state: 'Rajasthan', country: 'India' },
  'alwar': { state: 'Rajasthan', country: 'India' },
  'sikar': { state: 'Rajasthan', country: 'India' },
  'pali': { state: 'Rajasthan', country: 'India' },
  'bharatpur': { state: 'Rajasthan', country: 'India' },

  // Madhya Pradesh
  'bhopal': { state: 'Madhya Pradesh', country: 'India' },
  'indore': { state: 'Madhya Pradesh', country: 'India' },
  'jabalpur': { state: 'Madhya Pradesh', country: 'India' },
  'gwalior': { state: 'Madhya Pradesh', country: 'India' },
  'ujjain': { state: 'Madhya Pradesh', country: 'India' },
  'sagar': { state: 'Madhya Pradesh', country: 'India' },
  'dewas': { state: 'Madhya Pradesh', country: 'India' },
  'satna': { state: 'Madhya Pradesh', country: 'India' },
  'ratlam': { state: 'Madhya Pradesh', country: 'India' },
  'rewa': { state: 'Madhya Pradesh', country: 'India' },

  // Kerala
  'thiruvananthapuram': { state: 'Kerala', country: 'India' },
  'trivandrum': { state: 'Kerala', country: 'India' },
  'kochi': { state: 'Kerala', country: 'India' },
  'cochin': { state: 'Kerala', country: 'India' },
  'kozhikode': { state: 'Kerala', country: 'India' },
  'calicut': { state: 'Kerala', country: 'India' },
  'thrissur': { state: 'Kerala', country: 'India' },
  'kollam': { state: 'Kerala', country: 'India' },
  'palakkad': { state: 'Kerala', country: 'India' },
  'alappuzha': { state: 'Kerala', country: 'India' },
  'kannur': { state: 'Kerala', country: 'India' },
  'kottayam': { state: 'Kerala', country: 'India' },

  // Punjab & Haryana & Chandigarh
  'chandigarh': { state: 'Chandigarh', country: 'India' },
  'ludhiana': { state: 'Punjab', country: 'India' },
  'amritsar': { state: 'Punjab', country: 'India' },
  'jalandhar': { state: 'Punjab', country: 'India' },
  'patiala': { state: 'Punjab', country: 'India' },
  'bathinda': { state: 'Punjab', country: 'India' },
  'mohali': { state: 'Punjab', country: 'India' },
  'hoshiarpur': { state: 'Punjab', country: 'India' },
  'panipat': { state: 'Haryana', country: 'India' },
  'ambala': { state: 'Haryana', country: 'India' },
  'yamunanagar': { state: 'Haryana', country: 'India' },
  'rohtak': { state: 'Haryana', country: 'India' },
  'hisar': { state: 'Haryana', country: 'India' },
  'karnal': { state: 'Haryana', country: 'India' },
  'sonipat': { state: 'Haryana', country: 'India' },
  'panchkula': { state: 'Haryana', country: 'India' },

  // Bihar & Jharkhand
  'patna': { state: 'Bihar', country: 'India' },
  'gaya': { state: 'Bihar', country: 'India' },
  'bhagalpur': { state: 'Bihar', country: 'India' },
  'muzaffarpur': { state: 'Bihar', country: 'India' },
  'bihar sharif': { state: 'Bihar', country: 'India' },
  'darbhanga': { state: 'Bihar', country: 'India' },
  'ranchi': { state: 'Jharkhand', country: 'India' },
  'jamshedpur': { state: 'Jharkhand', country: 'India' },
  'dhanbad': { state: 'Jharkhand', country: 'India' },
  'bokaro': { state: 'Jharkhand', country: 'India' },
  'deoghar': { state: 'Jharkhand', country: 'India' },

  // Odisha & Chhattisgarh
  'bhubaneswar': { state: 'Odisha', country: 'India' },
  'cuttack': { state: 'Odisha', country: 'India' },
  'rourkela': { state: 'Odisha', country: 'India' },
  'berhampur': { state: 'Odisha', country: 'India' },
  'sambalpur': { state: 'Odisha', country: 'India' },
  'puri': { state: 'Odisha', country: 'India' },
  'balasore': { state: 'Odisha', country: 'India' },
  'raipur': { state: 'Chhattisgarh', country: 'India' },
  'bhilai': { state: 'Chhattisgarh', country: 'India' },
  'bilaspur': { state: 'Chhattisgarh', country: 'India' },
  'korba': { state: 'Chhattisgarh', country: 'India' },

  // Uttarakhand & Himachal Pradesh & J&K
  'dehradun': { state: 'Uttarakhand', country: 'India' },
  'haridwar': { state: 'Uttarakhand', country: 'India' },
  'roorkee': { state: 'Uttarakhand', country: 'India' },
  'haldwani': { state: 'Uttarakhand', country: 'India' },
  'rudrapur': { state: 'Uttarakhand', country: 'India' },
  'rishikesh': { state: 'Uttarakhand', country: 'India' },
  'shimla': { state: 'Himachal Pradesh', country: 'India' },
  'dharamshala': { state: 'Himachal Pradesh', country: 'India' },
  'mandi': { state: 'Himachal Pradesh', country: 'India' },
  'solan': { state: 'Himachal Pradesh', country: 'India' },
  'kullu': { state: 'Himachal Pradesh', country: 'India' },
  'srinagar': { state: 'Jammu and Kashmir', country: 'India' },
  'jammu': { state: 'Jammu and Kashmir', country: 'India' },

  // Goa & Others
  'panaji': { state: 'Goa', country: 'India' },
  'margao': { state: 'Goa', country: 'India' },
  'vasco da gama': { state: 'Goa', country: 'India' },
  'mapusa': { state: 'Goa', country: 'India' },
  'guwahati': { state: 'Assam', country: 'India' },
  'silchar': { state: 'Assam', country: 'India' },
  'dibrugarh': { state: 'Assam', country: 'India' },
  'jorhat': { state: 'Assam', country: 'India' },
  'agartala': { state: 'Tripura', country: 'India' },
  'imphal': { state: 'Manipur', country: 'India' },
  'shillong': { state: 'Meghalaya', country: 'India' },
  'aizawl': { state: 'Mizoram', country: 'India' },
  'kohima': { state: 'Nagaland', country: 'India' },
  'gangtok': { state: 'Sikkim', country: 'India' },
  'itanagar': { state: 'Arunachal Pradesh', country: 'India' },
  'puducherry': { state: 'Puducherry', country: 'India' },
  'pondicherry': { state: 'Puducherry', country: 'India' },

  // Major International Hubs
  'dubai': { state: 'Dubai', country: 'United Arab Emirates' },
  'abu dhabi': { state: 'Abu Dhabi', country: 'United Arab Emirates' },
  'singapore': { state: 'Singapore', country: 'Singapore' },
  'london': { state: 'Greater London', country: 'United Kingdom' },
  'new york': { state: 'New York', country: 'United States' },
  'tokyo': { state: 'Tokyo', country: 'Japan' },
  'shanghai': { state: 'Shanghai', country: 'China' },
  'shenzhen': { state: 'Guangdong', country: 'China' },
  'frankfurt': { state: 'Hesse', country: 'Germany' },
  'paris': { state: 'Île-de-France', country: 'France' },
  'sydney': { state: 'New South Wales', country: 'Australia' },
  'toronto': { state: 'Ontario', country: 'Canada' },
};

/**
 * List of suggested cities for the datalist autocomplete.
 */
export const POPULAR_CITIES: string[] = [
  'Ahmedabad',
  'Amritsar',
  'Aurangabad',
  'Bengaluru',
  'Bhopal',
  'Bhubaneswar',
  'Chandigarh',
  'Chennai',
  'Coimbatore',
  'Dehradun',
  'Delhi',
  'Faridabad',
  'Ghaziabad',
  'Goa',
  'Greater Noida',
  'Gurgaon',
  'Guwahati',
  'Gwalior',
  'Haridwar',
  'Hubballi',
  'Hyderabad',
  'Indore',
  'Jabalpur',
  'Jaipur',
  'Jalandhar',
  'Jamshedpur',
  'Jodhpur',
  'Kanpur',
  'Kochi',
  'Kolkata',
  'Kota',
  'Kozhikode',
  'Lucknow',
  'Ludhiana',
  'Madurai',
  'Mangaluru',
  'Meerut',
  'Mohali',
  'Mumbai',
  'Mysuru',
  'Nagpur',
  'Nashik',
  'Navi Mumbai',
  'New Delhi',
  'Noida',
  'Panaji',
  'Panipat',
  'Patna',
  'Pune',
  'Raipur',
  'Rajkot',
  'Ranchi',
  'Rishikesh',
  'Rourkela',
  'Salem',
  'Secunderabad',
  'Shimla',
  'Srinagar',
  'Surat',
  'Thane',
  'Thiruvananthapuram',
  'Tiruchirappalli',
  'Tirupati',
  'Tiruppur',
  'Udaipur',
  'Vadodara',
  'Vapi',
  'Varanasi',
  'Vijayawada',
  'Visakhapatnam',
  'Warangal',
  'Dubai',
  'Abu Dhabi',
  'Singapore',
  'London',
  'New York',
];

/**
 * Looks up State and Country based on city name.
 */
export function lookupCityLocation(
  cityInput: string | null | undefined,
): { state: string; country: string } | null {
  if (!cityInput || typeof cityInput !== 'string') {
    return null;
  }
  const clean = cityInput.trim().toLowerCase();
  if (!clean) {
    return null;
  }

  // Exact match
  if (CITY_LOCATION_DATABASE[clean]) {
    return CITY_LOCATION_DATABASE[clean];
  }

  // Alias or prefix search
  if (clean.length >= 3) {
    const directKey = Object.keys(CITY_LOCATION_DATABASE).find(
      (k) => k === clean || clean.startsWith(k) || k.startsWith(clean),
    );
    if (directKey) {
      return CITY_LOCATION_DATABASE[directKey];
    }
  }

  return null;
}

