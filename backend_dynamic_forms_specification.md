# Backend Implementation Specification: Dynamic 28-Form Workflow System

**Document Version:** 1.0  
**Target Backend Stack:** Python Flask / SQLAlchemy / PostgreSQL  
**System:** Material Management System  

---

## 1. Executive Summary & Architecture Shift

### The Old Static Model (15 Hardcoded Steps)
Previously, each project was initialized with 15 fixed sequential steps (Step 1 Customer Query to Step 15 Supplier Payment). Every step was assigned a hardcoded index `1..15`.

### The New Dynamic Model (28 Forms on Demand)
1. **Lightweight Project Creation**: When a project is created via `POST /api/v1/projects`, it contains only core project information (`project_title`, `project_code`, `customer_id`, `supplier_id`, `total_margin`, etc.).
2. **Post-Creation Form Attachment**: Because the required forms vary for each project (domestic vs. international import, tender vs. direct inquiry), **users attach forms as steps on demand** after the project is created.
3. **Step Pipeline Flexibility**:
   - A project starts with 0 steps or 1 default initial step.
   - At any time during the project lifecycle, team members click **"+ Attach Form as Step"** to add any of the **28 registered forms**.
   - Added forms can be saved as drafts, marked as completed, or removed if attached erroneously.

---

## 2. Database Schema (PostgreSQL DDL & SQLAlchemy Models)

### A. Table: `form_definitions` (Master Catalog of 28 Forms)
Stores metadata for all 28 available forms.

```sql
CREATE TABLE form_definitions (
    id SERIAL PRIMARY KEY,
    form_code VARCHAR(60) UNIQUE NOT NULL,      -- e.g., 'FORM_01_PQB', 'FORM_27_SHIPPING_CLEARANCE'
    name VARCHAR(150) NOT NULL,                 -- e.g., 'National Pre-Qualification Bid (PQB)'
    category VARCHAR(80) NOT NULL,              -- 'Pre-Bidding & Tenders', 'Sourcing & Quotations', etc.
    phase_id VARCHAR(30) NOT NULL,              -- 'phase-1', 'phase-2', 'phase-3', 'phase-4'
    icon VARCHAR(60) DEFAULT 'pi pi-file',      -- PrimeIcon name
    description TEXT,
    has_table BOOLEAN DEFAULT FALSE,            -- Indicates if form contains line items
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### B. Table: `project_steps` (Project Step Instances)
Stores only the steps that have been attached to a specific project.

```sql
CREATE TABLE project_steps (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    step_order INT NOT NULL,                     -- Sequence order in this project (1, 2, 3...)
    form_code VARCHAR(60) NOT NULL REFERENCES form_definitions(form_code),
    step_name VARCHAR(150) NOT NULL,             -- Copied or customized name
    description TEXT,
    status VARCHAR(30) DEFAULT 'in_progress',    -- 'in_progress' | 'completed' | 'pending' | 'skipped'
    progress_percentage INT DEFAULT 0,           -- 0 to 100
    data JSONB DEFAULT '{}'::jsonb,              -- Dynamic form fields & line items snapshot
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_project_steps_project_id ON project_steps(project_id);
CREATE INDEX idx_project_steps_order ON project_steps(project_id, step_order);
```

### C. Table: `project_step_remarks` (Audit & Review Trail)

```sql
CREATE TABLE project_step_remarks (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    step_id INT NOT NULL REFERENCES project_steps(id) ON DELETE CASCADE,
    step_number INT,
    user_id INT NULL,
    user_name VARCHAR(100),
    remark TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### D. Table: `project_step_attachments` (Uploaded Documents)

```sql
CREATE TABLE project_step_attachments (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    step_id INT NOT NULL REFERENCES project_steps(id) ON DELETE CASCADE,
    upload_key VARCHAR(80) NOT NULL,             -- e.g. 'upload_pqb', 'upload_boe'
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. Seed Data: Master Catalog of 28 Forms

Run this seed migration to populate the 28 form definitions:

```sql
INSERT INTO form_definitions (id, form_code, name, category, phase_id, icon, description, has_table) VALUES
(1, 'FORM_01_PQB', 'National Pre-Qualification Bid (PQB)', 'Pre-Bidding & Tenders', 'phase-1', 'pi pi-file-edit', 'Pre-qualification bid terms, submission schedule, supply locations, and requirements', TRUE),
(2, 'FORM_02_PQB_BID_DOCUMENT', 'Bid Document for PQB', 'Pre-Bidding & Tenders', 'phase-1', 'pi pi-book', 'Documentation for PQB submission, dates, and recorded corrigendum count', TRUE),
(3, 'FORM_03_CORRIGENDUM', 'Corrigendum', 'Pre-Bidding & Tenders', 'phase-1', 'pi pi-sync', 'Corrigendum amendment notices issued against EOI, PQB, or Tender notices', FALSE),
(4, 'FORM_04_LTE', 'Limited Tender Enquiry (LTE)', 'Pre-Bidding & Tenders', 'phase-1', 'pi pi-briefcase', 'LTE invitation terms, tender fee, EMD amounts, deadlines, and item specifications', TRUE),
(5, 'FORM_05_NAC', 'Notification of Award of Contract (NAC)', 'Pre-Bidding & Tenders', 'phase-2', 'pi pi-verified', 'Formal contract award notice and itemized awarded material price breakdown', TRUE),
(6, 'FORM_06_CONSULTANCY_INVOICE', 'Consultancy Invoice', 'Pre-Bidding & Tenders', 'phase-1', 'pi pi-receipt', 'Advisory and specialist consultancy invoices associated with the project', FALSE),
(7, 'FORM_07_EOI', 'Expression of Interest (EOI)', 'Pre-Bidding & Tenders', 'phase-1', 'pi pi-compass', 'Expression of interest publication details, submission mode, and items required', TRUE),
(8, 'FORM_08_CUSTOMER_QUERY', 'Query from Customer', 'Sourcing & Quotations', 'phase-1', 'pi pi-question-circle', 'Direct inquiry from customer detailing specific material requirements and quantities', TRUE),
(9, 'FORM_09_RFQ', 'Request for Quotation (RFQ)', 'Sourcing & Quotations', 'phase-1', 'pi pi-send', 'Dispatch RFQ to prospective vendors and suppliers with requirements', TRUE),
(10, 'FORM_10_COST_SHEET', 'Cost Sheet', 'Sourcing & Quotations', 'phase-1', 'pi pi-calculator', 'Complete commercial cost matrix including duties, forex buffers, logistics, and margins', FALSE),
(11, 'FORM_11_SUPPLIER_QUOTATION', 'Quotation from Supplier', 'Sourcing & Quotations', 'phase-1', 'pi pi-tags', 'Detailed quotation received from vendor with HSN/SAC codes, incoterms, and pricing', TRUE),
(12, 'FORM_12_CUSTOMER_QUOTATION', 'Quotation to Customer', 'Sourcing & Quotations', 'phase-1', 'pi pi-file-o', 'Final commercial offer sent to customer with itemized rates and validity', TRUE),
(13, 'FORM_13_PAC_TENDER', 'PAC Tender', 'Pre-Bidding & Tenders', 'phase-2', 'pi pi-building', 'Proprietary Article Certificate (PAC) tender enquiry terms, dates, and specifications', TRUE),
(14, 'FORM_14_PURCHASE_ORDER', 'Purchase Order (PO)', 'Supplier Orders & Invoices', 'phase-2', 'pi pi-shopping-bag', 'Formal purchase order contractual commitment with delivery dates and items', TRUE),
(15, 'FORM_15_BID_DOCUMENT', 'Bid Document', 'Pre-Bidding & Tenders', 'phase-2', 'pi pi-folder-open', 'Bid submission submission data, corrigendum counts, and quoted tender pricing', TRUE),
(16, 'FORM_16_ORDER_CONFIRMATION', 'Order Confirmation to Supplier', 'Supplier Orders & Invoices', 'phase-2', 'pi pi-check-square', 'Acknowledgement and formal confirmation placed with supplier for production', TRUE),
(17, 'FORM_17_PROFORMA_INVOICE', 'Supplier''s Proforma Invoice', 'Supplier Orders & Invoices', 'phase-2', 'pi pi-file-invoice', 'Proforma invoice received from vendor prior to dispatch / foreign remittance', TRUE),
(18, 'FORM_18_SUPPLIER_INVOICE', 'Supplier''s Invoice', 'Supplier Orders & Invoices', 'phase-3', 'pi pi-receipt', 'Commercial invoice issued by supplier covering final shipped goods', TRUE),
(19, 'FORM_19_SUPPLIER_PACKING_LIST', 'Supplier''s Packing List', 'Logistics & Customs', 'phase-3', 'pi pi-box', 'Inventory package list with tare/gross weights provided by the supplier', TRUE),
(20, 'FORM_20_PAYMENT_TO_SUPPLIER', 'Payment to Supplier', 'Customer & Supplier Settlement', 'phase-4', 'pi pi-wallet', 'Forex remittance transfer, SWIFT debit advice, exchange rates, and balances', FALSE),
(21, 'FORM_21_TRANSPORTATION_DETAILS', 'Transportation Details', 'Logistics & Customs', 'phase-3', 'pi pi-truck', 'Inland transport details, carrier consignments, LR/AWB receipts and charges', FALSE),
(22, 'FORM_22_PAYMENT_FROM_CUSTOMER', 'Payment from Customer', 'Customer & Supplier Settlement', 'phase-4', 'pi pi-dollar', 'Receivables from customer, TDS/LD deductions, and balance settlement', FALSE),
(23, 'FORM_23_WARRANTY_CERTIFICATE', 'Warranty Certificate', 'Customer & Supplier Settlement', 'phase-4', 'pi pi-shield', 'Manufacturer warranty coverage document referencing PO and invoices', FALSE),
(24, 'FORM_24_DELIVERY_CHALLAN', 'Delivery Challan to Customer', 'Customer & Supplier Settlement', 'phase-4', 'pi pi-send', 'Dispatch challan with material items and consignee acknowledgement proof', TRUE),
(25, 'FORM_25_CUSTOMER_PACKING_LIST', 'Packing List to Customer', 'Customer & Supplier Settlement', 'phase-4', 'pi pi-box', 'Final packing list delivered to the customer with tare and box specifications', TRUE),
(26, 'FORM_26_TAX_INVOICE_CUSTOMER', 'Tax Invoice to Customer', 'Customer & Supplier Settlement', 'phase-4', 'pi pi-file', 'Final sales tax invoice billed to the customer for complete supply and service', TRUE),
(27, 'FORM_27_SHIPPING_CLEARANCE', 'Shipping & Clearance', 'Logistics & Customs', 'phase-3', 'pi pi-globe', 'Port logistics, customs Bill of Entry (BOE), duties, IGST, and clearance tracking', FALSE),
(28, 'FORM_28_FREIGHT_CHA', 'Freight Forwarder / CHA Details', 'Logistics & Customs', 'phase-3', 'pi pi-users', 'Customs House Agent (CHA) invoices, freight handling disbursements and fee records', TRUE),
(29, 'FORM_29_BID_DOC_TECHNO_COMMERCIAL', 'Bid Document - Techno Commercial Tender', 'Pre-Bidding & Tenders', 'phase-1', 'pi pi-file-check', 'Techno commercial tender bid submission, delivery terms, warranty, and material price schedule', TRUE),
(30, 'FORM_30_TECHNO_COMMERCIAL_TENDER', 'Techno Commercial Tender', 'Pre-Bidding & Tenders', 'phase-1', 'pi pi-file-edit', 'Techno commercial tender enquiry terms, submission deadlines, EMD, fee, and requirements', TRUE),
(31, 'FORM_31_BID_DOC_LTE', 'Bid Document - Limited Tender Enquiry (LTE)', 'Pre-Bidding & Tenders', 'phase-1', 'pi pi-book', 'Limited tender enquiry bid submission data, delivery terms, corrigendum, and material pricing', TRUE),
(32, 'FORM_32_EWAY_BILL', 'E-Way Bill', 'Logistics & Customs', 'phase-4', 'pi pi-truck', 'Electronic waybill tracking for movement of goods, transport details, and consignment validity', FALSE);
```

---

## 4. REST API Endpoints Specification

### 1. `GET /api/v1/forms`
Returns the catalog of all 28 forms available for attachment.

**Response `200 OK`:**
```json
[
  {
    "id": 1,
    "form_code": "FORM_01_PQB",
    "name": "National Pre-Qualification Bid (PQB)",
    "category": "Pre-Bidding & Tenders",
    "phase_id": "phase-1",
    "icon": "pi pi-file-edit",
    "description": "Pre-qualification bid terms, submission schedule, supply locations, and requirements",
    "has_table": true
  },
  ...
]
```

---

### 2. `GET /api/v1/projects/{project_id}/steps`
Returns all active steps attached to this project, ordered by `step_order ASC`.

**Response `200 OK`:**
```json
[
  {
    "id": 101,
    "project_id": 12,
    "step_order": 1,
    "form_code": "FORM_08_CUSTOMER_QUERY",
    "step_name": "Query from Customer",
    "description": "Direct inquiry from customer detailing specific material requirements",
    "status": "completed",
    "progress_percentage": 100,
    "completed_at": "2026-03-15T10:30:00Z",
    "data": {
      "customer_name": "Indian Railways",
      "query_date": "2026-03-14",
      "items": [
        { "sr_no": 1, "description": "High Strength Alloy Steel Studs", "quantity": 500 }
      ]
    },
    "remarks": [
      {
        "id": 1,
        "remark": "Approved technical spec sheet received",
        "user_name": "Audit Team",
        "created_at": "2026-03-15T11:00:00Z"
      }
    ]
  }
]
```

---

### 3. `POST /api/v1/projects/{project_id}/steps`
**Attaches a new form as a step to the project (from the popup dialog with initial form inputs).**

**Request Body:**
```json
{
  "form_code": "FORM_27_SHIPPING_CLEARANCE",
  "step_name": "Shipping & Clearance",
  "description": "Port logistics, customs Bill of Entry (BOE), duties, IGST",
  "data": {
    "bill_of_entry_no": "BOE-2026-9921",
    "boe_filing_date": "2026-03-20",
    "total_assessable_value": 450000.00,
    "items": []
  },
  "status": "in_progress",
  "progress_percentage": 50
}
```

**Backend Logic:**
1. Determine the next `step_order`: `SELECT COALESCE(MAX(step_order), 0) + 1 FROM project_steps WHERE project_id = :project_id`.
2. Insert row into `project_steps` with `data = COALESCE(request_data, '{}'::jsonb)`, `status = COALESCE(request_status, 'in_progress')`, `progress_percentage = COALESCE(request_progress, 0)`.
3. Return the created step.

**Response `201 Created`:**
```json
{
  "id": 105,
  "project_id": 12,
  "step_order": 2,
  "form_code": "FORM_27_SHIPPING_CLEARANCE",
  "step_name": "Shipping & Clearance",
  "description": "Port logistics, customs Bill of Entry (BOE), duties, IGST",
  "status": "in_progress",
  "progress_percentage": 50,
  "completed_at": null,
  "data": {
    "bill_of_entry_no": "BOE-2026-9921",
    "boe_filing_date": "2026-03-20",
    "total_assessable_value": 450000.00,
    "items": []
  },
  "remarks": []
}
```

---

### 4. `PUT /api/v1/projects/{project_id}/steps/{step_id}`
**Saves draft or marks step completed.**

**Request Body:**
```json
{
  "data": {
    "bill_of_entry_no": "BOE-2026-9921",
    "boe_filing_date": "2026-03-20",
    "total_assessable_value": 450000.00,
    "basic_custom_duty_bcd": 33750.00,
    "items": []
  },
  "status": "completed",
  "progress_percentage": 100
}
```

**Backend Logic:**
1. Update `project_steps` row.
2. If `status == 'completed'` and `completed_at` is null, set `completed_at = CURRENT_TIMESTAMP`.
3. Recalculate project overall progress:
   ```python
   total_steps = ProjectStep.query.filter_by(project_id=project_id).count()
   completed_steps = ProjectStep.query.filter_by(project_id=project_id, status='completed').count()
   project.progress_percentage = int((completed_steps / total_steps) * 100) if total_steps > 0 else 0
   db.session.commit()
   ```

**Response `200 OK`:** Returns updated step record.

---

### 5. `DELETE /api/v1/projects/{project_id}/steps/{step_id}`
**Deletes an attached step if added accidentally.**

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Step removed successfully"
}
```

---

### 6. `POST /api/v1/projects/{project_id}/steps/{step_id}/attachments`
**Multipart file upload endpoint.**

**Request:** `multipart/form-data` with:
- `file`: Raw binary file
- `upload_key`: string (e.g. `'upload_pqb'`, `'upload_boe'`, `'upload_invoice'`)

**Response `201 Created`:**
```json
{
  "id": 42,
  "upload_key": "upload_boe",
  "file_name": "BOE_Official_Clearance.pdf",
  "file_size": "245.5 KB",
  "file_path": "/storage/attachments/project_12/step_105/BOE_Official_Clearance.pdf"
}
```

---

## 5. Detailed Field Mapping for All 28 Forms

| Form ID & Code | Form Name | Primary Fields | Table Columns | Upload Fields |
|---|---|---|---|---|
| **1. FORM_01_PQB** | National Pre-Qualification Bid (PQB) | `pqb_title`, `pqb_no`, `pqb_issuing_date`, `pqb_closing_date_time`, `pqb_opening_date_time`, `mode_of_bid_submission`, `supply_location` | `sr_no`, `description`, `unit`, `quantity` | `upload_pqb` |
| **2. FORM_02_PQB_BID_DOCUMENT** | Bid Document for PQB | `pqb_title`, `pqb_no`, `pqb_issue_date`, `pqb_closing_date_time`, `pqb_opening_date_time`, `total_no_corrigendum_issued` | `sr_no`, `description`, `hsn_sac`, `quantity`, `unit_price`, `total_amount` | `upload_bid_document_pqb` |
| **3. FORM_03_CORRIGENDUM** | Corrigendum | `corrigendum_no`, `against_ref_no`, `ref_title` | *None* | `upload_corrigendum` |
| **4. FORM_04_LTE** | Limited Tender Enquiry (LTE) | `pqb_no`, `tender_title`, `tender_enquiry_no`, `tender_issue_date`, `bid_submission_due_date_time`, `bid_opening_date_time`, `tender_fee`, `emd`, `tender_validity` | `sr_no`, `description`, `unit`, `quantity` | `upload_lte` |
| **5. FORM_05_NAC** | Notification of Award of Contract (NAC) | `nac_no`, `nac_date`, `nac_title` | `sr_no`, `description`, `quantity`, `per_unit_price`, `total_amount` | `upload_nac` |
| **6. FORM_06_CONSULTANCY_INVOICE** | Consultancy Invoice | `invoice_no`, `invoice_date`, `party_name`, `invoice_reference`, `total_value_eur` | *None* | `upload_consultancy_invoice` |
| **7. FORM_07_EOI** | Expression of Interest (EOI) | `eoi_title`, `eoi_no`, `eoi_date`, `eoi_closing_date_time`, `eoi_opening_date_time`, `mode_of_submission`, `supply_location` | `sr_no`, `description`, `unit`, `quantity` | `upload_eoi` |
| **8. FORM_08_CUSTOMER_QUERY** | Query from Customer | `customer_name`, `query_date` | `sr_no`, `description`, `quantity` | `upload_query` |
| **9. FORM_09_RFQ** | Request for Quotation (RFQ) | `supplier_name`, `request_date` | `sr_no`, `description`, `quantity` | `upload_rfq` |
| **10. FORM_10_COST_SHEET** | Cost Sheet | `project_title`, `total_amount_eur`, `eur_to_inr_rate_prep`, `eur_to_inr_rate_buffer`, `freight_insurance_pct`, `freight_insurance_amount`, `custom_duty_pct`, `custom_duty_amount`, `igst_pct`, `igst_amount`, `transportation_pct`, `transportation_amount`, `finance_charges_pct`, `finance_charges_amount`, `margin_pct`, `margin_amount`, `gst_pct`, `gst_amount` | *None* | `upload_cost_sheet` |
| **11. FORM_11_SUPPLIER_QUOTATION** | Quotation from Supplier | `supplier_name`, `quotation_no`, `quotation_date`, `quotation_value`, `quotation_validity`, `incoterms`, `payment_terms`, `delivery_period`, `warranty_period` | `sr_no`, `description`, `hsn_sac`, `quantity`, `unit_price`, `total_amount` | `upload_quotation` |
| **12. FORM_12_CUSTOMER_QUOTATION** | Quotation to Customer | `customer_name`, `quotation_no`, `quotation_date`, `quotation_value`, `quotation_validity` | `sr_no`, `description`, `hsn_sac`, `quantity`, `unit_price`, `total_amount` | `upload_quotation` |
| **13. FORM_13_PAC_TENDER** | PAC Tender | `customer_name`, `tender_title`, `tender_no`, `tender_issue_date`, `closing_date_time`, `opening_date_time`, `tender_fee`, `validity`, `delivery_terms`, `delivery_period`, `payment_terms`, `warranty_period` | `sr_no`, `description`, `unit`, `quantity` | `upload_tender_document` |
| **14. FORM_14_PURCHASE_ORDER** | Purchase Order (PO) | `customer_name`, `po_title`, `po_no`, `po_date`, `delivery_terms`, `payment_terms`, `warranty_period`, `gst_rate_pct` | `sr_no`, `description`, `hsn_sac`, `unit`, `quantity`, `unit_price`, `total_price`, `delivery_date` | `upload_po` |
| **15. FORM_15_BID_DOCUMENT** | Bid Document | `customer_name`, `tender_title`, `tender_no`, `tender_issue_date`, `total_no_corrigendum_issued`, `bid_submission_date`, `delivery_terms`, `delivery_period`, `bid_validity`, `payment_terms`, `warranty_period`, `gst_pct` | `sr_no`, `description`, `hsn_sac`, `quantity`, `unit_price`, `total_amount` | `upload_bid_document` |
| **16. FORM_16_ORDER_CONFIRMATION** | Order Confirmation to Supplier | `supplier_name`, `order_confirmation_no`, `order_confirmation_date`, `incoterms`, `delivery_period`, `warranty_period`, `payment_terms` | `sr_no`, `hsn_sac`, `quantity`, `unit_price`, `total_amount` | `upload_order_confirmation` |
| **17. FORM_17_PROFORMA_INVOICE** | Supplier's Proforma Invoice | `supplier_name`, `proforma_invoice_no`, `proforma_invoice_date`, `incoterms`, `payment_terms`, `warranty_period`, `delivery_period` | `sr_no`, `description`, `hsn_sac`, `quantity`, `unit_price`, `total_amount` | `upload_proforma_invoice` |
| **18. FORM_18_SUPPLIER_INVOICE** | Supplier's Invoice | `supplier_name`, `invoice_no`, `invoice_date`, `incoterms`, `payment_terms`, `warranty_period`, `delivery_period` | `sr_no`, `description`, `hsn_sac`, `quantity`, `unit_price`, `total_amount` | `upload_invoice` |
| **19. FORM_19_SUPPLIER_PACKING_LIST** | Supplier's Packing List | `packing_list_no`, `packing_list_date`, `gross_weight`, `net_weight`, `total_no_packages` | `sr_no`, `description`, `hsn_sac`, `unit_weight`, `total_weight` | `upload_packing_list` |
| **20. FORM_20_PAYMENT_TO_SUPPLIER** | Payment to Supplier | `total_contract_value`, `payment_pct`, `payment_amount`, `payment_date`, `eur_to_inr_rate`, `payment_amount_inr`, `bank_charges`, `swift_charges`, `reference_no`, `pending_amount` | *None* | `upload_swift_copy`, `upload_debit_advice` |
| **21. FORM_21_TRANSPORTATION_DETAILS** | Transportation Details | `transportation_mode`, `lr_rr_awb_no`, `lr_rr_awb_date`, `from_location`, `to_location`, `total_transportation_charges` | *None* | `upload_transportation_doc` |
| **22. FORM_22_PAYMENT_FROM_CUSTOMER** | Payment from Customer | `payment_against_invoice_no`, `invoice_date`, `invoice_value`, `payment_received`, `payment_received_date`, `tds_deducted`, `ld_deducted`, `balance_amount` | *None* | `upload_payment_advice` |
| **23. FORM_23_WARRANTY_CERTIFICATE** | Warranty Certificate | `certificate_date`, `warranty_period`, `po_no`, `po_date`, `invoice_no`, `invoice_date` | *None* | `upload_warranty_certificate` |
| **24. FORM_24_DELIVERY_CHALLAN** | Delivery Challan to Customer | `delivery_challan_no`, `delivery_challan_date` | `sr_no`, `description`, `hsn_sac`, `unit_price`, `total_amount` | `upload_delivery_challan` |
| **25. FORM_25_CUSTOMER_PACKING_LIST** | Packing List to Customer | `packing_list_no`, `packing_list_date`, `gross_weight`, `net_weight`, `total_no_packages` | `sr_no`, `description`, `hsn_sac`, `unit_weight`, `total_weight` | `upload_packing_list` |
| **26. FORM_26_TAX_INVOICE_CUSTOMER** | Tax Invoice to Customer | `customer_name`, `invoice_no`, `invoice_date`, `gst_pct` | `sr_no`, `description`, `hsn_sac`, `quantity`, `unit_price`, `total_amount` | `upload_invoice` |
| **27. FORM_27_SHIPPING_CLEARANCE** | Shipping & Clearance | `logistic_mode`, `shipment_date`, `awb_bl_no`, `flight_vessel_name`, `flight_vessel_no`, `port_loading`, `port_discharge`, `bill_of_entry_no`, `boe_filing_date`, `total_assessable_value`, `basic_custom_duty_bcd`, `sws`, `igst`, `duty_paid_date`, `challan_no`, `payment_ref_no`, `customs_location`, `cfs_name` | *None* | `upload_shipping_doc`, `upload_boe`, `upload_other_doc` |
| **28. FORM_28_FREIGHT_CHA** | Freight Forwarder / CHA Details | `freight_forwarder_name`, `cha_name`, `invoice_no`, `invoice_date`, `invoice_amount`, `payment_date`, `payment_amount` | `sr_no`, `description`, `amount` | `upload_supporting_doc` |
| **29. FORM_29_BID_DOC_TECHNO_COMMERCIAL** | Bid Document - Techno Commercial Tender | `customer_name`, `tender_title`, `tender_no`, `tender_issue_date`, `total_no_corrigendum_issued`, `bid_submission_date`, `delivery_terms`, `delivery_period`, `bid_validity`, `payment_terms`, `warranty_period`, `gst_pct` | `sr_no`, `description`, `hsn_sac`, `quantity`, `unit_price`, `total_amount` | `upload_bid_document` |
| **30. FORM_30_TECHNO_COMMERCIAL_TENDER** | Techno Commercial Tender | `pqb_no`, `tender_title`, `tender_no`, `tender_issue_date`, `bid_submission_due_date_time`, `bid_opening_date_time`, `tender_fee`, `emd`, `tender_validity` | `sr_no`, `description`, `unit`, `quantity` | `upload_techno_commercial_tender` |
| **31. FORM_31_BID_DOC_LTE** | Bid Document - Limited Tender Enquiry (LTE) | `customer_name`, `tender_title`, `tender_no`, `tender_issue_date`, `total_no_corrigendum_issued`, `bid_submission_date`, `delivery_terms`, `delivery_period`, `bid_validity`, `payment_terms`, `warranty_period`, `gst_pct` | `sr_no`, `description`, `hsn_sac`, `quantity`, `unit_price`, `total_amount` | `upload_bid_document_lte` |
| **32. FORM_32_EWAY_BILL** | E-Way Bill | `eway_bill_no`, `eway_bill_date`, `valid_from`, `valid_until`, `document_no`, `document_date`, `value`, `place_of_dispatch`, `place_of_delivery`, `transporter`, `mode`, `vehicle_trans_doc_no` | *None* | `upload_eway_bill` |

---

## 6. Backward Compatibility for Existing Projects

To ensure all existing active projects continue working without data loss:

```sql
-- Migration: Add form_code column to existing project_steps if not present
ALTER TABLE project_steps ADD COLUMN IF NOT EXISTS form_code VARCHAR(60);

-- Map existing static steps 1..15 to the corresponding 28-form codes
UPDATE project_steps SET form_code = 'FORM_08_CUSTOMER_QUERY' WHERE step_number = 1 AND form_code IS NULL;
UPDATE project_steps SET form_code = 'FORM_09_RFQ' WHERE step_number = 2 AND form_code IS NULL;
UPDATE project_steps SET form_code = 'FORM_11_SUPPLIER_QUOTATION' WHERE step_number = 3 AND form_code IS NULL;
UPDATE project_steps SET form_code = 'FORM_10_COST_SHEET' WHERE step_number = 4 AND form_code IS NULL;
UPDATE project_steps SET form_code = 'FORM_12_CUSTOMER_QUOTATION' WHERE step_number = 5 AND form_code IS NULL;
UPDATE project_steps SET form_code = 'FORM_13_PAC_TENDER' WHERE step_number = 6 AND form_code IS NULL;
UPDATE project_steps SET form_code = 'FORM_15_BID_DOCUMENT' WHERE step_number = 7 AND form_code IS NULL;
UPDATE project_steps SET form_code = 'FORM_14_PURCHASE_ORDER' WHERE step_number = 8 AND form_code IS NULL;
UPDATE project_steps SET form_code = 'FORM_16_ORDER_CONFIRMATION' WHERE step_number = 9 AND form_code IS NULL;
UPDATE project_steps SET form_code = 'FORM_18_SUPPLIER_INVOICE' WHERE step_number = 10 AND form_code IS NULL;
UPDATE project_steps SET form_code = 'FORM_27_SHIPPING_CLEARANCE' WHERE step_number = 11 AND form_code IS NULL;
UPDATE project_steps SET form_code = 'FORM_21_TRANSPORTATION_DETAILS' WHERE step_number = 12 AND form_code IS NULL;
UPDATE project_steps SET form_code = 'FORM_24_DELIVERY_CHALLAN' WHERE step_number = 13 AND form_code IS NULL;
UPDATE project_steps SET form_code = 'FORM_22_PAYMENT_FROM_CUSTOMER' WHERE step_number = 14 AND form_code IS NULL;
UPDATE project_steps SET form_code = 'FORM_20_PAYMENT_TO_SUPPLIER' WHERE step_number = 15 AND form_code IS NULL;
```

---

## 7. Ready-to-Use Python Flask Blueprint Code

The backend developer can copy and paste the following Python code directly into the Flask backend:

### File: `routes/steps.py`
```python
from datetime import datetime
from flask import Blueprint, request, jsonify
from models import db, Project, ProjectStep, FormDefinition, ProjectStepRemark, ProjectStepAttachment

steps_bp = Blueprint('steps_bp', __name__, url_prefix='/api/v1')

# 1. GET ALL 28 FORM DEFINITIONS (CATALOG)
@steps_bp.route('/forms', methods=['GET'])
def get_form_catalog():
    forms = FormDefinition.query.filter_by(is_active=True).order_by(FormDefinition.id.asc()).all()
    return jsonify([{
        'id': f.id,
        'form_code': f.form_code,
        'name': f.name,
        'category': f.category,
        'phase_id': f.phase_id,
        'icon': f.icon,
        'description': f.description,
        'has_table': f.has_table
    } for f in forms]), 200

# 2. GET CURRENT STEPS FOR A PROJECT
@steps_bp.route('/projects/<int:project_id>/steps', methods=['GET'])
def get_project_steps(project_id):
    project = Project.query.get_or_404(project_id)
    steps = ProjectStep.query.filter_by(project_id=project_id).order_by(ProjectStep.step_order.asc()).all()
    
    result = []
    for s in steps:
        remarks = ProjectStepRemark.query.filter_by(step_id=s.id).order_by(ProjectStepRemark.created_at.desc()).all()
        result.append({
            'id': s.id,
            'project_id': s.project_id,
            'step_number': s.step_order,
            'step_name': s.step_name,
            'description': s.description or '',
            'status': s.status,
            'progress_percentage': s.progress_percentage or 0,
            'completed_at': s.completed_at.isoformat() if s.completed_at else None,
            'form_code': s.form_code,
            'data': s.data or {},
            'remarks': [{
                'id': r.id,
                'remark': r.remark,
                'user': r.user_name or 'User',
                'created_at': r.created_at.isoformat() if r.created_at else None
            } for r in remarks]
        })
    return jsonify(result), 200

# 3. ATTACH A NEW FORM AS A STEP (ON DEMAND)
@steps_bp.route('/projects/<int:project_id>/steps', methods=['POST'])
def add_project_step(project_id):
    project = Project.query.get_or_404(project_id)
    payload = request.get_json() or {}
    
    form_code = payload.get('form_code')
    if not form_code:
        return jsonify({'error': 'form_code is required'}), 400
        
    form_def = FormDefinition.query.filter_by(form_code=form_code).first()
    step_name = payload.get('step_name') or (form_def.name if form_def else form_code)
    description = payload.get('description') or (form_def.description if form_def else '')

    # Compute next step_order
    max_order = db.session.query(db.func.max(ProjectStep.step_order)).filter_by(project_id=project_id).scalar() or 0
    next_order = max_order + 1

    new_step = ProjectStep(
        project_id=project_id,
        step_order=next_order,
        form_code=form_code,
        step_name=step_name,
        description=description,
        status='in_progress',
        progress_percentage=0,
        data={},
        created_at=datetime.utcnow()
    )
    db.session.add(new_step)
    db.session.commit()

    return jsonify({
        'id': new_step.id,
        'project_id': new_step.project_id,
        'step_number': new_step.step_order,
        'step_name': new_step.step_name,
        'description': new_step.description,
        'status': new_step.status,
        'progress_percentage': new_step.progress_percentage,
        'completed_at': None,
        'form_code': new_step.form_code,
        'data': {},
        'remarks': []
    }), 201

# 4. GET A SINGLE STEP BY ID
@steps_bp.route('/projects/<int:project_id>/steps/<int:step_id>', methods=['GET'])
def get_single_step(project_id, step_id):
    step = ProjectStep.query.filter_by(project_id=project_id, id=step_id).first_or_404()
    remarks = ProjectStepRemark.query.filter_by(step_id=step.id).order_by(ProjectStepRemark.created_at.desc()).all()
    
    return jsonify({
        'id': step.id,
        'project_id': step.project_id,
        'step_number': step.step_order,
        'step_name': step.step_name,
        'description': step.description,
        'status': step.status,
        'progress_percentage': step.progress_percentage,
        'completed_at': step.completed_at.isoformat() if step.completed_at else None,
        'form_code': step.form_code,
        'data': step.data or {},
        'remarks': [{
            'id': r.id,
            'remark': r.remark,
            'user': r.user_name or 'User',
            'created_at': r.created_at.isoformat() if r.created_at else None
        } for r in remarks]
    }), 200

# 5. UPDATE STEP (SAVE DRAFT OR COMPLETE STEP)
@steps_bp.route('/projects/<int:project_id>/steps/<int:step_id>', methods=['PUT', 'PATCH'])
def update_step(project_id, step_id):
    step = ProjectStep.query.filter_by(project_id=project_id, id=step_id).first_or_404()
    payload = request.get_json() or {}

    if 'data' in payload:
        # Merge or replace form data
        current_data = dict(step.data or {})
        current_data.update(payload['data'])
        step.data = current_data

    if 'status' in payload:
        step.status = payload['status']
        if step.status == 'completed' and not step.completed_at:
            step.completed_at = datetime.utcnow()
            step.progress_percentage = 100
        elif step.status != 'completed':
            step.completed_at = None

    if 'progress_percentage' in payload:
        step.progress_percentage = payload['progress_percentage']

    step.updated_at = datetime.utcnow()
    
    # Recalculate project progress
    total_steps = ProjectStep.query.filter_by(project_id=project_id).count()
    completed = ProjectStep.query.filter_by(project_id=project_id, status='completed').count()
    project = Project.query.get(project_id)
    if project and total_steps > 0:
        project.progress_percentage = int((completed / total_steps) * 100)

    db.session.commit()

    return jsonify({
        'id': step.id,
        'project_id': step.project_id,
        'step_number': step.step_order,
        'step_name': step.step_name,
        'description': step.description,
        'status': step.status,
        'progress_percentage': step.progress_percentage,
        'completed_at': step.completed_at.isoformat() if step.completed_at else None,
        'form_code': step.form_code,
        'data': step.data or {}
    }), 200

# 6. DELETE / REMOVE A STEP FROM PROJECT
@steps_bp.route('/projects/<int:project_id>/steps/<int:step_id>', methods=['DELETE'])
def remove_step(project_id, step_id):
    step = ProjectStep.query.filter_by(project_id=project_id, id=step_id).first_or_404()
    db.session.delete(step)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Step deleted'}), 200
```

---

## 8. Summary of Rules for Backend Team

1. ⚠️ **DO NOT generate 15 hardcoded rows on project creation.** When `POST /api/v1/projects` is called, simply insert the project record. Steps start at 0.
2. ⚠️ **Steps are added strictly on demand.** `POST /api/v1/projects/<id>/steps` is called by the frontend whenever the user chooses a form from the 28-catalog.
3. ⚠️ **Data is stored flexibly in the `data JSONB` column.** This allows any of the 28 form structures to be stored cleanly without requiring 28 separate database migrations.
4. ⚠️ **Project overall progress** is simply: `(completed_steps / total_attached_steps) * 100`.

