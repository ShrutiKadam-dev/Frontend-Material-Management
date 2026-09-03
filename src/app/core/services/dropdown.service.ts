import { Injectable, signal } from '@angular/core';
import { SelectOption } from '../models/select-option.model';
import {
  CURRENCY_OPTIONS,
  CURRENCY_SYMBOLS,
  INCOTERMS_OPTIONS,
  PROJECT_STATUS_OPTIONS,
  UNIT_OF_MEASURE_OPTIONS,
  VALIDITY_UNIT_OPTIONS,
  formatCurrencyAmount,
  getCurrencySymbol,
  getQuotationCurrencySymbol,
  parseCurrencyAmount,
  parseValidity,
} from '../constants/dropdown-options.constant';

@Injectable({
  providedIn: 'root',
})
export class DropdownService {
  /** Reactive signals holding standard option lists */
  readonly incoterms = signal<SelectOption<string>[]>(INCOTERMS_OPTIONS);
  readonly currencies = signal<SelectOption<string>[]>(CURRENCY_OPTIONS);
  readonly validityUnits = signal<SelectOption<string>[]>(VALIDITY_UNIT_OPTIONS);
  readonly unitsOfMeasure = signal<SelectOption<string>[]>(UNIT_OF_MEASURE_OPTIONS);
  readonly projectStatuses = signal<SelectOption<string>[]>(PROJECT_STATUS_OPTIONS);
  readonly currencySymbols = signal<Record<string, string>>(CURRENCY_SYMBOLS);

  /**
   * Currency Symbol Lookup
   */
  getCurrencySymbol(code?: string): string {
    return getCurrencySymbol(code);
  }

  /**
   * Currency Symbol from compound quotation value
   */
  getQuotationCurrencySymbol(quotationValue?: string | number): string {
    return getQuotationCurrencySymbol(quotationValue);
  }

  /**
   * Currency Amount Formatter
   */
  formatCurrencyAmount(value?: string | number | null, defaultCurrency = 'USD'): string {
    return formatCurrencyAmount(value, defaultCurrency);
  }

  /**
   * Compound currency string parser
   */
  parseCurrencyAmount(raw?: string | null, fallbackCurrency = 'USD'): { currency: string; amount: string } {
    return parseCurrencyAmount(raw, fallbackCurrency);
  }

  /**
   * Validity string parser
   */
  parseValidity(raw?: string | null, fallbackValue = '60', fallbackUnit = 'Days'): { value: string; unit: string } {
    return parseValidity(raw, fallbackValue, fallbackUnit);
  }
}
