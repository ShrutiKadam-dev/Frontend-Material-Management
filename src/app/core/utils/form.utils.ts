/**
 * Form and line-item table utility functions.
 */

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
  item_code: ['item_code', 'itemCode', 'code', 'part_number'],
  quantity: ['quantity', 'qty', 'count', 'units'],
  unit: ['unit', 'uom', 'unit_of_measure', 'unit_type'],
  unit_price: ['unit_price', 'unit_rate', 'rate', 'price', 'cost_per_unit', 'price_per_unit_inr', 'pricePerUnitInrExclGst'],
  price_per_unit_eur: ['price_per_unit_eur', 'pricePerUnitEur', 'price_eur', 'unit_price_eur'],
  customs_duty_rate: ['customs_duty_rate', 'customsDutyRate', 'custom_duty_pct', 'duty_pct', 'customsDutyPct'],
  landed_cost_inr: ['landed_cost_inr', 'landedCostInr', 'landed_cost', 'landedCostEur'],
  selling_price_excl_gst: ['selling_price_excl_gst', 'sellingPriceExclGst', 'selling_price', 'total_selling_price'],
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

  const qty = getTableRowCellValue(row, 'quantity');
  if (qty !== undefined && qty !== null && qty !== '') {
    if (result['quantity'] === undefined || result['quantity'] === null || result['quantity'] === '') {
      result['quantity'] = qty;
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

