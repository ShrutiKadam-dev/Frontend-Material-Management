import { describe, expect, it } from 'vitest';
import {
  cleanTableItems,
  getTableRowCellValue,
  isTableRowEmpty,
  normalizeTableRow,
} from './form.utils';

describe('form.utils', () => {
  describe('isTableRowEmpty', () => {
    it('should return true for empty or null row', () => {
      expect(isTableRowEmpty(null)).toBe(true);
      expect(isTableRowEmpty(undefined)).toBe(true);
      expect(isTableRowEmpty({})).toBe(true);
    });

    it('should return true when only sr_no is present', () => {
      expect(isTableRowEmpty({ sr_no: 1 })).toBe(true);
      expect(isTableRowEmpty({ sr_no: 1, id: 101 })).toBe(true);
    });

    it('should return true when all fields are empty strings, null, or zero', () => {
      expect(
        isTableRowEmpty({
          sr_no: 1,
          description: '',
          unit: '   ',
          quantity: null,
          unit_price: 0,
        }),
      ).toBe(true);
    });

    it('should return false when text description is filled', () => {
      expect(
        isTableRowEmpty({
          sr_no: 1,
          description: 'High Tensile Bolts',
          unit: '',
          quantity: null,
        }),
      ).toBe(false);
    });

    it('should return false when material_name is filled instead of description', () => {
      expect(
        isTableRowEmpty({
          sr_no: 1,
          material_name: 'Seamless Steel Pipes',
          quantity: null,
        }),
      ).toBe(false);
    });

    it('should return false when quantity is greater than 0', () => {
      expect(
        isTableRowEmpty({
          sr_no: 1,
          description: '',
          unit: '',
          quantity: 10,
        }),
      ).toBe(false);
    });
  });

  describe('getTableRowCellValue', () => {
    it('should retrieve direct key value if present', () => {
      const row = { description: 'Direct Desc', material_name: 'Mat Name' };
      expect(getTableRowCellValue(row, 'description')).toBe('Direct Desc');
    });

    it('should retrieve material_name alias when description is empty or missing', () => {
      const row1 = { material_name: 'Stainless Steel Rods' };
      expect(getTableRowCellValue(row1, 'description')).toBe('Stainless Steel Rods');

      const row2 = { description: '', material_name: 'Carbon Steel Flanges' };
      expect(getTableRowCellValue(row2, 'description')).toBe('Carbon Steel Flanges');

      const row3 = { item_description: 'Turbine Blades' };
      expect(getTableRowCellValue(row3, 'description')).toBe('Turbine Blades');
    });

    it('should retrieve quantity aliases (qty, count)', () => {
      expect(getTableRowCellValue({ qty: 45 }, 'quantity')).toBe(45);
      expect(getTableRowCellValue({ count: 12 }, 'quantity')).toBe(12);
    });

    it('should return undefined when row is null or key does not exist', () => {
      expect(getTableRowCellValue(null, 'description')).toBeUndefined();
      expect(getTableRowCellValue({}, 'non_existent')).toBeUndefined();
    });
  });

  describe('normalizeTableRow', () => {
    it('should populate description from material_name if description is missing', () => {
      const row = { id: 5, material_name: 'Copper Wire 2.5mm', quantity: 200 };
      const normalized = normalizeTableRow(row);

      expect(normalized['description']).toBe('Copper Wire 2.5mm');
      expect(normalized['material_name']).toBe('Copper Wire 2.5mm');
    });

    it('should populate material_name from description if material_name is missing', () => {
      const row = { description: 'Mild Steel Channel', quantity: 15 };
      const normalized = normalizeTableRow(row);

      expect(normalized['description']).toBe('Mild Steel Channel');
      expect(normalized['material_name']).toBe('Mild Steel Channel');
    });
  });

  describe('cleanTableItems', () => {
    it('should filter out empty placeholder rows and keep filled rows with sequential sr_no and normalized descriptions', () => {
      const input = [
        { sr_no: 1, description: '', unit: '', quantity: null },
        { sr_no: 2, material_name: 'Mild Steel Plates', unit: 'MT', quantity: 25 },
        { sr_no: 3, description: '', unit: '', quantity: '' },
      ];

      const cleaned = cleanTableItems(input);
      expect(cleaned).toHaveLength(1);
      expect(cleaned[0]!['sr_no']).toBe(1);
      expect(cleaned[0]!['description']).toBe('Mild Steel Plates');
      expect(cleaned[0]!['material_name']).toBe('Mild Steel Plates');
    });

    it('should return empty array if all rows are blank', () => {
      const input = [
        { sr_no: 1, description: '', unit: '', quantity: '' },
      ];

      const cleaned = cleanTableItems(input);
      expect(cleaned).toEqual([]);
    });
  });
});
