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
    'material_description',
    'item_name',
    'name',
  ],
  quantity: ['quantity', 'qty', 'count', 'units'],
  unit: ['unit', 'uom', 'unit_of_measure', 'unit_type'],
  unit_price: ['unit_price', 'unit_rate', 'rate', 'price', 'cost_per_unit'],
  total_amount: ['total_amount', 'total_price', 'total', 'amount', 'line_total'],
  total_price: ['total_price', 'total_amount', 'total', 'amount', 'line_total'],
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
