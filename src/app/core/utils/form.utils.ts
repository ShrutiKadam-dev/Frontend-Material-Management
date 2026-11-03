/**
 * Form and line-item table utility functions.
 */
import { parseLocalDate, parseLocalDateTime } from './date.utils';

/**
 * Known aliases for common line-item table columns across different backend entities.
 * (e.g. CustomerQuery uses 'material_name', whereas catalog tableConfig uses 'description').
 */
export const TABLE_COLUMN_ALIASES: Record<string, string[]> = {
  description: [
    'description',
    'material_name',
    'item_description',
    'itemDescription',
    'material_description',
    'item_name',
    'name',
    'details',
    'item',
    'particulars',
    'desc',
  ],
  material_name: [
    'material_name',
    'description',
    'item_description',
    'itemDescription',
    'material_description',
    'item_name',
    'name',
  ],
  item_code: ['item_code', 'itemCode', 'code', 'part_number', 'hsn_code', 'hsn_sac'],
  quantity: ['quantity', 'qty', 'count', 'units'],
  unit: ['unit', 'uom', 'unit_of_measure', 'unit_type'],
  unit_price: ['unit_price', 'unit_rate', 'rate', 'price', 'cost_per_unit', 'price_per_unit_inr', 'pricePerUnitInrExclGst'],
  price_per_unit_eur: ['price_per_unit_eur', 'pricePerUnitEur', 'price_eur', 'unit_price_eur', 'price_per_unit', 'pricePerUnit'],
  total_price_eur: ['total_price_eur', 'totalPriceEur', 'total_eur', 'totalPrice'],
  insurance_freight_eur: ['insurance_freight_eur', 'insuranceFreightEur', 'insurance_freight'],
  landed_cost_eur: ['landed_cost_eur', 'landedCostEur'],
  landed_cost_inr: ['landed_cost_inr', 'landedCostInr', 'landed_cost'],
  customs_duty_inr: ['customs_duty_inr', 'customsDutyInr', 'custom_duty_amount', 'custom_duty_inr', 'customs_duty'],
  igst_inr: ['igst_inr', 'igstInr', 'igst_amount', 'igst'],
  transportation_inr: ['transportation_inr', 'transportationInr', 'transportation_amount', 'transportation'],
  financing_charges_inr: ['financing_charges_inr', 'financingChargesInr', 'finance_charges_amount', 'finance_charges_inr', 'financing_charges'],
  total_cost_inr: ['total_cost_inr', 'totalCostInr', 'total_cost'],
  less_igst_inr: ['less_igst_inr', 'lessIgstInr', 'cost_without_igst', 'costWithoutIgst'],
  margin_inr: ['margin_inr', 'marginInr', 'margin_amount', 'margin'],
  selling_price_excl_gst: ['selling_price_excl_gst', 'sellingPriceExclGst', 'selling_price', 'total_selling_price', 'selling_price_without_gst'],
  selling_price_incl_gst: ['selling_price_incl_gst', 'sellingPriceInclGst', 'grand_total_incl_gst', 'grandTotalInclGst', 'selling_price_with_gst'],
  customs_duty_rate: ['customs_duty_rate', 'customsDutyRate', 'custom_duty_pct', 'duty_pct', 'customsDutyPct'],
  total_amount: ['total_amount', 'total_price', 'total', 'amount', 'line_total', 'selling_price_excl_gst', 'sellingPriceExclGst'],
  total_price: ['total_price', 'total_amount', 'total', 'amount', 'line_total', 'selling_price_excl_gst'],
  hsn_sac: ['hsn_sac', 'hsn_code', 'hsn', 'sac', 'sac_code'],
  delivery_date: ['delivery_date', 'expected_delivery_date', 'delivery_time'],
  unit_weight: ['unit_weight', 'weight_per_unit', 'unit_wt'],
  total_weight: ['total_weight', 'gross_weight', 'total_wt', 'weight'],
};

/**
 * Extracts a column value from a table row object, checking direct match and known aliases.
 */
export function getTableRowCellValue(
  row: Record<string, unknown> | null | undefined,
  colKey: string,
): unknown {
  if (!row || typeof row !== 'object') return undefined;

  // 1. Direct match
  if (row[colKey] !== undefined && row[colKey] !== null && row[colKey] !== '') {
    return row[colKey];
  }

  // 2. Alias match
  const aliases = TABLE_COLUMN_ALIASES[colKey];
  if (aliases) {
    for (const alias of aliases) {
      if (row[alias] !== undefined && row[alias] !== null && row[alias] !== '') {
        return row[alias];
      }
    }
  }

  return row[colKey];
}

/**
 * Normalizes a table row so that both canonical keys (e.g. description, material_name)
 * are populated for compatibility with both UI table configs and various backend REST models.
 */
export function normalizeTableRow(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...row };

  const desc = getTableRowCellValue(row, 'description');
  if (desc !== undefined && desc !== null && desc !== '') {
    if (!result['description']) result['description'] = desc;
    if (!result['material_name']) result['material_name'] = desc;
  }

  const icode = getTableRowCellValue(row, 'item_code');
  if (icode !== undefined && icode !== null && icode !== '') {
    if (!result['item_code']) result['item_code'] = icode;
  }

  const qty = getTableRowCellValue(row, 'quantity');
  if (qty !== undefined && qty !== null && qty !== '') {
    if (result['quantity'] === undefined || result['quantity'] === null || result['quantity'] === '') {
      result['quantity'] = qty;
    }
  }

  const pEur = getTableRowCellValue(row, 'price_per_unit_eur');
  if (pEur !== undefined && pEur !== null && pEur !== '') {
    if (result['price_per_unit_eur'] === undefined || result['price_per_unit_eur'] === null || result['price_per_unit_eur'] === '') {
      result['price_per_unit_eur'] = pEur;
    }
  }

  // Cost sheet calculated fields normalization
  const csKeys = [
    'total_price_eur',
    'insurance_freight_eur',
    'landed_cost_eur',
    'landed_cost_inr',
    'customs_duty_inr',
    'igst_inr',
    'transportation_inr',
    'financing_charges_inr',
    'total_cost_inr',
    'less_igst_inr',
    'margin_inr',
    'selling_price_excl_gst',
    'selling_price_incl_gst',
  ];
  for (const k of csKeys) {
    const v = getTableRowCellValue(row, k);
    if (v !== undefined && v !== null && v !== '') {
      if (result[k] === undefined || result[k] === null || result[k] === '') {
        result[k] = v;
      }
    }
  }

  return result;
}

/**
 * Checks if a dynamic form line-item table row is empty (i.e. contains no actual user input).
 * Ignores metadata/sequence keys like 'sr_no' or 'id'.
 */
export function isTableRowEmpty(row: Record<string, unknown> | null | undefined): boolean {
  if (!row || typeof row !== 'object') return true;

  for (const [key, value] of Object.entries(row)) {
    if (key === 'sr_no' || key === 'id' || key === '_id') continue;

    if (value !== null && value !== undefined) {
      if (typeof value === 'string' && value.trim() !== '') {
        return false;
      }
      if (typeof value === 'number' && !isNaN(value) && value !== 0) {
        return false;
      }
      if (typeof value === 'boolean') {
        return false;
      }
      if (Array.isArray(value) && value.length > 0) {
        return false;
      }
      if (value instanceof Date) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Filters out empty table rows from line-item arrays, normalizes key aliases, and re-sequences sr_no.
 */
export function cleanTableItems(
  items: Array<Record<string, unknown>> | null | undefined,
): Array<Record<string, unknown>> {
  if (!Array.isArray(items)) return [];

  return items
    .filter((item) => !isTableRowEmpty(item))
    .map((item, index) => {
      const normalized = normalizeTableRow(item);
      return {
        ...normalized,
        sr_no: index + 1,
      };
    });
}

/**
 * Known keys for GST rate percentages across various forms and backend payloads.
 */
export const GST_RATE_KEYS = [
  'gst_rate',
  'gst_rate_pct',
  'gst_pct',
  'gst',
  'tax_rate',
  'igst_rate',
  'igst_pct',
  'gst_percentage',
  'gstRate',
  'igstRate',
] as const;

/**
 * Extracts a numeric GST rate percentage (e.g. 18 for 18%) from an object (formData or step.data)
 * or checks matching fields in the form definition.
 */
export function extractGstRate(
  data: Record<string, unknown> | null | undefined,
  fields?: Array<{ key: string; label?: string }> | null,
): number | null {
  if (!data && !fields) return null;

  // 1. Check data keys directly
  if (data) {
    for (const key of GST_RATE_KEYS) {
      const val = data[key];
      if (val !== undefined && val !== null && val !== '') {
        const num = Number(val);
        if (!isNaN(num) && num >= 0) {
          return num;
        }
      }
    }

    // Check nested globalParams (e.g. in Cost Sheet)
    if (data['globalParams'] && typeof data['globalParams'] === 'object') {
      const gp = data['globalParams'] as Record<string, unknown>;
      const gpRate = Number(gp['gstRate'] ?? gp['igstRate']);
      if (!isNaN(gpRate) && gpRate >= 0) {
        return gpRate;
      }
    }
  }

  // 2. Check form definition fields
  if (fields && data) {
    for (const f of fields) {
      const k = f.key.toLowerCase();
      if (
        (k.includes('gst') || k.includes('tax')) &&
        (k.includes('rate') || k.includes('pct') || k.includes('%') || (f.label || '').includes('%'))
      ) {
        const val = data[f.key];
        if (val !== undefined && val !== null && val !== '') {
          const num = Number(val);
          if (!isNaN(num) && num >= 0) {
            return num;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Checks whether GST is configured or present for a form definition and data.
 */
export function hasGstConfigured(
  fields?: Array<{ key: string; label?: string }> | null,
  data?: Record<string, unknown> | null,
): boolean {
  if (fields) {
    const hasField = fields.some((f) => {
      const k = f.key.toLowerCase();
      const l = (f.label || '').toLowerCase();
      return (
        (k.includes('gst') || k.includes('igst')) &&
        (k.includes('rate') || k.includes('pct') || l.includes('gst') || l.includes('igst'))
      );
    });
    if (hasField) return true;
  }
  if (data) {
    return (
      extractGstRate(data, fields) !== null ||
      data['gst_amount'] !== undefined ||
      data['total_gross_amount'] !== undefined
    );
  }
  return false;
}

export interface TableTotalsCalculation {
  total_net_amount: number;
  gst_rate: number;
  gst_amount: number;
  total_gross_amount: number;
  has_gst: boolean;
}

/**
 * Computes total_net_amount (excl. GST), gst_amount, and total_gross_amount (incl. GST).
 */
export function calculateTableTotalsWithGst(
  netTotal: number,
  gstRate: number | null | undefined,
  explicitGstAmount?: number | null,
): TableTotalsCalculation {
  const safeNet = Math.max(0, netTotal || 0);
  const rate = gstRate !== null && gstRate !== undefined ? Number(gstRate) : 0;
  let gstAmount = 0;

  if (
    explicitGstAmount !== undefined &&
    explicitGstAmount !== null &&
    !isNaN(Number(explicitGstAmount)) &&
    Number(explicitGstAmount) > 0
  ) {
    gstAmount = Number(explicitGstAmount);
  } else if (rate > 0) {
    gstAmount = Math.round(((safeNet * rate) / 100) * 100) / 100;
  }

  const grossTotal = Math.round((safeNet + gstAmount) * 100) / 100;
  const hasGst = rate > 0 || gstAmount > 0;

  return {
    total_net_amount: safeNet,
    gst_rate: rate,
    gst_amount: gstAmount,
    total_gross_amount: grossTotal,
    has_gst: hasGst,
  };
}

/**
 * Checks whether a given field key represents a customer field.
 */
export function isCustomerField(key?: string | null): boolean {
  if (!key) return false;
  const k = key.toLowerCase();
  return k === 'customer_name' || k === 'customer' || k === 'client_name';
}

/**
 * Checks whether a given field key represents a supplier field.
 */
export function isSupplierField(key?: string | null): boolean {
  if (!key) return false;
  const k = key.toLowerCase();
  return k === 'supplier_name' || k === 'supplier' || k === 'vendor_name';
}

/**
 * Checks whether a given field key represents a project title field.
 */
export function isProjectTitleField(key?: string | null): boolean {
  if (!key) return false;
  const k = key.toLowerCase();
  return k === 'project_title' || k === 'project_name';
}

/**
 * Map of opening/subsequent date field keys to their corresponding closing/preceding date field keys.
 */
export const CLOSING_OPENING_DATE_PAIRS: Record<string, string> = {
  opening_date_time: 'closing_date_time',
  opening_date: 'closing_date',
  pqb_opening_date_time: 'pqb_closing_date_time',
  pqb_opening_date: 'pqb_closing_date',
  eoi_opening_date_time: 'eoi_closing_date_time',
  eoi_opening_date: 'eoi_closing_date',
  bid_opening_date_time: 'bid_submission_due_date_time',
  bid_opening_date: 'bid_submission_due_date_time',
  valid_until: 'valid_from',
};

/**
 * Finds the corresponding closing/preceding date field key for a given opening/following field key.
 */
export function getClosingDateKeyForField(
  openingKey: string,
  availableKeys?: string[],
): string | null {
  if (!openingKey) return null;
  const direct = CLOSING_OPENING_DATE_PAIRS[openingKey];
  if (direct) {
    if (!availableKeys || availableKeys.includes(direct)) {
      return direct;
    }
  }

  if (!availableKeys || availableKeys.length === 0) return direct ?? null;

  const lower = openingKey.toLowerCase();
  if (lower.includes('opening')) {
    const prefix = lower.split('opening')[0];
    const match = availableKeys.find((k) => {
      const kl = k.toLowerCase();
      if (kl === openingKey) return false;
      if (prefix && kl.startsWith(prefix) && kl.includes('closing')) return true;
      if (kl.includes('closing')) return true;
      if (kl.includes('submission_due') || (kl.includes('bid_submission') && kl.includes('due'))) return true;
      return false;
    });
    if (match) return match;
  }

  return null;
}

/**
 * Finds the corresponding opening/following date field key for a given closing/preceding field key.
 */
export function getOpeningDateKeyForField(
  closingKey: string,
  availableKeys?: string[],
): string | null {
  if (!closingKey) return null;
  for (const [openKey, closeKey] of Object.entries(CLOSING_OPENING_DATE_PAIRS)) {
    if (closeKey === closingKey) {
      if (!availableKeys || availableKeys.includes(openKey)) {
        return openKey;
      }
    }
  }

  if (!availableKeys || availableKeys.length === 0) return null;

  const lower = closingKey.toLowerCase();
  if (lower.includes('closing') || lower.includes('submission_due') || lower.includes('submission')) {
    const prefix = lower.split(/closing|submission/)[0];
    const match = availableKeys.find((k) => {
      const kl = k.toLowerCase();
      if (kl === closingKey) return false;
      if (prefix && kl.startsWith(prefix) && kl.includes('opening')) return true;
      if (kl.includes('opening')) return true;
      return false;
    });
    if (match) return match;
  }

  return null;
}

/**
 * Converts a string, Date, or unknown value into a valid Date object.
 */
export function toValidDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  if (typeof val === 'string' && val.trim()) {
    return parseLocalDateTime(val) || parseLocalDate(val);
  }
  return null;
}

/**
 * Returns true if dateA is strictly before dateB.
 * If either field is date-only (not datetime), compares calendar days (ignoring hours/minutes).
 * If both are datetime, compares full millisecond timestamps.
 */
export function isDateBefore(
  dateA: Date,
  dateB: Date,
  isDateTimeA = false,
  isDateTimeB = false,
): boolean {
  if (!dateA || !dateB || isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
    return false;
  }
  if (isDateTimeA && isDateTimeB) {
    return dateA.getTime() < dateB.getTime();
  }
  const dayA = new Date(dateA.getFullYear(), dateA.getMonth(), dateA.getDate()).getTime();
  const dayB = new Date(dateB.getFullYear(), dateB.getMonth(), dateB.getDate()).getTime();
  return dayA < dayB;
}

export interface FormLikeGroup {
  get(key: string): {
    value: unknown;
    errors?: Record<string, unknown> | null;
    setErrors?(errors: Record<string, unknown> | null, opts?: { emitEvent?: boolean }): void;
    hasError?(errorCode: string): boolean;
  } | null;
  updateValueAndValidity?(opts?: { emitEvent?: boolean; onlySelf?: boolean }): void;
  controls?: Record<string, unknown>;
}

/**
 * Validates date sequence between closing and opening dates across the form controls.
 * Sets `{ dateBeforeClosing: true }` error on the opening control if it is before the closing date.
 */
export function validateDateSequence(
  fg: FormLikeGroup,
  fieldDefs?: Array<{ key: string; type?: string; label?: string }>,
): void {
  if (!fg) return;
  const availableKeys = fieldDefs
    ? fieldDefs.map((f) => f.key)
    : (fg.controls ? Object.keys(fg.controls) : []);

  for (const openingKey of availableKeys) {
    const closingKey = getClosingDateKeyForField(openingKey, availableKeys);
    if (!closingKey) continue;

    const openingCtrl = fg.get(openingKey);
    const closingCtrl = fg.get(closingKey);
    if (!openingCtrl || !closingCtrl) continue;

    const openingVal = toValidDate(openingCtrl.value);
    const closingVal = toValidDate(closingCtrl.value);

    const openingDef = fieldDefs?.find((f) => f.key === openingKey);
    const closingDef = fieldDefs?.find((f) => f.key === closingKey);
    const isOpeningDateTime = openingDef?.type === 'datetime';
    const isClosingDateTime = closingDef?.type === 'datetime';

    if (openingVal && closingVal && isDateBefore(openingVal, closingVal, isOpeningDateTime, isClosingDateTime)) {
      const existingErrors = openingCtrl.errors || {};
      if (!existingErrors['dateBeforeClosing']) {
        openingCtrl.setErrors?.({ ...existingErrors, dateBeforeClosing: true }, { emitEvent: false });
        fg.updateValueAndValidity?.({ emitEvent: false, onlySelf: true });
      }
    } else if (openingCtrl.hasError?.('dateBeforeClosing')) {
      const errors = { ...(openingCtrl.errors || {}) };
      delete errors['dateBeforeClosing'];
      openingCtrl.setErrors?.(Object.keys(errors).length ? errors : null, { emitEvent: false });
      fg.updateValueAndValidity?.({ emitEvent: false, onlySelf: true });
    }
  }
}



