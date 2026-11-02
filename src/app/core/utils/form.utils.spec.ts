import { describe, expect, it } from 'vitest';
import {
  cleanTableItems,
  calculateTableTotalsWithGst,
  extractGstRate,
  getTableRowCellValue,
  isCustomerField,
  isProjectTitleField,
  isSupplierField,
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

  describe('extractGstRate and calculateTableTotalsWithGst', () => {
    it('should extract gst rate from gst_rate_pct, gst_pct, or gst_rate', () => {
      expect(extractGstRate({ gst_rate_pct: 18 })).toBe(18);
      expect(extractGstRate({ gst_pct: 12 })).toBe(12);
      expect(extractGstRate({ gst_rate: 5 })).toBe(5);
      expect(extractGstRate({ igst_pct: 18 })).toBe(18);
      expect(extractGstRate({})).toBeNull();
    });

    it('should extract gst rate from globalParams nested object', () => {
      expect(extractGstRate({ globalParams: { gstRate: 18 } })).toBe(18);
    });

    it('should calculate net total (excl. gst) and gross total (incl. gst) properly', () => {
      const result = calculateTableTotalsWithGst(1000, 18);
      expect(result.total_net_amount).toBe(1000);
      expect(result.gst_rate).toBe(18);
      expect(result.gst_amount).toBe(180);
      expect(result.total_gross_amount).toBe(1180);
      expect(result.has_gst).toBe(true);
    });

    it('should use explicit gst amount when provided', () => {
      const result = calculateTableTotalsWithGst(1000, 18, 200);
      expect(result.total_net_amount).toBe(1000);
      expect(result.gst_amount).toBe(200);
      expect(result.total_gross_amount).toBe(1200);
      expect(result.has_gst).toBe(true);
    });

    it('should return zero tax when gst rate is not provided', () => {
      const result = calculateTableTotalsWithGst(1000, null);
      expect(result.total_net_amount).toBe(1000);
      expect(result.gst_amount).toBe(0);
      expect(result.total_gross_amount).toBe(1000);
      expect(result.has_gst).toBe(false);
    });
  });

  describe('Field Key Matchers', () => {
    it('isCustomerField should match customer-related keys', () => {
      expect(isCustomerField('customer_name')).toBe(true);
      expect(isCustomerField('customer')).toBe(true);
      expect(isCustomerField('client_name')).toBe(true);
      expect(isCustomerField('CUSTOMER_NAME')).toBe(true);
      expect(isCustomerField('supplier_name')).toBe(false);
      expect(isCustomerField('project_title')).toBe(false);
      expect(isCustomerField('')).toBe(false);
      expect(isCustomerField(null)).toBe(false);
    });

    it('isSupplierField should match supplier-related keys', () => {
      expect(isSupplierField('supplier_name')).toBe(true);
      expect(isSupplierField('supplier')).toBe(true);
      expect(isSupplierField('vendor_name')).toBe(true);
      expect(isSupplierField('SUPPLIER_NAME')).toBe(true);
      expect(isSupplierField('customer_name')).toBe(false);
      expect(isSupplierField('')).toBe(false);
      expect(isSupplierField(null)).toBe(false);
    });

    it('isProjectTitleField should match project title keys', () => {
      expect(isProjectTitleField('project_title')).toBe(true);
      expect(isProjectTitleField('project_name')).toBe(true);
      expect(isProjectTitleField('PROJECT_TITLE')).toBe(true);
      expect(isProjectTitleField('tender_title')).toBe(false);
      expect(isProjectTitleField('pqb_title')).toBe(false);
      expect(isProjectTitleField('')).toBe(false);
      expect(isProjectTitleField(null)).toBe(false);
    });
  });
});

