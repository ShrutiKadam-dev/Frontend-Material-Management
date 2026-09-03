import { SelectOption } from '../models/select-option.model';

export type { SelectOption };

/**
 * Standard International Commercial Terms (Incoterms 2020)
 */
export const INCOTERMS_OPTIONS: SelectOption<string>[] = [
  { label: 'EXW - Ex Works', value: 'EXW' },
  { label: 'FOB - Free on Board', value: 'FOB' },
  { label: 'CIF - Cost, Insurance and Freight', value: 'CIF' },
  { label: 'CPT - Carriage Paid To', value: 'CPT' },
  { label: 'CIP - Carriage and Insurance Paid to', value: 'CIP' },
  { label: 'FCA - Free Carrier', value: 'FCA' },
  { label: 'FAS - Free Alongside Ship', value: 'FAS' },
  { label: 'CFR - Cost and Freight', value: 'CFR' },
  { label: 'DAP - Delivered at Place', value: 'DAP' },
  { label: 'DPU - Delivered at Place Unloaded', value: 'DPU' },
  { label: 'DDP - Delivered Duty Paid', value: 'DDP' },
];

/**
 * Major world currencies with symbols
 */
export const CURRENCY_OPTIONS: SelectOption<string>[] = [
  { label: 'USD ($)', value: 'USD' },
  { label: 'INR (₹)', value: 'INR' },
  { label: 'EUR (€)', value: 'EUR' },
  { label: 'GBP (£)', value: 'GBP' },
  { label: 'AED (AED)', value: 'AED' },
  { label: 'SAR (SAR)', value: 'SAR' },
  { label: 'JPY (¥)', value: 'JPY' },
  { label: 'CNY (¥)', value: 'CNY' },
  { label: 'CAD ($)', value: 'CAD' },
  { label: 'AUD ($)', value: 'AUD' },
  { label: 'SGD ($)', value: 'SGD' },
  { label: 'CHF (CHF)', value: 'CHF' },
];

/**
 * Standard quotation and contract validity time units
 */
export const VALIDITY_UNIT_OPTIONS: SelectOption<string>[] = [
  { label: 'Days', value: 'Days' },
  { label: 'Weeks', value: 'Weeks' },
  { label: 'Months', value: 'Months' },
  { label: 'Years', value: 'Years' },
];

/**
 * Standard Units of Measure (UOM) for materials & items
 */
export const UNIT_OF_MEASURE_OPTIONS: SelectOption<string>[] = [
  { label: 'Pieces (Pcs)', value: 'Pcs' },
  { label: 'Numbers (Nos)', value: 'Nos' },
  { label: 'Kilograms (Kg)', value: 'Kg' },
  { label: 'Metric Tons (MT)', value: 'MT' },
  { label: 'Meters (m)', value: 'm' },
  { label: 'Sets', value: 'Sets' },
  { label: 'Liters (L)', value: 'L' },
  { label: 'Boxes (Box)', value: 'Box' },
  { label: 'Pallets', value: 'Pallets' },
  { label: 'Rolls', value: 'Rolls' },
  { label: 'Packs', value: 'Packs' },
];

/**
 * Standard Project & Step Status options
 */
export const PROJECT_STATUS_OPTIONS: SelectOption<string>[] = [
  { label: 'Active', value: 'Active' },
  { label: 'Pending', value: 'Pending' },
  { label: 'In Progress', value: 'In Progress' },
  { label: 'Completed', value: 'Completed' },
  { label: 'On Hold', value: 'On Hold' },
  { label: 'Cancelled', value: 'Cancelled' },
];

/**
 * Currency Symbol Lookup Map
 */
export const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = {
  USD: '$',
  INR: '₹',
  EUR: '€',
  GBP: '£',
  AED: 'AED',
  SAR: 'SAR',
  JPY: '¥',
  CNY: '¥',
  CAD: '$',
  AUD: '$',
  SGD: '$',
  CHF: 'CHF',
};

/**
 * Helper to get symbol from a currency code (e.g. 'USD' -> '$', 'INR' -> '₹')
 */
export function getCurrencySymbol(code?: string): string {
  if (!code) return '$';
  const cleanCode = code.trim().toUpperCase();
  return CURRENCY_SYMBOLS[cleanCode] || `${cleanCode} `;
}

/**
 * Helper to extract currency symbol from a formatted quotation value string (e.g. 'USD 15000' -> '$')
 */
export function getQuotationCurrencySymbol(quotationValue?: string | number): string {
  if (!quotationValue) return '$';
  const str = String(quotationValue).trim();
  const match = str.match(/^([A-Za-z]{3})\s*/);
  if (match) {
    return getCurrencySymbol(match[1]);
  }
  return '$';
}

/**
 * Formats a raw or compound currency string/number with proper symbol and comma grouping
 * Example: 'USD 15000' -> '$ 15,000.00', 25000 -> '$ 25,000.00'
 */
export function formatCurrencyAmount(value?: string | number | null, defaultCurrency = 'USD'): string {
  if (value === null || value === undefined || value === '') return '';
  const str = String(value).trim();
  const match = str.match(/^([A-Za-z]{3})\s*(.+)$/);

  if (match) {
    const code = match[1].toUpperCase();
    const num = parseFloat(match[2].replace(/,/g, ''));
    if (!isNaN(num)) {
      const sym = CURRENCY_SYMBOLS[code] ? `${CURRENCY_SYMBOLS[code]} ` : `${code} `;
      return `${sym}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return str;
  }

  const num = parseFloat(str.replace(/,/g, ''));
  if (!isNaN(num)) {
    const sym = getCurrencySymbol(defaultCurrency);
    return `${sym} ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return str;
}

/**
 * Parses a compound currency amount string like "USD 15000.00" or "15000.00"
 * into separate currency code and numerical amount string.
 */
export function parseCurrencyAmount(raw?: string | null, fallbackCurrency = 'USD'): { currency: string; amount: string } {
  if (!raw) return { currency: fallbackCurrency, amount: '' };
  const str = String(raw).trim();
  const match = str.match(/^([A-Za-z]{3})\s*(.+)$/);
  if (match) {
    return {
      currency: match[1].toUpperCase(),
      amount: match[2].trim(),
    };
  }
  return {
    currency: fallbackCurrency,
    amount: str,
  };
}

/**
 * Parses a compound validity string like "60 Days" or "5 Weeks"
 * into numerical value and validity unit.
 */
export function parseValidity(raw?: string | null, fallbackValue = '60', fallbackUnit = 'Days'): { value: string; unit: string } {
  if (!raw) return { value: fallbackValue, unit: fallbackUnit };
  const str = String(raw).trim();
  const parts = str.split(/\s+/);
  if (parts.length >= 2 && !isNaN(Number(parts[0]))) {
    return {
      value: parts[0],
      unit: parts.slice(1).join(' '),
    };
  } else if (!isNaN(Number(str))) {
    return {
      value: str,
      unit: fallbackUnit,
    };
  }
  return {
    value: fallbackValue,
    unit: str,
  };
}
