import { describe, expect, it } from 'vitest';
import {
  FORM_CATALOG,
  FORM_CATALOG_MAP,
  getFormDefinition,
} from './form-catalog';

describe('FORM_CATALOG New Tender Forms (29, 30, 31)', () => {
  it('should contain 31 total forms in catalog', () => {
    expect(FORM_CATALOG.length).toBe(31);
    expect(FORM_CATALOG_MAP.size).toBe(31);
  });

  describe('Form 2: BID DOCUMENT FOR PQB', () => {
    it('should have Pricing table tab with Sr. No., Description, HSN/SAC, Quantity, Unit Price, Total Amount', () => {
      const def = getFormDefinition('FORM_02_PQB_BID_DOCUMENT')!;
      expect(def).toBeDefined();
      expect(def.id).toBe(2);
      expect(def.name).toBe('Bid Document for PQB');
      expect(def.tableConfig).toBeDefined();
      expect(def.tableConfig?.title).toBe('Pricing');
      expect(def.tableConfig?.autoCalculateTotal).toBe(true);
      expect(def.tableConfig?.quantityKey).toBe('quantity');
      expect(def.tableConfig?.unitPriceKey).toBe('unit_price');
      expect(def.tableConfig?.totalKey).toBe('total_amount');

      const colKeys = def.tableConfig?.columns.map((c) => c.key);
      expect(colKeys).toEqual([
        'sr_no',
        'description',
        'hsn_sac',
        'quantity',
        'unit_price',
        'total_amount',
      ]);
    });
  });

  describe('Form 29: BID DOCUMENT - TECHNO COMMERCIAL TENDER', () => {
    it('should be registered with code FORM_29_BID_DOC_TECHNO_COMMERCIAL and id 29', () => {
      const def = getFormDefinition('FORM_29_BID_DOC_TECHNO_COMMERCIAL');
      expect(def).toBeDefined();
      expect(def?.id).toBe(29);
      expect(def?.name).toBe('Bid Document - Techno Commercial Tender');
      expect(def?.category).toBe('Pre-Bidding & Tenders');
      expect(def?.phaseId).toBe('phase-1');
      expect(getFormDefinition(29)).toEqual(def);
    });

    it('should have all 12 fields matching specification', () => {
      const def = getFormDefinition(29)!;
      const fieldKeys = def.fields.map((f) => f.key);
      expect(fieldKeys).toEqual([
        'customer_name',
        'tender_title',
        'tender_no',
        'tender_issue_date',
        'total_no_corrigendum_issued',
        'bid_submission_date',
        'delivery_terms',
        'delivery_period',
        'bid_validity',
        'payment_terms',
        'warranty_period',
        'gst_pct',
      ]);

      const customerField = def.fields.find((f) => f.key === 'customer_name');
      expect(customerField?.required).toBe(true);

      const gstField = def.fields.find((f) => f.key === 'gst_pct');
      expect(gstField?.suffix).toBe('%');
    });

    it('should have table configuration for Bid Materials/Services & Pricing', () => {
      const def = getFormDefinition(29)!;
      expect(def.tableConfig).toBeDefined();
      expect(def.tableConfig?.title).toBe('Bid Materials/Services & Pricing');
      expect(def.tableConfig?.autoCalculateTotal).toBe(true);
      expect(def.tableConfig?.quantityKey).toBe('quantity');
      expect(def.tableConfig?.unitPriceKey).toBe('unit_price');
      expect(def.tableConfig?.totalKey).toBe('total_amount');

      const colKeys = def.tableConfig?.columns.map((c) => c.key);
      expect(colKeys).toEqual([
        'sr_no',
        'description',
        'hsn_sac',
        'quantity',
        'unit_price',
        'total_amount',
      ]);
    });

    it('should configure upload for bid document', () => {
      const def = getFormDefinition(29)!;
      expect(def.uploads.length).toBeGreaterThan(0);
      expect(def.uploads[0].key).toBe('upload_bid_document');
    });
  });

  describe('Form 30: TECHNO COMMERCIAL TENDER', () => {
    it('should be registered with code FORM_30_TECHNO_COMMERCIAL_TENDER and id 30', () => {
      const def = getFormDefinition('FORM_30_TECHNO_COMMERCIAL_TENDER');
      expect(def).toBeDefined();
      expect(def?.id).toBe(30);
      expect(def?.name).toBe('Techno Commercial Tender');
      expect(def?.category).toBe('Pre-Bidding & Tenders');
      expect(def?.phaseId).toBe('phase-1');
      expect(getFormDefinition(30)).toEqual(def);
    });

    it('should have all 9 fields matching specification', () => {
      const def = getFormDefinition(30)!;
      const fieldKeys = def.fields.map((f) => f.key);
      expect(fieldKeys).toEqual([
        'pqb_no',
        'tender_title',
        'tender_no',
        'tender_issue_date',
        'bid_submission_due_date_time',
        'bid_opening_date_time',
        'tender_fee',
        'emd',
        'tender_validity',
      ]);

      const tenderFee = def.fields.find((f) => f.key === 'tender_fee');
      expect(tenderFee?.type).toBe('currency');
      expect(tenderFee?.prefix).toBe('₹');

      const emd = def.fields.find((f) => f.key === 'emd');
      expect(emd?.type).toBe('currency');
      expect(emd?.prefix).toBe('₹');
    });

    it('should have table configuration for Requirements', () => {
      const def = getFormDefinition(30)!;
      expect(def.tableConfig).toBeDefined();
      expect(def.tableConfig?.title).toBe('Requirements');

      const colKeys = def.tableConfig?.columns.map((c) => c.key);
      expect(colKeys).toEqual(['sr_no', 'description', 'unit', 'quantity']);
    });

    it('should configure upload for techno commercial tender document', () => {
      const def = getFormDefinition(30)!;
      expect(def.uploads.length).toBeGreaterThan(0);
      expect(def.uploads[0].key).toBe('upload_techno_commercial_tender');
    });
  });

  describe('Form 31: BID DOCUMENT - LIMITED TENDER ENQUIRY (LTE)', () => {
    it('should be registered with code FORM_31_BID_DOC_LTE and id 31', () => {
      const def = getFormDefinition('FORM_31_BID_DOC_LTE');
      expect(def).toBeDefined();
      expect(def?.id).toBe(31);
      expect(def?.name).toBe('Bid Document - Limited Tender Enquiry (LTE)');
      expect(def?.category).toBe('Pre-Bidding & Tenders');
      expect(def?.phaseId).toBe('phase-1');
      expect(getFormDefinition(31)).toEqual(def);
    });

    it('should have all 12 fields matching specification', () => {
      const def = getFormDefinition(31)!;
      const fieldKeys = def.fields.map((f) => f.key);
      expect(fieldKeys).toEqual([
        'customer_name',
        'tender_title',
        'tender_no',
        'tender_issue_date',
        'total_no_corrigendum_issued',
        'bid_submission_date',
        'delivery_terms',
        'delivery_period',
        'bid_validity',
        'payment_terms',
        'warranty_period',
        'gst_pct',
      ]);
    });

    it('should have table configuration for Bid Materials/Services & Pricing', () => {
      const def = getFormDefinition(31)!;
      expect(def.tableConfig).toBeDefined();
      expect(def.tableConfig?.title).toBe('Bid Materials/Services & Pricing');
      expect(def.tableConfig?.autoCalculateTotal).toBe(true);
      expect(def.tableConfig?.quantityKey).toBe('quantity');
      expect(def.tableConfig?.unitPriceKey).toBe('unit_price');
      expect(def.tableConfig?.totalKey).toBe('total_amount');

      const colKeys = def.tableConfig?.columns.map((c) => c.key);
      expect(colKeys).toEqual([
        'sr_no',
        'description',
        'hsn_sac',
        'quantity',
        'unit_price',
        'total_amount',
      ]);
    });

    it('should configure upload for LTE bid document', () => {
      const def = getFormDefinition(31)!;
      expect(def.uploads.length).toBeGreaterThan(0);
      expect(def.uploads[0].key).toBe('upload_bid_document_lte');
    });
  });
});
