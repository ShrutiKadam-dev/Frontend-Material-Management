export type FormCategory =
  | 'Pre-Bidding & Tenders'
  | 'Sourcing & Quotations'
  | 'Supplier Orders & Invoices'
  | 'Logistics & Customs'
  | 'Customer & Supplier Settlement';

export type FormFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'datetime'
  | 'select'
  | 'currency'
  | 'textarea';

export interface FormFieldDefinition {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[]; // for select
  suffix?: string;
  prefix?: string;
  colSpan?: 1 | 2 | 3 | 4; // grid column width out of 4
  sectionTitle?: string; // section header title banner
}

export interface FormTableColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'currency' | 'date';
  width?: string;
  required?: boolean;
}

export interface FormTableConfig {
  title: string;
  columns: FormTableColumn[];
  autoCalculateTotal?: boolean;
  totalKey?: string;
  unitPriceKey?: string;
  quantityKey?: string;
}

export interface FormUploadConfig {
  key: string;
  label: string;
  required?: boolean;
  multiple?: boolean;
}

export interface FormDefinition {
  id: number;
  formCode: string;
  name: string;
  category: FormCategory;
  phaseId: 'phase-1' | 'phase-2' | 'phase-3' | 'phase-4';
  icon: string;
  description: string;
  apiEndpoint?: string;
  fields: FormFieldDefinition[];
  tableConfig?: FormTableConfig;
  uploads: FormUploadConfig[];
}

export const FORM_CATALOG: FormDefinition[] = [
  // ── 1. NATIONAL PRE-QUALIFICATION BID (PQB) ──────────────────────────────
  {
    id: 1,
    formCode: 'FORM_01_PQB',
    name: 'National Pre-Qualification Bid (PQB)',
    category: 'Pre-Bidding & Tenders',
    phaseId: 'phase-1',
    icon: 'pi pi-file-edit',
    description: 'Pre-qualification bid terms, submission schedule, supply locations, and requirements',
    apiEndpoint: '/api/v1/pre-qualification-bids',
    fields: [
      { key: 'pqb_title', label: 'PQB Title', type: 'text', required: true, colSpan: 2 },
      { key: 'pqb_no', label: 'PQB No.', type: 'text', required: true, colSpan: 2 },
      { key: 'pqb_issuing_date', label: 'PQB Issuing Date', type: 'date', colSpan: 1 },
      { key: 'pqb_closing_date_time', label: 'PQB Closing Date & Time', type: 'datetime', colSpan: 1 },
      { key: 'pqb_opening_date_time', label: 'PQB Opening Date & Time', type: 'datetime', colSpan: 1 },
      {
        key: 'mode_of_bid_submission',
        label: 'Mode of Bid Submission',
        type: 'select',
        options: ['Online (e-Procurement)', 'Physical Hardcopy', 'Hybrid (Online + Physical)'],
        colSpan: 1,
      },
      { key: 'supply_location', label: 'Supply Location', type: 'text', colSpan: 4 },
    ],
    tableConfig: {
      title: 'Requirements',
      columns: [
        { key: 'sr_no', label: 'Sr. No.', type: 'number', width: '80px' },
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'unit', label: 'Unit', type: 'text', width: '120px' },
        { key: 'quantity', label: 'Quantity', type: 'number', width: '120px' },
      ],
    },
    uploads: [{ key: 'upload_pqb', label: 'Upload PQB Document', required: false, multiple: true }],
  },

  // ── 2. BID DOCUMENT FOR PQB ──────────────────────────────────────────────
  {
    id: 2,
    formCode: 'FORM_02_PQB_BID_DOCUMENT',
    name: 'Bid Document for PQB',
    category: 'Pre-Bidding & Tenders',
    phaseId: 'phase-1',
    icon: 'pi pi-book',
    description: 'Documentation for PQB submission, dates, and recorded corrigendum count',
    apiEndpoint: '/api/v1/pqb-bid-documents',
    fields: [
      { key: 'pqb_title', label: 'PQB Title', type: 'text', required: true, colSpan: 2 },
      { key: 'pqb_no', label: 'PQB No.', type: 'text', required: true, colSpan: 2 },
      { key: 'pqb_issue_date', label: 'PQB Issue Date', type: 'date', colSpan: 1 },
      { key: 'pqb_closing_date_time', label: 'PQB Closing Date & Time', type: 'datetime', colSpan: 1 },
      { key: 'pqb_opening_date_time', label: 'PQB Opening Date & Time', type: 'datetime', colSpan: 1 },
      { key: 'total_no_corrigendum_issued', label: 'Total No. Corrigendum Issued', type: 'number', colSpan: 1 },
    ],
    uploads: [{ key: 'upload_bid_document_pqb', label: 'Bid Document for PQB Upload', multiple: true }],
  },

  // ── 3. CORRIGENDUM ───────────────────────────────────────────────────────
  {
    id: 3,
    formCode: 'FORM_03_CORRIGENDUM',
    name: 'Corrigendum',
    category: 'Pre-Bidding & Tenders',
    phaseId: 'phase-1',
    icon: 'pi pi-sync',
    description: 'Corrigendum amendment notices issued against EOI, PQB, or Tender notices',
    apiEndpoint: '/api/v1/corrigendums',
    fields: [
      { key: 'corrigendum_no', label: 'Corrigendum No.', type: 'text', required: true, colSpan: 2 },
      { key: 'against_ref_no', label: 'Against EOI / PQB / Tender No.', type: 'text', required: true, colSpan: 2 },
      { key: 'ref_title', label: 'EOI / PQB / Tender Title', type: 'text', colSpan: 4 },
    ],
    uploads: [{ key: 'upload_corrigendum', label: 'Upload Corrigendum Document', multiple: true }],
  },

  // ── 4. LIMITED TENDER ENQUIRY (LTE) ──────────────────────────────────────
  {
    id: 4,
    formCode: 'FORM_04_LTE',
    name: 'Limited Tender Enquiry (LTE)',
    category: 'Pre-Bidding & Tenders',
    phaseId: 'phase-1',
    icon: 'pi pi-briefcase',
    description: 'LTE invitation terms, tender fee, EMD amounts, deadlines, and item specifications',
    apiEndpoint: '/api/v1/limited-tender-enquiries',
    fields: [
      { key: 'pqb_no', label: 'PQB No.', type: 'text', colSpan: 2 },
      { key: 'tender_title', label: 'Tender Title', type: 'text', required: true, colSpan: 2 },
      { key: 'tender_enquiry_no', label: 'Tender Enquiry No.', type: 'text', required: true, colSpan: 2 },
      { key: 'tender_issue_date', label: 'Tender Issue Date', type: 'date', colSpan: 2 },
      { key: 'bid_submission_due_date_time', label: 'Bid Submission Due Date & Time', type: 'datetime', colSpan: 2 },
      { key: 'bid_opening_date_time', label: 'Bid Opening Date & Time', type: 'datetime', colSpan: 2 },
      { key: 'tender_fee', label: 'Tender Fee', type: 'currency', prefix: '₹', colSpan: 1 },
      { key: 'emd', label: 'EMD (Earnest Money Deposit)', type: 'currency', prefix: '₹', colSpan: 1 },
      { key: 'tender_validity', label: 'Tender Validity (e.g. 90 Days)', type: 'text', colSpan: 2 },
    ],
    tableConfig: {
      title: 'Requirements',
      columns: [
        { key: 'sr_no', label: 'Sr. No.', type: 'number', width: '80px' },
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'unit', label: 'Unit', type: 'text', width: '120px' },
        { key: 'quantity', label: 'Quantity', type: 'number', width: '120px' },
      ],
    },
    uploads: [{ key: 'upload_lte', label: 'Upload LTE Document', multiple: true }],
  },

  // ── 5. NOTIFICATION OF AWARD OF CONTRACT (NAC) ───────────────────────────
  {
    id: 5,
    formCode: 'FORM_05_NAC',
    name: 'Notification of Award of Contract (NAC)',
    category: 'Pre-Bidding & Tenders',
    phaseId: 'phase-2',
    icon: 'pi pi-verified',
    description: 'Formal contract award notice and itemized awarded material price breakdown',
    apiEndpoint: '/api/v1/notification-awards',
    fields: [
      { key: 'nac_no', label: 'NAC No.', type: 'text', required: true, colSpan: 1 },
      { key: 'nac_date', label: 'NAC Date', type: 'date', colSpan: 1 },
      { key: 'nac_title', label: 'NAC Title', type: 'text', required: true, colSpan: 2 },
    ],
    tableConfig: {
      title: 'Awarded Materials',
      autoCalculateTotal: true,
      quantityKey: 'quantity',
      unitPriceKey: 'per_unit_price',
      totalKey: 'total_amount',
      columns: [
        { key: 'sr_no', label: 'Sr. No.', type: 'number', width: '80px' },
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'quantity', label: 'Quantity', type: 'number', width: '120px' },
        { key: 'per_unit_price', label: 'Per Unit Price', type: 'currency', width: '140px' },
        { key: 'total_amount', label: 'Total Amount', type: 'currency', width: '150px' },
      ],
    },
    uploads: [{ key: 'upload_nac', label: 'Upload NAC Document', multiple: true }],
  },

  // ── 6. CONSULTANCY INVOICE ───────────────────────────────────────────────
  {
    id: 6,
    formCode: 'FORM_06_CONSULTANCY_INVOICE',
    name: 'Consultancy Invoice',
    category: 'Pre-Bidding & Tenders',
    phaseId: 'phase-1',
    icon: 'pi pi-receipt',
    description: 'Advisory and specialist consultancy invoices associated with the project',
    apiEndpoint: '/api/v1/consultancy-invoices',
    fields: [
      { key: 'invoice_no', label: 'Invoice No.', type: 'text', required: true, colSpan: 2 },
      { key: 'invoice_date', label: 'Invoice Date', type: 'date', colSpan: 2 },
      { key: 'party_name', label: 'Party Name', type: 'text', required: true, colSpan: 2 },
      { key: 'invoice_reference', label: 'Invoice Reference', type: 'text', colSpan: 1 },
      { key: 'total_value_eur', label: 'Total Value (EUR)', type: 'currency', prefix: '€', colSpan: 1 },
    ],
    uploads: [{ key: 'upload_consultancy_invoice', label: 'Upload Consultancy Invoice', multiple: true }],
  },

  // ── 7. EXPRESSION OF INTEREST (EOI) ──────────────────────────────────────
  {
    id: 7,
    formCode: 'FORM_07_EOI',
    name: 'Expression of Interest (EOI)',
    category: 'Pre-Bidding & Tenders',
    phaseId: 'phase-1',
    icon: 'pi pi-compass',
    description: 'Expression of interest publication details, submission mode, and items required',
    apiEndpoint: '/api/v1/expressions-of-interest',
    fields: [
      { key: 'eoi_title', label: 'EOI Title', type: 'text', required: true, colSpan: 2 },
      { key: 'eoi_no', label: 'EOI No.', type: 'text', required: true, colSpan: 2 },
      { key: 'eoi_date', label: 'EOI Date', type: 'date', colSpan: 1 },
      { key: 'eoi_closing_date_time', label: 'EOI Closing Date & Time', type: 'datetime', colSpan: 1 },
      { key: 'eoi_opening_date_time', label: 'EOI Opening Date & Time', type: 'datetime', colSpan: 1 },
      {
        key: 'mode_of_submission',
        label: 'Mode of Submission',
        type: 'select',
        options: ['Online Portal', 'Physical Tender Box', 'Email Submission'],
        colSpan: 1,
      },
      { key: 'supply_location', label: 'Supply Location', type: 'text', colSpan: 4 },
    ],
    tableConfig: {
      title: 'Requirements',
      columns: [
        { key: 'sr_no', label: 'Sr. No.', type: 'number', width: '80px' },
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'unit', label: 'Unit', type: 'text', width: '120px' },
        { key: 'quantity', label: 'Quantity', type: 'number', width: '120px' },
      ],
    },
    uploads: [{ key: 'upload_eoi', label: 'Upload EOI Document', multiple: true }],
  },

  // ── 8. QUERY FROM CUSTOMER (Step 1) ──────────────────────────────────────
  {
    id: 8,
    formCode: 'FORM_08_CUSTOMER_QUERY',
    name: 'Query from Customer',
    category: 'Sourcing & Quotations',
    phaseId: 'phase-1',
    icon: 'pi pi-question-circle',
    description: 'Direct inquiry from customer detailing specific material requirements and quantities',
    apiEndpoint: '/api/v1/customer-queries',
    fields: [
      { key: 'customer_name', label: 'Customer / Organization Name', type: 'text', required: true, colSpan: 2 },
      { key: 'query_date', label: 'Query Date', type: 'date', required: true, colSpan: 2 },
    ],
    tableConfig: {
      title: 'Requirement',
      columns: [
        { key: 'sr_no', label: 'Sr. No.', type: 'number', width: '80px' },
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'quantity', label: 'Quantity', type: 'number', width: '140px' },
      ],
    },
    uploads: [{ key: 'upload_query', label: 'Upload Query Document', multiple: true }],
  },

  // ── 9. REQUEST FOR QUOTATION (RFQ) (Step 2) ──────────────────────────────
  {
    id: 9,
    formCode: 'FORM_09_RFQ',
    name: 'Request for Quotation (RFQ)',
    category: 'Sourcing & Quotations',
    phaseId: 'phase-1',
    icon: 'pi pi-send',
    description: 'Dispatch RFQ to prospective vendors and suppliers with requirements',
    apiEndpoint: '/api/v1/quotation-requests',
    fields: [
      { key: 'supplier_name', label: 'Supplier Name', type: 'text', required: true, colSpan: 2 },
      { key: 'request_date', label: 'Request Date', type: 'date', required: true, colSpan: 2 },
    ],
    tableConfig: {
      title: 'Requirements',
      columns: [
        { key: 'sr_no', label: 'Sr. No.', type: 'number', width: '80px' },
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'quantity', label: 'Quantity', type: 'number', width: '140px' },
      ],
    },
    uploads: [{ key: 'upload_rfq', label: 'Upload RFQ Document', multiple: true }],
  },

  // ── 10. COST SHEET (Step 4) ──────────────────────────────────────────────
  {
    id: 10,
    formCode: 'FORM_10_COST_SHEET',
    name: 'Cost Sheet',
    category: 'Sourcing & Quotations',
    phaseId: 'phase-1',
    icon: 'pi pi-calculator',
    description: 'Complete commercial cost matrix including duties, forex buffers, logistics, and margins',
    apiEndpoint: '/api/v1/cost-sheets',
    fields: [
      { key: 'project_title', label: 'Project Title', type: 'text', required: true, colSpan: 4, sectionTitle: '1. Project & Foreign Currency Valuation (Forex)' },
      { key: 'total_amount_eur', label: 'Total Amount in EUR', type: 'currency', prefix: '€', colSpan: 2 },
      { key: 'eur_to_inr_rate_prep', label: 'EUR to INR Rate on Prep Date', type: 'number', colSpan: 1 },
      { key: 'eur_to_inr_rate_buffer', label: 'EUR to INR Rate with Buffer', type: 'number', colSpan: 1 },

      { key: 'freight_insurance_pct', label: 'Freight & Insurance %', type: 'number', suffix: '%', colSpan: 1, sectionTitle: '2. Freight, Insurance & Customs Duty' },
      { key: 'freight_insurance_amount', label: 'Freight & Insurance Amount', type: 'currency', prefix: '₹', colSpan: 1 },
      { key: 'custom_duty_pct', label: 'Custom Duty %', type: 'number', suffix: '%', colSpan: 1 },
      { key: 'custom_duty_amount', label: 'Custom Duty Amount', type: 'currency', prefix: '₹', colSpan: 1 },

      { key: 'igst_pct', label: 'IGST %', type: 'number', suffix: '%', colSpan: 1, sectionTitle: '3. Taxes & Inland Transportation' },
      { key: 'igst_amount', label: 'IGST Amount', type: 'currency', prefix: '₹', colSpan: 1 },
      { key: 'transportation_pct', label: 'Transportation %', type: 'number', suffix: '%', colSpan: 1 },
      { key: 'transportation_amount', label: 'Transportation Amount', type: 'currency', prefix: '₹', colSpan: 1 },

      { key: 'finance_charges_pct', label: 'Finance Charges %', type: 'number', suffix: '%', colSpan: 1, sectionTitle: '4. Commercial Margins & Financing Charges' },
      { key: 'finance_charges_amount', label: 'Finance Charges Amount', type: 'currency', prefix: '₹', colSpan: 1 },
      { key: 'margin_pct', label: 'Margin %', type: 'number', suffix: '%', colSpan: 1 },
      { key: 'margin_amount', label: 'Margin Amount', type: 'currency', prefix: '₹', colSpan: 1 },

      { key: 'gst_pct', label: 'GST %', type: 'number', suffix: '%', colSpan: 2, sectionTitle: '5. Goods & Services Tax (GST)' },
      { key: 'gst_amount', label: 'GST Amount', type: 'currency', prefix: '₹', colSpan: 2 },
    ],
    uploads: [{ key: 'upload_cost_sheet', label: 'Upload Cost Sheet', multiple: true }],
  },

  // ── 11. QUOTATION FROM SUPPLIER (Step 3) ─────────────────────────────────
  {
    id: 11,
    formCode: 'FORM_11_SUPPLIER_QUOTATION',
    name: 'Quotation from Supplier',
    category: 'Sourcing & Quotations',
    phaseId: 'phase-1',
    icon: 'pi pi-tags',
    description: 'Detailed quotation received from vendor with HSN/SAC codes, incoterms, and pricing',
    apiEndpoint: '/api/v1/supplier-quotations',
    fields: [
      { key: 'supplier_name', label: 'Supplier Name', type: 'text', required: true, colSpan: 2 },
      { key: 'quotation_no', label: 'Quotation No.', type: 'text', required: true, colSpan: 1 },
      { key: 'quotation_date', label: 'Quotation Date', type: 'date', colSpan: 1 },
      { key: 'quotation_value', label: 'Quotation Value', type: 'currency', colSpan: 2 },
      { key: 'quotation_validity', label: 'Quotation Validity', type: 'text', colSpan: 2 },
      { key: 'incoterms', label: 'Incoterms (e.g. FOB, CIF, EXW)', type: 'text', colSpan: 1 },
      { key: 'payment_terms', label: 'Payment Terms', type: 'text', colSpan: 1 },
      { key: 'delivery_period', label: 'Delivery Period', type: 'text', colSpan: 1 },
      { key: 'warranty_period', label: 'Warranty Period', type: 'text', colSpan: 1 },
    ],
    tableConfig: {
      title: 'Quoted Materials & Pricing',
      autoCalculateTotal: true,
      quantityKey: 'quantity',
      unitPriceKey: 'unit_price',
      totalKey: 'total_amount',
      columns: [
        { key: 'sr_no', label: 'Sr. No.', type: 'number', width: '80px' },
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'hsn_sac', label: 'HSN / SAC', type: 'text', width: '130px' },
        { key: 'quantity', label: 'Quantity', type: 'number', width: '110px' },
        { key: 'unit_price', label: 'Unit Price', type: 'currency', width: '130px' },
        { key: 'total_amount', label: 'Total Amount', type: 'currency', width: '150px' },
      ],
    },
    uploads: [{ key: 'upload_quotation', label: 'Upload Supplier Quotation', multiple: true }],
  },

  // ── 12. QUOTATION TO CUSTOMER (Step 5) ───────────────────────────────────
  {
    id: 12,
    formCode: 'FORM_12_CUSTOMER_QUOTATION',
    name: 'Quotation to Customer',
    category: 'Sourcing & Quotations',
    phaseId: 'phase-1',
    icon: 'pi pi-file-o',
    description: 'Final commercial offer sent to customer with itemized rates and validity',
    apiEndpoint: '/api/v1/customer-quotations',
    fields: [
      { key: 'customer_name', label: 'Customer / Organization Name', type: 'text', required: true, colSpan: 2 },
      { key: 'quotation_no', label: 'Quotation No.', type: 'text', required: true, colSpan: 1 },
      { key: 'quotation_date', label: 'Quotation Date', type: 'date', colSpan: 1 },
      { key: 'quotation_value', label: 'Quotation Value', type: 'currency', colSpan: 2 },
      { key: 'quotation_validity', label: 'Quotation Validity', type: 'text', colSpan: 2 },
    ],
    tableConfig: {
      title: 'Quoted Materials & Pricing',
      autoCalculateTotal: true,
      quantityKey: 'quantity',
      unitPriceKey: 'unit_price',
      totalKey: 'total_amount',
      columns: [
        { key: 'sr_no', label: 'Sr. No.', type: 'number', width: '80px' },
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'hsn_sac', label: 'HSN / SAC', type: 'text', width: '130px' },
        { key: 'quantity', label: 'Quantity', type: 'number', width: '110px' },
        { key: 'unit_price', label: 'Unit Price', type: 'currency', width: '130px' },
        { key: 'total_amount', label: 'Total Amount', type: 'currency', width: '150px' },
      ],
    },
    uploads: [{ key: 'upload_quotation', label: 'Upload Customer Quotation', multiple: true }],
  },

  // ── 13. PAC TENDER (Step 6) ──────────────────────────────────────────────
  {
    id: 13,
    formCode: 'FORM_13_PAC_TENDER',
    name: 'PAC Tender',
    category: 'Pre-Bidding & Tenders',
    phaseId: 'phase-2',
    icon: 'pi pi-building',
    description: 'Proprietary Article Certificate (PAC) tender enquiry terms, dates, and specifications',
    apiEndpoint: '/api/v1/customer-tenders',
    fields: [
      { key: 'customer_name', label: 'Customer / Organization Name', type: 'text', required: true, colSpan: 2 },
      { key: 'tender_title', label: 'Tender Title', type: 'text', required: true, colSpan: 2 },
      { key: 'tender_no', label: 'Tender No.', type: 'text', required: true, colSpan: 2 },
      { key: 'tender_issue_date', label: 'Tender Issue Date', type: 'date', colSpan: 2 },
      { key: 'closing_date_time', label: 'Closing Date & Time', type: 'datetime', colSpan: 2 },
      { key: 'opening_date_time', label: 'Opening Date & Time', type: 'datetime', colSpan: 2 },
      { key: 'tender_fee', label: 'Tender Fee', type: 'currency', colSpan: 1 },
      { key: 'validity', label: 'Validity', type: 'text', colSpan: 1 },
      { key: 'delivery_terms', label: 'Delivery Terms', type: 'text', colSpan: 1 },
      { key: 'delivery_period', label: 'Delivery Period', type: 'text', colSpan: 1 },
      { key: 'payment_terms', label: 'Payment Terms', type: 'text', colSpan: 2 },
      { key: 'warranty_period', label: 'Warranty Period', type: 'text', colSpan: 2 },
    ],
    tableConfig: {
      title: 'Requirements',
      columns: [
        { key: 'sr_no', label: 'Sr. No.', type: 'number', width: '80px' },
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'unit', label: 'Unit', type: 'text', width: '120px' },
        { key: 'quantity', label: 'Quantity', type: 'number', width: '120px' },
      ],
    },
    uploads: [{ key: 'upload_tender_document', label: 'Upload Tender Document', multiple: true }],
  },

  // ── 14. PURCHASE ORDER (PO) (Step 8) ─────────────────────────────────────
  {
    id: 14,
    formCode: 'FORM_14_PURCHASE_ORDER',
    name: 'Purchase Order (PO)',
    category: 'Supplier Orders & Invoices',
    phaseId: 'phase-2',
    icon: 'pi pi-shopping-bag',
    description: 'Formal purchase order contractual commitment with delivery dates and items',
    apiEndpoint: '/api/v1/purchase-orders',
    fields: [
      { key: 'customer_name', label: 'Customer / Organization Name', type: 'text', required: true, colSpan: 2 },
      { key: 'po_title', label: 'PO Title', type: 'text', required: true, colSpan: 2 },
      { key: 'po_no', label: 'PO No.', type: 'text', required: true, colSpan: 2 },
      { key: 'po_date', label: 'PO Date', type: 'date', colSpan: 2 },
      { key: 'delivery_terms', label: 'Delivery Terms', type: 'text', colSpan: 1 },
      { key: 'payment_terms', label: 'Payment Terms', type: 'text', colSpan: 1 },
      { key: 'warranty_period', label: 'Warranty Period', type: 'text', colSpan: 1 },
      { key: 'gst_rate_pct', label: 'GST Rate %', type: 'number', suffix: '%', colSpan: 1 },
    ],
    tableConfig: {
      title: 'Ordered Materials/Services & Pricing',
      autoCalculateTotal: true,
      quantityKey: 'quantity',
      unitPriceKey: 'unit_price',
      totalKey: 'total_price',
      columns: [
        { key: 'sr_no', label: 'Sr. No.', type: 'number', width: '70px' },
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'hsn_sac', label: 'HSN / SAC', type: 'text', width: '110px' },
        { key: 'unit', label: 'Unit', type: 'text', width: '90px' },
        { key: 'quantity', label: 'Quantity', type: 'number', width: '100px' },
        { key: 'unit_price', label: 'Unit Price', type: 'currency', width: '120px' },
        { key: 'total_price', label: 'Total Price', type: 'currency', width: '130px' },
        { key: 'delivery_date', label: 'Delivery Date', type: 'date', width: '140px' },
      ],
    },
    uploads: [{ key: 'upload_po', label: 'Upload PO Document', multiple: true }],
  },

  // ── 15. BID DOCUMENT (Step 7) ────────────────────────────────────────────
  {
    id: 15,
    formCode: 'FORM_15_BID_DOCUMENT',
    name: 'Bid Document',
    category: 'Pre-Bidding & Tenders',
    phaseId: 'phase-2',
    icon: 'pi pi-folder-open',
    description: 'Bid submission submission data, corrigendum counts, and quoted tender pricing',
    apiEndpoint: '/api/v1/bid-submissions',
    fields: [
      { key: 'customer_name', label: 'Customer / Organization Name', type: 'text', required: true, colSpan: 2 },
      { key: 'tender_title', label: 'Tender Title', type: 'text', required: true, colSpan: 2 },
      { key: 'tender_no', label: 'Tender No.', type: 'text', required: true, colSpan: 1 },
      { key: 'tender_issue_date', label: 'Tender Issue Date', type: 'date', colSpan: 1 },
      { key: 'total_no_corrigendum_issued', label: 'Total No. Corrigendum Issued', type: 'number', colSpan: 1 },
      { key: 'bid_submission_date', label: 'Bid Submission Date', type: 'date', colSpan: 1 },
      { key: 'delivery_terms', label: 'Delivery Terms', type: 'text', colSpan: 1 },
      { key: 'delivery_period', label: 'Delivery Period', type: 'text', colSpan: 1 },
      { key: 'bid_validity', label: 'Bid Validity', type: 'text', colSpan: 1 },
      { key: 'payment_terms', label: 'Payment Terms', type: 'text', colSpan: 1 },
      { key: 'warranty_period', label: 'Warranty Period', type: 'text', colSpan: 2 },
      { key: 'gst_pct', label: 'GST (%)', type: 'number', suffix: '%', colSpan: 2 },
    ],
    tableConfig: {
      title: 'Bid Materials/Services & Pricing',
      autoCalculateTotal: true,
      quantityKey: 'quantity',
      unitPriceKey: 'unit_price',
      totalKey: 'total_amount',
      columns: [
        { key: 'sr_no', label: 'Sr. No.', type: 'number', width: '80px' },
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'hsn_sac', label: 'HSN / SAC', type: 'text', width: '130px' },
        { key: 'quantity', label: 'Quantity', type: 'number', width: '110px' },
        { key: 'unit_price', label: 'Unit Price', type: 'currency', width: '130px' },
        { key: 'total_amount', label: 'Total Amount', type: 'currency', width: '150px' },
      ],
    },
    uploads: [{ key: 'upload_bid_document', label: 'Upload Bid Document', multiple: true }],
  },

  // ── 16. ORDER CONFIRMATION TO SUPPLIER (Step 9) ──────────────────────────
  {
    id: 16,
    formCode: 'FORM_16_ORDER_CONFIRMATION',
    name: 'Order Confirmation to Supplier',
    category: 'Supplier Orders & Invoices',
    phaseId: 'phase-2',
    icon: 'pi pi-check-square',
    description: 'Acknowledgement and formal confirmation placed with supplier for production',
    apiEndpoint: '/api/v1/order-confirmations',
    fields: [
      { key: 'supplier_name', label: 'Supplier Name', type: 'text', required: true, colSpan: 2 },
      { key: 'order_confirmation_no', label: 'Order Confirmation No.', type: 'text', required: true, colSpan: 1 },
      { key: 'order_confirmation_date', label: 'Order Confirmation Date', type: 'date', colSpan: 1 },
      { key: 'incoterms', label: 'Incoterms', type: 'text', colSpan: 1 },
      { key: 'delivery_period', label: 'Delivery Period', type: 'text', colSpan: 1 },
      { key: 'warranty_period', label: 'Warranty Period', type: 'text', colSpan: 1 },
      { key: 'payment_terms', label: 'Payment Terms', type: 'text', colSpan: 1 },
    ],
    tableConfig: {
      title: 'Confirmed Materials & Pricing',
      autoCalculateTotal: true,
      quantityKey: 'quantity',
      unitPriceKey: 'unit_price',
      totalKey: 'total_amount',
      columns: [
        { key: 'sr_no', label: 'Sr. No.', type: 'number', width: '80px' },
        { key: 'hsn_sac', label: 'HSN / SAC', type: 'text', width: '130px' },
        { key: 'quantity', label: 'Quantity', type: 'number', width: '120px' },
        { key: 'unit_price', label: 'Unit Price', type: 'currency', width: '140px' },
        { key: 'total_amount', label: 'Total Amount', type: 'currency', width: '150px' },
      ],
    },
    uploads: [{ key: 'upload_order_confirmation', label: 'Upload Order Confirmation', multiple: true }],
  },

  // ── 17. SUPPLIER\'S PROFORMA INVOICE ──────────────────────────────────────
  {
    id: 17,
    formCode: 'FORM_17_PROFORMA_INVOICE',
    name: "Supplier's Proforma Invoice",
    category: 'Supplier Orders & Invoices',
    phaseId: 'phase-2',
    icon: 'pi pi-file-invoice',
    description: 'Proforma invoice received from vendor prior to dispatch / foreign remittance',
    apiEndpoint: '/api/v1/proforma-invoices',
    fields: [
      { key: 'supplier_name', label: 'Supplier Name', type: 'text', required: true, colSpan: 2 },
      { key: 'proforma_invoice_no', label: 'Proforma Invoice No.', type: 'text', required: true, colSpan: 1 },
      { key: 'proforma_invoice_date', label: 'Proforma Invoice Date', type: 'date', colSpan: 1 },
      { key: 'incoterms', label: 'Incoterms', type: 'text', colSpan: 1 },
      { key: 'payment_terms', label: 'Payment Terms', type: 'text', colSpan: 1 },
      { key: 'warranty_period', label: 'Warranty Period', type: 'text', colSpan: 1 },
      { key: 'delivery_period', label: 'Delivery Period', type: 'text', colSpan: 1 },
    ],
    tableConfig: {
      title: 'Quoted Materials & Pricing',
      autoCalculateTotal: true,
      quantityKey: 'quantity',
      unitPriceKey: 'unit_price',
      totalKey: 'total_amount',
      columns: [
        { key: 'sr_no', label: 'Sr. No.', type: 'number', width: '80px' },
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'hsn_sac', label: 'HSN / SAC', type: 'text', width: '130px' },
        { key: 'quantity', label: 'Quantity', type: 'number', width: '110px' },
        { key: 'unit_price', label: 'Unit Price', type: 'currency', width: '130px' },
        { key: 'total_amount', label: 'Total Amount', type: 'currency', width: '150px' },
      ],
    },
    uploads: [{ key: 'upload_proforma_invoice', label: 'Upload Proforma Invoice', multiple: true }],
  },

  // ── 18. SUPPLIER\'S INVOICE (Step 10) ─────────────────────────────────────
  {
    id: 18,
    formCode: 'FORM_18_SUPPLIER_INVOICE',
    name: "Supplier's Invoice",
    category: 'Supplier Orders & Invoices',
    phaseId: 'phase-3',
    icon: 'pi pi-receipt',
    description: 'Commercial invoice issued by supplier covering final shipped goods',
    apiEndpoint: '/api/v1/supplier-invoices',
    fields: [
      { key: 'supplier_name', label: 'Supplier Name', type: 'text', required: true, colSpan: 2 },
      { key: 'invoice_no', label: 'Invoice No.', type: 'text', required: true, colSpan: 1 },
      { key: 'invoice_date', label: 'Invoice Date', type: 'date', colSpan: 1 },
      { key: 'incoterms', label: 'Incoterms', type: 'text', colSpan: 1 },
      { key: 'payment_terms', label: 'Payment Terms', type: 'text', colSpan: 1 },
      { key: 'warranty_period', label: 'Warranty Period', type: 'text', colSpan: 1 },
      { key: 'delivery_period', label: 'Delivery Period', type: 'text', colSpan: 1 },
    ],
    tableConfig: {
      title: 'Quoted Materials & Pricing',
      autoCalculateTotal: true,
      quantityKey: 'quantity',
      unitPriceKey: 'unit_price',
      totalKey: 'total_amount',
      columns: [
        { key: 'sr_no', label: 'Sr. No.', type: 'number', width: '80px' },
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'hsn_sac', label: 'HSN / SAC', type: 'text', width: '130px' },
        { key: 'quantity', label: 'Quantity', type: 'number', width: '110px' },
        { key: 'unit_price', label: 'Unit Price', type: 'currency', width: '130px' },
        { key: 'total_amount', label: 'Total Amount', type: 'currency', width: '150px' },
      ],
    },
    uploads: [{ key: 'upload_invoice', label: 'Upload Supplier Invoice', multiple: true }],
  },

  // ── 19. SUPPLIER\'S PACKING LIST ──────────────────────────────────────────
  {
    id: 19,
    formCode: 'FORM_19_SUPPLIER_PACKING_LIST',
    name: "Supplier's Packing List",
    category: 'Logistics & Customs',
    phaseId: 'phase-3',
    icon: 'pi pi-box',
    description: 'Inventory package list with tare/gross weights provided by the supplier',
    apiEndpoint: '/api/v1/supplier-packing-lists',
    fields: [
      { key: 'packing_list_no', label: 'Packing List No.', type: 'text', required: true, colSpan: 2 },
      { key: 'packing_list_date', label: 'Packing List Date', type: 'date', colSpan: 2 },
      { key: 'gross_weight', label: 'Gross Weight (kg)', type: 'number', colSpan: 1 },
      { key: 'net_weight', label: 'Net Weight (kg)', type: 'number', colSpan: 1 },
      { key: 'total_no_packages', label: 'Total No. Packages', type: 'number', colSpan: 2 },
    ],
    tableConfig: {
      title: 'Material Details',
      columns: [
        { key: 'sr_no', label: 'Sr. No.', type: 'number', width: '80px' },
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'hsn_sac', label: 'HSN / SAC', type: 'text', width: '130px' },
        { key: 'unit_weight', label: 'Unit Weight (kg)', type: 'number', width: '130px' },
        { key: 'total_weight', label: 'Total Weight (kg)', type: 'number', width: '140px' },
      ],
    },
    uploads: [{ key: 'upload_packing_list', label: 'Upload Supplier Packing List', multiple: true }],
  },

  // ── 20. PAYMENT TO SUPPLIER (Step 15) ────────────────────────────────────
  {
    id: 20,
    formCode: 'FORM_20_PAYMENT_TO_SUPPLIER',
    name: 'Payment to Supplier',
    category: 'Customer & Supplier Settlement',
    phaseId: 'phase-4',
    icon: 'pi pi-wallet',
    description: 'Forex remittance transfer, SWIFT debit advice, exchange rates, and balances',
    apiEndpoint: '/api/v1/supplier-payments',
    fields: [
      { key: 'total_contract_value', label: 'Total Contract Value', type: 'currency', colSpan: 2 },
      { key: 'payment_pct', label: 'Payment (%)', type: 'number', suffix: '%', colSpan: 1 },
      { key: 'payment_amount', label: 'Payment Amount', type: 'currency', colSpan: 1 },
      { key: 'payment_date', label: 'Payment Date', type: 'date', colSpan: 1 },
      { key: 'eur_to_inr_rate', label: 'EUR to INR Rate on Payment Date', type: 'number', colSpan: 1 },
      { key: 'payment_amount_inr', label: 'Payment Amount in INR', type: 'currency', prefix: '₹', colSpan: 2 },
      { key: 'bank_charges', label: 'Bank Charges', type: 'currency', prefix: '₹', colSpan: 1 },
      { key: 'swift_charges', label: 'SWIFT Charges', type: 'currency', prefix: '₹', colSpan: 1 },
      { key: 'reference_no', label: 'Reference / UTR No.', type: 'text', colSpan: 1 },
      { key: 'pending_amount', label: 'Pending Amount', type: 'currency', colSpan: 1 },
    ],
    uploads: [
      { key: 'upload_swift_copy', label: 'Upload SWIFT Copy' },
      { key: 'upload_debit_advice', label: 'Upload Debit Advice cum Invoice' },
    ],
  },

  // ── 21. TRANSPORTATION DETAILS (Step 12) ─────────────────────────────────
  {
    id: 21,
    formCode: 'FORM_21_TRANSPORTATION_DETAILS',
    name: 'Transportation Details',
    category: 'Logistics & Customs',
    phaseId: 'phase-3',
    icon: 'pi pi-truck',
    description: 'Inland transport details, carrier consignments, LR/AWB receipts and charges',
    apiEndpoint: '/api/v1/import-logistics',
    fields: [
      {
        key: 'transportation_mode',
        label: 'Transportation Mode',
        type: 'select',
        options: ['Road Freight (Truck)', 'Air Cargo', 'Sea Ocean Cargo', 'Rail Freight'],
        colSpan: 2,
      },
      { key: 'lr_rr_awb_no', label: 'LR / RR / AWB No.', type: 'text', required: true, colSpan: 1 },
      { key: 'lr_rr_awb_date', label: 'LR / RR / AWB Date', type: 'date', colSpan: 1 },
      { key: 'from_location', label: 'From Location', type: 'text', colSpan: 2 },
      { key: 'to_location', label: 'To Location', type: 'text', colSpan: 2 },
      { key: 'total_transportation_charges', label: 'Total Transportation Charges', type: 'currency', prefix: '₹', colSpan: 4 },
    ],
    uploads: [{ key: 'upload_transportation_doc', label: 'Upload Transportation Document', multiple: true }],
  },

  // ── 22. PAYMENT FROM CUSTOMER (Step 14) ──────────────────────────────────
  {
    id: 22,
    formCode: 'FORM_22_PAYMENT_FROM_CUSTOMER',
    name: 'Payment from Customer',
    category: 'Customer & Supplier Settlement',
    phaseId: 'phase-4',
    icon: 'pi pi-dollar',
    description: 'Receivables from customer, TDS/LD deductions, and balance settlement',
    apiEndpoint: '/api/v1/customer-payments',
    fields: [
      { key: 'payment_against_invoice_no', label: 'Payment Against Invoice No.', type: 'text', required: true, colSpan: 2 },
      { key: 'invoice_date', label: 'Invoice Date', type: 'date', colSpan: 1 },
      { key: 'invoice_value', label: 'Invoice Value', type: 'currency', prefix: '₹', colSpan: 1 },
      { key: 'payment_received', label: 'Payment Received', type: 'currency', prefix: '₹', required: true, colSpan: 2 },
      { key: 'payment_received_date', label: 'Payment Received Date', type: 'date', colSpan: 2 },
      { key: 'tds_deducted', label: 'TDS Deducted', type: 'currency', prefix: '₹', colSpan: 1 },
      { key: 'ld_deducted', label: 'LD (Liquidated Damages) Deducted', type: 'currency', prefix: '₹', colSpan: 1 },
      { key: 'balance_amount', label: 'Balance Amount', type: 'currency', prefix: '₹', colSpan: 2 },
    ],
    uploads: [{ key: 'upload_payment_advice', label: 'Upload Payment Advice / Supporting Document', multiple: true }],
  },

  // ── 23. WARRANTY CERTIFICATE ─────────────────────────────────────────────
  {
    id: 23,
    formCode: 'FORM_23_WARRANTY_CERTIFICATE',
    name: 'Warranty Certificate',
    category: 'Customer & Supplier Settlement',
    phaseId: 'phase-4',
    icon: 'pi pi-shield',
    description: 'Manufacturer warranty coverage document referencing PO and invoices',
    apiEndpoint: '/api/v1/warranty-certificates',
    fields: [
      { key: 'certificate_date', label: 'Certificate Date', type: 'date', required: true, colSpan: 2 },
      { key: 'warranty_period', label: 'Warranty Period (e.g. 24 Months)', type: 'text', required: true, colSpan: 2 },
      { key: 'po_no', label: 'PO No.', type: 'text', colSpan: 1 },
      { key: 'po_date', label: 'PO Date', type: 'date', colSpan: 1 },
      { key: 'invoice_no', label: 'Invoice No.', type: 'text', colSpan: 1 },
      { key: 'invoice_date', label: 'Invoice Date', type: 'date', colSpan: 1 },
    ],
    uploads: [{ key: 'upload_warranty_certificate', label: 'Upload Warranty Certificate', multiple: true }],
  },

  // ── 24. DELIVERY CHALLAN TO CUSTOMER (Step 13) ───────────────────────────
  {
    id: 24,
    formCode: 'FORM_24_DELIVERY_CHALLAN',
    name: 'Delivery Challan to Customer',
    category: 'Customer & Supplier Settlement',
    phaseId: 'phase-4',
    icon: 'pi pi-send',
    description: 'Dispatch challan with material items and consignee acknowledgement proof',
    apiEndpoint: '/api/v1/delivery-challans',
    fields: [
      { key: 'delivery_challan_no', label: 'Delivery Challan No.', type: 'text', required: true, colSpan: 2 },
      { key: 'delivery_challan_date', label: 'Delivery Challan Date', type: 'date', colSpan: 2 },
    ],
    tableConfig: {
      title: 'Material Details',
      autoCalculateTotal: true,
      unitPriceKey: 'unit_price',
      totalKey: 'total_amount',
      columns: [
        { key: 'sr_no', label: 'Sr. No.', type: 'number', width: '80px' },
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'hsn_sac', label: 'HSN / SAC', type: 'text', width: '140px' },
        { key: 'unit_price', label: 'Unit Price', type: 'currency', width: '140px' },
        { key: 'total_amount', label: 'Total Amount', type: 'currency', width: '160px' },
      ],
    },
    uploads: [{ key: 'upload_delivery_challan', label: 'Upload Delivery Challan', multiple: true }],
  },

  // ── 25. PACKING LIST TO CUSTOMER ─────────────────────────────────────────
  {
    id: 25,
    formCode: 'FORM_25_CUSTOMER_PACKING_LIST',
    name: 'Packing List to Customer',
    category: 'Customer & Supplier Settlement',
    phaseId: 'phase-4',
    icon: 'pi pi-box',
    description: 'Final packing list delivered to the customer with tare and box specifications',
    apiEndpoint: '/api/v1/customer-packing-lists',
    fields: [
      { key: 'packing_list_no', label: 'Packing List No.', type: 'text', required: true, colSpan: 2 },
      { key: 'packing_list_date', label: 'Packing List Date', type: 'date', colSpan: 2 },
      { key: 'gross_weight', label: 'Gross Weight (kg)', type: 'number', colSpan: 1 },
      { key: 'net_weight', label: 'Net Weight (kg)', type: 'number', colSpan: 1 },
      { key: 'total_no_packages', label: 'Total No. Packages', type: 'number', colSpan: 2 },
    ],
    tableConfig: {
      title: 'Material Details',
      columns: [
        { key: 'sr_no', label: 'Sr. No.', type: 'number', width: '80px' },
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'hsn_sac', label: 'HSN / SAC', type: 'text', width: '130px' },
        { key: 'unit_weight', label: 'Unit Weight (kg)', type: 'number', width: '130px' },
        { key: 'total_weight', label: 'Total Weight (kg)', type: 'number', width: '140px' },
      ],
    },
    uploads: [{ key: 'upload_packing_list', label: 'Upload Packing List', multiple: true }],
  },

  // ── 26. TAX INVOICE TO CUSTOMER ──────────────────────────────────────────
  {
    id: 26,
    formCode: 'FORM_26_TAX_INVOICE_CUSTOMER',
    name: 'Tax Invoice to Customer',
    category: 'Customer & Supplier Settlement',
    phaseId: 'phase-4',
    icon: 'pi pi-file',
    description: 'Final sales tax invoice billed to the customer for complete supply and service',
    apiEndpoint: '/api/v1/customer-tax-invoices',
    fields: [
      { key: 'customer_name', label: 'Customer / Organization Name', type: 'text', required: true, colSpan: 2 },
      { key: 'invoice_no', label: 'Invoice No.', type: 'text', required: true, colSpan: 1 },
      { key: 'invoice_date', label: 'Invoice Date', type: 'date', colSpan: 1 },
    ],
    tableConfig: {
      title: 'Material Description & Pricing',
      autoCalculateTotal: true,
      quantityKey: 'quantity',
      unitPriceKey: 'unit_price',
      totalKey: 'total_amount',
      columns: [
        { key: 'sr_no', label: 'Sr. No.', type: 'number', width: '80px' },
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'hsn_sac', label: 'HSN / SAC', type: 'text', width: '130px' },
        { key: 'quantity', label: 'Quantity', type: 'number', width: '110px' },
        { key: 'unit_price', label: 'Unit Price', type: 'currency', width: '130px' },
        { key: 'total_amount', label: 'Total Amount', type: 'currency', width: '150px' },
      ],
    },
    uploads: [{ key: 'upload_invoice', label: 'Upload Tax Invoice', multiple: true }],
  },

  // ── 27. SHIPPING & CLEARANCE (Step 11 & 12) ──────────────────────────────
  {
    id: 27,
    formCode: 'FORM_27_SHIPPING_CLEARANCE',
    name: 'Shipping & Clearance',
    category: 'Logistics & Customs',
    phaseId: 'phase-3',
    icon: 'pi pi-globe',
    description: 'Port logistics, customs Bill of Entry (BOE), duties, IGST, and clearance tracking',
    apiEndpoint: '/api/v1/bill-of-entries',
    fields: [
      {
        key: 'logistic_mode',
        label: 'Logistic Mode',
        type: 'select',
        options: ['Air Freight', 'Sea Ocean Freight', 'Courier Express', 'Land Border'],
        colSpan: 1,
      },
      { key: 'shipment_date', label: 'Shipment Date', type: 'date', colSpan: 1 },
      { key: 'awb_bl_no', label: 'AWB / Bill of Lading No.', type: 'text', required: true, colSpan: 2 },
      { key: 'flight_vessel_name', label: 'Flight / Vessel Name', type: 'text', colSpan: 1 },
      { key: 'flight_vessel_no', label: 'Flight / Vessel No.', type: 'text', colSpan: 1 },
      { key: 'port_loading', label: 'Port / Airport of Loading', type: 'text', colSpan: 1 },
      { key: 'port_discharge', label: 'Port / Airport of Discharge', type: 'text', colSpan: 1 },
      { key: 'bill_of_entry_no', label: 'Bill of Entry (BOE) No.', type: 'text', required: true, colSpan: 2 },
      { key: 'boe_filing_date', label: 'BOE Filing Date', type: 'date', colSpan: 2 },
      { key: 'total_assessable_value', label: 'Total Assessable Value (INR)', type: 'currency', prefix: '₹', colSpan: 1 },
      { key: 'basic_custom_duty_bcd', label: 'Basic Custom Duty (BCD)', type: 'currency', prefix: '₹', colSpan: 1 },
      { key: 'sws', label: 'SWS (Social Welfare Surcharge)', type: 'currency', prefix: '₹', colSpan: 1 },
      { key: 'igst', label: 'IGST (Customs)', type: 'currency', prefix: '₹', colSpan: 1 },
      { key: 'duty_paid_date', label: 'Duty Paid Date', type: 'date', colSpan: 1 },
      { key: 'challan_no', label: 'Duty Challan No.', type: 'text', colSpan: 1 },
      { key: 'payment_ref_no', label: 'Transaction / Payment Ref No.', type: 'text', colSpan: 2 },
      { key: 'customs_location', label: 'Customs Location', type: 'text', colSpan: 2 },
      { key: 'cfs_name', label: 'CFS Name (Container Freight Station)', type: 'text', colSpan: 2 },
    ],
    uploads: [
      { key: 'upload_shipping_doc', label: 'Upload Shipping Document' },
      { key: 'upload_boe', label: 'Upload Bill of Entry (BOE)' },
      { key: 'upload_other_doc', label: 'Upload Other Supporting Documents' },
    ],
  },

  // ── 28. FREIGHT FORWARDER / CHA DETAILS ──────────────────────────────────
  {
    id: 28,
    formCode: 'FORM_28_FREIGHT_CHA',
    name: 'Freight Forwarder / CHA Details',
    category: 'Logistics & Customs',
    phaseId: 'phase-3',
    icon: 'pi pi-users',
    description: 'Customs House Agent (CHA) invoices, freight handling disbursements and fee records',
    apiEndpoint: '/api/v1/customs-clearances',
    fields: [
      { key: 'freight_forwarder_name', label: 'Freight Forwarder Name', type: 'text', colSpan: 2 },
      { key: 'cha_name', label: 'CHA Name (Custom House Agent)', type: 'text', required: true, colSpan: 2 },
      { key: 'invoice_no', label: 'Invoice No.', type: 'text', required: true, colSpan: 1 },
      { key: 'invoice_date', label: 'Invoice Date', type: 'date', colSpan: 1 },
      { key: 'invoice_amount', label: 'Invoice Amount', type: 'currency', prefix: '₹', colSpan: 1 },
      { key: 'payment_date', label: 'Payment Date', type: 'date', colSpan: 1 },
      { key: 'payment_amount', label: 'Payment Amount', type: 'currency', prefix: '₹', colSpan: 2 },
    ],
    tableConfig: {
      title: 'Description of Services',
      columns: [
        { key: 'sr_no', label: 'Sr. No.', type: 'number', width: '80px' },
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'amount', label: 'Amount (₹)', type: 'currency', width: '160px' },
      ],
    },
    uploads: [{ key: 'upload_supporting_doc', label: 'Upload Supporting Documents', multiple: true }],
  },
];

/** Lookup map by form code */
export const FORM_CATALOG_MAP = new Map<string, FormDefinition>(
  FORM_CATALOG.map((f) => [f.formCode, f]),
);

/** Helper to get form definition by code or number */
export function getFormDefinition(codeOrId: string | number): FormDefinition | undefined {
  if (typeof codeOrId === 'number') {
    return FORM_CATALOG.find((f) => f.id === codeOrId);
  }
  return (
    FORM_CATALOG_MAP.get(codeOrId) ||
    FORM_CATALOG.find((f) => f.formCode.toLowerCase() === codeOrId.toLowerCase())
  );
}

/** Mapping of legacy 15 step numbers to the new 28-form codes */
export const LEGACY_STEP_TO_FORM_CODE: Record<number, string> = {
  1: 'FORM_08_CUSTOMER_QUERY',
  2: 'FORM_09_RFQ',
  3: 'FORM_11_SUPPLIER_QUOTATION',
  4: 'FORM_10_COST_SHEET',
  5: 'FORM_12_CUSTOMER_QUOTATION',
  6: 'FORM_13_PAC_TENDER',
  7: 'FORM_15_BID_DOCUMENT',
  8: 'FORM_14_PURCHASE_ORDER',
  9: 'FORM_16_ORDER_CONFIRMATION',
  10: 'FORM_18_SUPPLIER_INVOICE',
  11: 'FORM_27_SHIPPING_CLEARANCE',
  12: 'FORM_21_TRANSPORTATION_DETAILS',
  13: 'FORM_24_DELIVERY_CHALLAN',
  14: 'FORM_22_PAYMENT_FROM_CUSTOMER',
  15: 'FORM_20_PAYMENT_TO_SUPPLIER',
};
