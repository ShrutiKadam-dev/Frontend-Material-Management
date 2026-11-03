import { describe, expect, it } from 'vitest';
import {
  cleanTableItems,
  calculateTableTotalsWithGst,
  extractGstRate,
  getClosingDateKeyForField,
  getOpeningDateKeyForField,
  getTableRowCellValue,
  isCustomerField,
  isDateBefore,
  isProjectTitleField,
  isSupplierField,
  isTableRowEmpty,
  normalizeTableRow,
  toValidDate,
  validateDateSequence,
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

  describe('Closing & Opening Date sequence utilities', () => {
    it('getClosingDateKeyForField should map known opening fields to closing fields', () => {
      expect(getClosingDateKeyForField('opening_date_time')).toBe('closing_date_time');
      expect(getClosingDateKeyForField('pqb_opening_date_time')).toBe('pqb_closing_date_time');
      expect(getClosingDateKeyForField('eoi_opening_date_time')).toBe('eoi_closing_date_time');
      expect(getClosingDateKeyForField('bid_opening_date_time')).toBe('bid_submission_due_date_time');
      expect(getClosingDateKeyForField('valid_until')).toBe('valid_from');
      expect(getClosingDateKeyForField('tender_title')).toBeNull();
    });

    it('getClosingDateKeyForField should match based on availableKeys heuristics', () => {
      const keys = ['tender_issue_date', 'custom_closing_date', 'custom_opening_date'];
      expect(getClosingDateKeyForField('custom_opening_date', keys)).toBe('custom_closing_date');
    });

    it('getOpeningDateKeyForField should map known closing fields to opening fields', () => {
      expect(getOpeningDateKeyForField('closing_date_time')).toBe('opening_date_time');
      expect(getOpeningDateKeyForField('pqb_closing_date_time')).toBe('pqb_opening_date_time');
      expect(getOpeningDateKeyForField('eoi_closing_date_time')).toBe('eoi_opening_date_time');
      expect(getOpeningDateKeyForField('bid_submission_due_date_time')).toBe('bid_opening_date_time');
      expect(getOpeningDateKeyForField('valid_from')).toBe('valid_until');
      expect(getOpeningDateKeyForField('tender_no')).toBeNull();
    });

    it('toValidDate should parse string, Date, or return null', () => {
      expect(toValidDate(null)).toBeNull();
      expect(toValidDate('')).toBeNull();
      const d = new Date(2026, 10, 15);
      expect(toValidDate(d)).toBe(d);
      const parsedIso = toValidDate('2026-11-15T14:30:00');
      expect(parsedIso).toBeInstanceOf(Date);
      expect(parsedIso?.getFullYear()).toBe(2026);
      expect(parsedIso?.getMonth()).toBe(10);
      expect(parsedIso?.getDate()).toBe(15);
      expect(parsedIso?.getHours()).toBe(14);
      expect(parsedIso?.getMinutes()).toBe(30);
    });

    it('isDateBefore should accurately compare dates and datetimes', () => {
      const dateEarlier = new Date(2026, 10, 14, 15, 0);
      const dateLater = new Date(2026, 10, 15, 14, 0);
      const dateSameDayEarlierTime = new Date(2026, 10, 15, 12, 0);
      const dateSameDayLaterTime = new Date(2026, 10, 15, 16, 0);

      // Comparing full datetime
      expect(isDateBefore(dateEarlier, dateLater, true, true)).toBe(true);
      expect(isDateBefore(dateLater, dateEarlier, true, true)).toBe(false);
      expect(isDateBefore(dateSameDayEarlierTime, dateSameDayLaterTime, true, true)).toBe(true);
      expect(isDateBefore(dateSameDayLaterTime, dateSameDayEarlierTime, true, true)).toBe(false);

      // Comparing date only (same day is not before)
      expect(isDateBefore(dateSameDayEarlierTime, dateSameDayLaterTime, false, false)).toBe(false);
      expect(isDateBefore(dateEarlier, dateLater, false, false)).toBe(true);
    });

    function createMockControl(initialVal: unknown) {
      return {
        value: initialVal,
        errors: null as Record<string, unknown> | null,
        setValue(v: unknown) {
          this.value = v;
        },
        setErrors(errs: Record<string, unknown> | null) {
          this.errors = errs;
        },
        hasError(code: string) {
          return !!(this.errors && this.errors[code]);
        },
      };
    }

    it('validateDateSequence should flag opening date before closing date with dateBeforeClosing error', () => {
      const closingCtrl = createMockControl(new Date(2026, 10, 15, 14, 0));
      const openingCtrl = createMockControl(new Date(2026, 10, 14, 10, 0));
      const controls: Record<string, any> = {
        closing_date_time: closingCtrl,
        opening_date_time: openingCtrl,
      };

      const fg = {
        get: (k: string) => controls[k] ?? null,
        updateValueAndValidity: () => {},
        controls,
      };

      const fieldDefs = [
        { key: 'closing_date_time', type: 'datetime', label: 'Closing Date & Time' },
        { key: 'opening_date_time', type: 'datetime', label: 'Opening Date & Time' },
      ];

      validateDateSequence(fg, fieldDefs);
      expect(openingCtrl.hasError('dateBeforeClosing')).toBe(true);

      // Update opening date to after closing date
      openingCtrl.setValue(new Date(2026, 10, 15, 16, 0));
      validateDateSequence(fg, fieldDefs);
      expect(openingCtrl.hasError('dateBeforeClosing')).toBe(false);
    });

    it('validateDateSequence should clear error when closing date is cleared or changed to earlier', () => {
      const closingCtrl = createMockControl(new Date(2026, 10, 20, 14, 0));
      const openingCtrl = createMockControl(new Date(2026, 10, 15, 10, 0));
      const controls: Record<string, any> = {
        pqb_closing_date_time: closingCtrl,
        pqb_opening_date_time: openingCtrl,
      };

      const fg = {
        get: (k: string) => controls[k] ?? null,
        updateValueAndValidity: () => {},
        controls,
      };

      const fieldDefs = [
        { key: 'pqb_closing_date_time', type: 'datetime', label: 'PQB Closing Date & Time' },
        { key: 'pqb_opening_date_time', type: 'datetime', label: 'PQB Opening Date & Time' },
      ];

      validateDateSequence(fg, fieldDefs);
      expect(openingCtrl.hasError('dateBeforeClosing')).toBe(true);

      // User updates closing date to before opening date
      closingCtrl.setValue(new Date(2026, 10, 10, 14, 0));
      validateDateSequence(fg, fieldDefs);
      expect(openingCtrl.hasError('dateBeforeClosing')).toBe(false);

      // User clears closing date
      closingCtrl.setValue(null);
      validateDateSequence(fg, fieldDefs);
      expect(openingCtrl.hasError('dateBeforeClosing')).toBe(false);
    });

    it('validateDateSequence should work across all catalog tender form pairs (LTE, STE, ICB, EOI)', () => {
      // 1. LTE / STE / ICB / Techno Commercial: bid_submission_due_date_time -> bid_opening_date_time
      const lteDueCtrl = createMockControl(new Date(2026, 11, 20, 15, 0));
      const lteOpenCtrl = createMockControl(new Date(2026, 11, 19, 11, 0));
      const lteFg = {
        get: (k: string) => (k === 'bid_submission_due_date_time' ? lteDueCtrl : lteOpenCtrl),
        updateValueAndValidity: () => {},
      };
      const lteDefs = [
        { key: 'bid_submission_due_date_time', type: 'datetime' },
        { key: 'bid_opening_date_time', type: 'datetime' },
      ];
      validateDateSequence(lteFg, lteDefs);
      expect(lteOpenCtrl.hasError('dateBeforeClosing')).toBe(true);

      lteOpenCtrl.setValue(new Date(2026, 11, 20, 16, 0));
      validateDateSequence(lteFg, lteDefs);
      expect(lteOpenCtrl.hasError('dateBeforeClosing')).toBe(false);

      // 2. EOI: eoi_closing_date_time -> eoi_opening_date_time
      const eoiClosingCtrl = createMockControl('2026-11-25T17:00:00');
      const eoiOpeningCtrl = createMockControl('2026-11-25T14:00:00');
      const eoiFg = {
        get: (k: string) => (k === 'eoi_closing_date_time' ? eoiClosingCtrl : eoiOpeningCtrl),
        updateValueAndValidity: () => {},
      };
      const eoiDefs = [
        { key: 'eoi_closing_date_time', type: 'datetime' },
        { key: 'eoi_opening_date_time', type: 'datetime' },
      ];
      validateDateSequence(eoiFg, eoiDefs);
      expect(eoiOpeningCtrl.hasError('dateBeforeClosing')).toBe(true);

      eoiOpeningCtrl.setValue('2026-11-26T10:00:00');
      validateDateSequence(eoiFg, eoiDefs);
      expect(eoiOpeningCtrl.hasError('dateBeforeClosing')).toBe(false);
    });
  });
});

