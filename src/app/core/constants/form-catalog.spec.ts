import { describe, expect, it } from 'vitest';
import {
  FORM_CATALOG,
  FORM_CATALOG_MAP,
  getFormDefinition,
} from './form-catalog';

describe('FORM_CATALOG Extended Forms (26, 29, 30, 31, 32, 33, 34, 35, 36)', () => {
  it('should contain 36 total forms in catalog', () => {
    expect(FORM_CATALOG.length).toBe(36);
    expect(FORM_CATALOG_MAP.size).toBeGreaterThanOrEqual(36);
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

  describe('Form 3: CORRIGENDUM', () => {
    it('should be registered with code FORM_03_CORRIGENDUM and id 3', () => {
      const def = getFormDefinition('FORM_03_CORRIGENDUM');
      expect(def).toBeDefined();
      expect(def?.id).toBe(3);
      expect(def?.name).toBe('Corrigendum');
      expect(def?.category).toBe('Pre-Bidding & Tenders');
      expect(def?.phaseId).toBe('phase-1');
      expect(getFormDefinition(3)).toEqual(def);
    });

    it('should have corrigendum fields including against_ref_no and ref_title', () => {
      const def = getFormDefinition(3)!;
      const fieldKeys = def.fields.map((f) => f.key);
      expect(fieldKeys).toContain('corrigendum_no');
      expect(fieldKeys).toContain('against_ref_no');
      expect(fieldKeys).toContain('ref_title');
    });

    it('should configure table for Corrigendum with 3 comparison columns', () => {
      const def = getFormDefinition(3)!;
      expect(def.tableConfig).toBeDefined();
      expect(def.tableConfig?.columns.map((c) => c.key)).toEqual([
        'sr_no',
        'as_per_tender_doc',
        'as_per_corrigendum',
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

  describe('Form 33: SINGLE TENDER ENQUIRY (STE)', () => {
    it('should be registered with code FORM_33_STE and id 33', () => {
      const def = getFormDefinition('FORM_33_STE');
      expect(def).toBeDefined();
      expect(def?.id).toBe(33);
      expect(def?.name).toBe('Single Tender Enquiry (STE)');
      expect(def?.category).toBe('Pre-Bidding & Tenders');
      expect(def?.phaseId).toBe('phase-1');
      expect(getFormDefinition(33)).toEqual(def);
    });

    it('should resolve via alias FORM_30_STE and FORM_STE', () => {
      expect(getFormDefinition('FORM_30_STE')?.id).toBe(33);
      expect(getFormDefinition('FORM_STE')?.id).toBe(33);
    });

    it('should have all 9 fields matching specification', () => {
      const def = getFormDefinition(33)!;
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
      const def = getFormDefinition(33)!;
      expect(def.tableConfig).toBeDefined();
      expect(def.tableConfig?.title).toBe('Requirements');

      const colKeys = def.tableConfig?.columns.map((c) => c.key);
      expect(colKeys).toEqual(['sr_no', 'description', 'unit', 'quantity']);
    });

    it('should configure upload for STE document', () => {
      const def = getFormDefinition(33)!;
      expect(def.uploads.length).toBeGreaterThan(0);
      expect(def.uploads[0].key).toBe('upload_ste');
      expect(def.uploads[0].label).toBe('Upload STE');
    });
  });

  describe('Form 34: BID DOCUMENT - SINGLE TENDER ENQUIRY (STE)', () => {
    it('should be registered with code FORM_34_BID_DOC_STE and id 34', () => {
      const def = getFormDefinition('FORM_34_BID_DOC_STE');
      expect(def).toBeDefined();
      expect(def?.id).toBe(34);
      expect(def?.name).toBe('Bid Document - Single Tender Enquiry (STE)');
      expect(def?.category).toBe('Pre-Bidding & Tenders');
      expect(def?.phaseId).toBe('phase-1');
      expect(getFormDefinition(34)).toEqual(def);
    });

    it('should resolve via alias FORM_31_BID_DOC_STE and FORM_BID_DOC_STE', () => {
      expect(getFormDefinition('FORM_31_BID_DOC_STE')?.id).toBe(34);
      expect(getFormDefinition('FORM_BID_DOC_STE')?.id).toBe(34);
      expect(getFormDefinition('FORM_34')?.id).toBe(34);
      expect(getFormDefinition('bid-document-ste')?.id).toBe(34);
      expect(getFormDefinition('Bid Document - Single Tender Enquiry (STE)')?.id).toBe(34);
      expect(getFormDefinition('34')?.id).toBe(34);
    });

    it('should have all 12 fields matching specification', () => {
      const def = getFormDefinition(34)!;
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
      const def = getFormDefinition(34)!;
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

    it('should configure upload for STE bid document', () => {
      const def = getFormDefinition(34)!;
      expect(def.uploads.length).toBeGreaterThan(0);
      expect(def.uploads[0].key).toBe('upload_bid_document');
      expect(def.uploads[0].label).toBe('Upload Bid Document');
    });
  });

  describe('Form 26: TAX INVOICE TO CUSTOMER', () => {
    it('should be registered with code FORM_26_TAX_INVOICE_CUSTOMER and id 26', () => {
      const def = getFormDefinition('FORM_26_TAX_INVOICE_CUSTOMER');
      expect(def).toBeDefined();
      expect(def?.id).toBe(26);
      expect(def?.name).toBe('Tax Invoice to Customer');
      expect(def?.category).toBe('Customer & Supplier Settlement');
      expect(def?.phaseId).toBe('phase-5');
      expect(getFormDefinition(26)).toEqual(def);
    });

    it('should have GST (%) field configured', () => {
      const def = getFormDefinition(26)!;
      const gstField = def.fields.find((f) => f.key === 'gst_pct');
      expect(gstField).toBeDefined();
      expect(gstField?.label).toBe('GST (%)');
      expect(gstField?.type).toBe('number');
      expect(gstField?.suffix).toBe('%');
    });
  });

  describe('Form 32: E-WAY BILL', () => {
    it('should be registered with code FORM_32_EWAY_BILL and id 32', () => {
      const def = getFormDefinition('FORM_32_EWAY_BILL');
      expect(def).toBeDefined();
      expect(def?.id).toBe(32);
      expect(def?.name).toBe('E-Way Bill');
      expect(def?.category).toBe('Logistics & Customs');
      expect(def?.phaseId).toBe('phase-4');
      expect(getFormDefinition(32)).toEqual(def);
    });

    it('should have all 12 fields matching specification', () => {
      const def = getFormDefinition(32)!;
      const fieldKeys = def.fields.map((f) => f.key);
      expect(fieldKeys).toEqual([
        'eway_bill_no',
        'eway_bill_date',
        'valid_from',
        'valid_until',
        'document_no',
        'document_date',
        'value',
        'place_of_dispatch',
        'place_of_delivery',
        'transporter',
        'mode',
        'vehicle_trans_doc_no',
      ]);

      const ewayNo = def.fields.find((f) => f.key === 'eway_bill_no');
      expect(ewayNo?.required).toBe(true);

      const ewayDate = def.fields.find((f) => f.key === 'eway_bill_date');
      expect(ewayDate?.required).toBe(true);
      expect(ewayDate?.type).toBe('date');

      const valueField = def.fields.find((f) => f.key === 'value');
      expect(valueField?.type).toBe('currency');
      expect(valueField?.prefix).toBe('₹');

      const modeField = def.fields.find((f) => f.key === 'mode');
      expect(modeField?.type).toBe('select');
      expect(modeField?.options).toEqual(['Road', 'Rail', 'Air', 'Ship']);
    });

    it('should configure upload for e-way bill document', () => {
      const def = getFormDefinition(32)!;
      expect(def.uploads.length).toBeGreaterThan(0);
      expect(def.uploads[0].key).toBe('upload_eway_bill');
      expect(def.uploads[0].label).toBe('Upload E-Way Bill');
    });
  });

  describe('Form 35: INTERNATIONAL COMPETITIVE BIDDING (ICB)', () => {
    it('should be registered with code FORM_35_ICB and id 35', () => {
      const def = getFormDefinition('FORM_35_ICB');
      expect(def).toBeDefined();
      expect(def?.id).toBe(35);
      expect(def?.name).toBe('International Competitive Bidding (ICB)');
      expect(def?.category).toBe('Pre-Bidding & Tenders');
      expect(def?.phaseId).toBe('phase-1');
      expect(getFormDefinition(35)).toEqual(def);
    });

    it('should resolve via alias FORM_ICB and FORM_35_INTERNATIONAL_COMPETITIVE_BIDDING', () => {
      expect(getFormDefinition('FORM_ICB')?.id).toBe(35);
      expect(getFormDefinition('FORM_35_INTERNATIONAL_COMPETITIVE_BIDDING')?.id).toBe(35);
      expect(getFormDefinition('FORM_INTERNATIONAL_COMPETITIVE_BIDDING')?.id).toBe(35);
    });

    it('should have all 9 fields matching specification', () => {
      const def = getFormDefinition(35)!;
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
      const def = getFormDefinition(35)!;
      expect(def.tableConfig).toBeDefined();
      expect(def.tableConfig?.title).toBe('Requirements');

      const colKeys = def.tableConfig?.columns.map((c) => c.key);
      expect(colKeys).toEqual(['sr_no', 'description', 'unit', 'quantity']);
    });

    it('should configure upload for ICB document', () => {
      const def = getFormDefinition(35)!;
      expect(def.uploads.length).toBeGreaterThan(0);
      expect(def.uploads[0].key).toBe('upload_icb');
      expect(def.uploads[0].label).toBe('Upload ICB Document');
    });
  });

  describe('Form 36: BID DOCUMENT - INTERNATIONAL COMPETITIVE BIDDING (ICB)', () => {
    it('should be registered with code FORM_36_BID_DOC_ICB and id 36', () => {
      const def = getFormDefinition('FORM_36_BID_DOC_ICB');
      expect(def).toBeDefined();
      expect(def?.id).toBe(36);
      expect(def?.name).toBe('Bid Document - International Competitive Bidding (ICB)');
      expect(def?.category).toBe('Pre-Bidding & Tenders');
      expect(def?.phaseId).toBe('phase-1');
      expect(getFormDefinition(36)).toEqual(def);
    });

    it('should resolve via alias FORM_BID_DOC_ICB and FORM_36_BID_DOCUMENT_ICB', () => {
      expect(getFormDefinition('FORM_BID_DOC_ICB')?.id).toBe(36);
      expect(getFormDefinition('FORM_36_BID_DOCUMENT_ICB')?.id).toBe(36);
      expect(getFormDefinition('FORM_BID_DOCUMENT_ICB')?.id).toBe(36);
    });

    it('should have all 12 fields matching specification', () => {
      const def = getFormDefinition(36)!;
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
      const def = getFormDefinition(36)!;
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

    it('should configure upload for ICB bid document', () => {
      const def = getFormDefinition(36)!;
      expect(def.uploads.length).toBeGreaterThan(0);
      expect(def.uploads[0].key).toBe('upload_bid_document');
      expect(def.uploads[0].label).toBe('Upload Bid Document');
    });
  });
});
