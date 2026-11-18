import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, throwError } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import { ProjectStep, ProjectStepRemark, StepStatus } from '../models/project-step.model';
import { FormDefinition, getFormDefinition } from '../constants/form-catalog';
import { formatLocalDate, sanitizePayloadDates } from '../utils/date.utils';
import {
  calculateTableTotalsWithGst,
  cleanTableItems,
  extractGstRate,
  isTableRowEmpty,
  normalizeTableRow,
} from '../utils/form.utils';
import { unwrapLatestApiRecord } from '../utils/api-response.utils';

export function normalizeBackendEntityToStep(
  item: Record<string, unknown>,
  formDef: FormDefinition,
  projectId: number,
): ProjectStep {
  const stepId = Number(item['id']) || Date.now();
  const rawStatus = String(item['status'] || 'completed').toLowerCase();
  const status: StepStatus =
    rawStatus === 'in_progress' || rawStatus === 'pending' || rawStatus === 'skipped'
      ? (rawStatus as StepStatus)
      : rawStatus === 'draft'
        ? 'in_progress'
        : 'completed';

  let rawTableItems: unknown[] = [];
  if (
    formDef.formCode === 'FORM_10_COST_SHEET' &&
    item['output'] &&
    typeof item['output'] === 'object' &&
    Array.isArray((item['output'] as Record<string, unknown>)['items']) &&
    ((item['output'] as Record<string, unknown>)['items'] as unknown[]).length > 0
  ) {
    const outputItems = (item['output'] as Record<string, unknown>)['items'] as Array<Record<string, unknown>>;
    const modelItems = Array.isArray(item['items']) ? (item['items'] as Array<Record<string, unknown>>) : [];
    rawTableItems = outputItems.map((outIt, idx) => {
      const match = modelItems.find(
        (m) =>
          (m['itemCode'] && (m['itemCode'] === outIt['itemCode'] || m['itemCode'] === outIt['item_code'])) ||
          (m['item_code'] && (m['item_code'] === outIt['itemCode'] || m['item_code'] === outIt['item_code'])),
      ) || modelItems[idx] || {};
      return {
        ...match,
        ...outIt,
        sr_no: idx + 1,
        description: outIt['itemDescription'] || outIt['description'] || match['itemDescription'] || match['description'] || match['material_name'] || '',
        item_code: outIt['itemCode'] || outIt['item_code'] || match['itemCode'] || match['item_code'] || '',
        price_per_unit_eur: outIt['pricePerUnitEur'] ?? outIt['price_per_unit_eur'] ?? match['pricePerUnitEur'] ?? match['price_per_unit_eur'],
        quantity: outIt['quantity'] ?? match['quantity'],
        total_price_eur: outIt['totalPriceEur'] ?? outIt['total_price_eur'],
        insurance_freight_eur: outIt['insuranceFreightEur'] ?? outIt['insurance_freight_eur'],
        landed_cost_eur: outIt['landedCostEur'] ?? outIt['landed_cost_eur'],
        landed_cost_inr: outIt['landedCostInr'] ?? outIt['landed_cost_inr'],
        customs_duty_inr: outIt['customsDutyInr'] ?? outIt['customs_duty_inr'],
        igst_inr: outIt['igstInr'] ?? outIt['igst_inr'],
        transportation_inr: outIt['transportationInr'] ?? outIt['transportation_inr'],
        financing_charges_inr: outIt['financingChargesInr'] ?? outIt['financing_charges_inr'],
        total_cost_inr: outIt['totalCostInr'] ?? outIt['total_cost_inr'],
        less_igst_inr: outIt['lessIgstInr'] ?? outIt['less_igst_inr'],
        margin_inr: outIt['marginInr'] ?? outIt['margin_inr'],
        selling_price_excl_gst: outIt['sellingPriceExclGst'] ?? outIt['selling_price_excl_gst'],
        selling_price_incl_gst: outIt['sellingPriceInclGst'] ?? outIt['selling_price_incl_gst'],
      };
    });
  } else if (Array.isArray(item['items']) && (item['items'] as unknown[]).length > 0) {
    rawTableItems = item['items'] as unknown[];
  } else if (
    item['output'] &&
    typeof item['output'] === 'object' &&
    Array.isArray((item['output'] as Record<string, unknown>)['items']) &&
    ((item['output'] as Record<string, unknown>)['items'] as unknown[]).length > 0
  ) {
    rawTableItems = (item['output'] as Record<string, unknown>)['items'] as unknown[];
  } else if (Array.isArray(item['table_items']) && (item['table_items'] as unknown[]).length > 0) {
    rawTableItems = item['table_items'] as unknown[];
  } else if (Array.isArray(item['requirements']) && (item['requirements'] as unknown[]).length > 0) {
    rawTableItems = item['requirements'] as unknown[];
  } else if (Array.isArray(item['requirement_items']) && (item['requirement_items'] as unknown[]).length > 0) {
    rawTableItems = item['requirement_items'] as unknown[];
  } else if (Array.isArray(item['pqb_items']) && (item['pqb_items'] as unknown[]).length > 0) {
    rawTableItems = item['pqb_items'] as unknown[];
  } else if (Array.isArray(item['bid_items']) && (item['bid_items'] as unknown[]).length > 0) {
    rawTableItems = item['bid_items'] as unknown[];
  } else if (Array.isArray(item['line_items']) && (item['line_items'] as unknown[]).length > 0) {
    rawTableItems = item['line_items'] as unknown[];
  } else if (Array.isArray(item['materials']) && (item['materials'] as unknown[]).length > 0) {
    rawTableItems = item['materials'] as unknown[];
  }

  const normalizedTableItems = Array.isArray(rawTableItems)
    ? (rawTableItems as Array<Record<string, unknown>>)
        .filter((r) => !isTableRowEmpty(r))
        .map(normalizeTableRow)
    : [];
  const rawAttachments = (item['attachments'] || []) as unknown[];
  const rawRemarks = (item['remarks'] || []) as unknown[];

  const combinedData: Record<string, unknown> = {
    ...item,
    items: normalizedTableItems,
    attachments: rawAttachments,
    remarks: rawRemarks,
  };
  delete combinedData['table_items'];

  // Bridge FORM_10_COST_SHEET globalParams and output columnTotals for seamless UI and editing
  if (formDef.formCode === 'FORM_10_COST_SHEET') {
    const gp = (item['globalParams'] || {}) as Record<string, unknown>;
    const out = (item['output'] || {}) as Record<string, unknown>;
    const ct = (out['columnTotals'] || item['columnTotals'] || {}) as Record<string, unknown>;

    const sheetTitle = item['title'] || item['project_title'] || '';
    if (sheetTitle) {
      combinedData['title'] = sheetTitle;
      combinedData['project_title'] = sheetTitle;
    }

    if (gp['eurToInr'] !== undefined) combinedData['eur_to_inr_rate_prep'] = gp['eurToInr'];
    if (gp['insuranceFreightRate'] !== undefined) combinedData['freight_insurance_pct'] = gp['insuranceFreightRate'];
    if (gp['defaultCustomsDutyRate'] !== undefined) combinedData['custom_duty_pct'] = gp['defaultCustomsDutyRate'];
    if (gp['igstRate'] !== undefined) combinedData['igst_pct'] = gp['igstRate'];
    if (gp['transportationRate'] !== undefined) combinedData['transportation_pct'] = gp['transportationRate'];
    if (gp['financeChargesRate'] !== undefined) combinedData['finance_charges_pct'] = gp['financeChargesRate'];
    if (gp['marginRate'] !== undefined) combinedData['margin_pct'] = gp['marginRate'];
    if (gp['gstRate'] !== undefined) combinedData['gst_pct'] = gp['gstRate'];

    if (ct['totalPriceEur'] !== undefined) combinedData['total_amount_eur'] = ct['totalPriceEur'];
    if (ct['insuranceFreightInr'] !== undefined) combinedData['freight_insurance_amount'] = ct['insuranceFreightInr'];
    if (ct['customsDutyInr'] !== undefined) combinedData['custom_duty_amount'] = ct['customsDutyInr'];
    if (ct['igstInr'] !== undefined) combinedData['igst_amount'] = ct['igstInr'];
    if (ct['transportationInr'] !== undefined) combinedData['transportation_amount'] = ct['transportationInr'];
    if (ct['financingChargesInr'] !== undefined) combinedData['finance_charges_amount'] = ct['financingChargesInr'];
    if (ct['marginInr'] !== undefined) combinedData['margin_amount'] = ct['marginInr'];
    if (ct['totalPriceInr'] !== undefined) combinedData['total_price_inr'] = ct['totalPriceInr'];
    if (ct['totalCostInr'] !== undefined) combinedData['total_cost_inr'] = ct['totalCostInr'];
    if (ct['sellingPriceExclGst'] !== undefined) combinedData['selling_price_excl_gst'] = ct['sellingPriceExclGst'];
    if (ct['sellingPriceInclGst'] !== undefined) combinedData['grand_total_incl_gst'] = ct['sellingPriceInclGst'];
    if (item['grandTotalInclGst'] !== undefined) combinedData['grand_total_incl_gst'] = item['grandTotalInclGst'];
    if (item['totalGst'] !== undefined) combinedData['gst_amount'] = item['totalGst'];
    if (item['versionNumber'] !== undefined) combinedData['versionNumber'] = item['versionNumber'];
    if (item['hasRateIncrease'] !== undefined) combinedData['hasRateIncrease'] = item['hasRateIncrease'];
  }

  // Bridge FORM_09_RFQ date fields (quotation_requested_date, request_date, rfq_date)
  if (formDef.formCode === 'FORM_09_RFQ') {
    const rDate =
      formatLocalDate(item['quotation_requested_date'] as string | Date) ||
      formatLocalDate(item['rfq_date'] as string | Date) ||
      formatLocalDate(item['request_date'] as string | Date);
    if (rDate) {
      combinedData['quotation_requested_date'] = rDate;
      combinedData['request_date'] = rDate;
      combinedData['rfq_date'] = rDate;
    }
  }

  // Bridge FORM_26_TAX_INVOICE_CUSTOMER and FORM_05_NAC gst_pct and gst_rate_pct
  if (formDef.formCode === 'FORM_26_TAX_INVOICE_CUSTOMER' || formDef.formCode === 'FORM_05_NAC') {
    const rate = extractGstRate(item, formDef.fields);
    if (rate !== null && rate !== undefined) {
      combinedData['gst_pct'] = rate;
      combinedData['gst_rate_pct'] = rate;
      combinedData['gst_rate'] = rate;
    }
  }

  // Bridge FORM_02_PQB_BID_DOCUMENT title and number fallbacks
  if (formDef.formCode === 'FORM_02_PQB_BID_DOCUMENT') {
    const t = item['pqb_title'] || item['pqbTitle'] || item['title'] || item['bid_title'] || '';
    const n = item['pqb_no'] || item['pqbNo'] || item['pqb_number'] || item['pqbNumber'] || item['bid_no'] || item['number'] || '';
    if (t && !combinedData['pqb_title']) {
      combinedData['pqb_title'] = t;
    }
    if (n && !combinedData['pqb_no']) {
      combinedData['pqb_no'] = n;
    }
  }

  // Bridge FORM_03_CORRIGENDUM title and number fallbacks
  if (formDef.formCode === 'FORM_03_CORRIGENDUM') {
    const t =
      item['ref_title'] ||
      item['tender_title'] ||
      item['pqb_title'] ||
      item['eoi_title'] ||
      item['icb_title'] ||
      item['title'] ||
      '';
    const n =
      item['against_ref_no'] ||
      item['against_tender_no'] ||
      item['tender_enquiry_no'] ||
      item['tender_no'] ||
      item['pqb_no'] ||
      item['eoi_no'] ||
      item['ste_no'] ||
      item['lte_no'] ||
      item['icb_no'] ||
      item['pac_no'] ||
      '';
    if (t && !combinedData['ref_title']) {
      combinedData['ref_title'] = t;
    }
    if (n && !combinedData['against_ref_no']) {
      combinedData['against_ref_no'] = n;
    }
    if (item['corrigendum_no'] !== undefined && !combinedData['corrigendum_no']) {
      combinedData['corrigendum_no'] = String(item['corrigendum_no']);
    }
  }

  // Bridge FORM_29_BID_DOC_TECHNO_COMMERCIAL title, number, and issue date fallbacks
  if (formDef.formCode === 'FORM_29_BID_DOC_TECHNO_COMMERCIAL') {
    const t = item['tender_title'] || item['title'] || '';
    const n = item['tender_no'] || item['number'] || '';
    const d = item['tender_issue_date'] || item['issue_date'] || item['tender_date'] || '';
    if (t && !combinedData['tender_title']) {
      combinedData['tender_title'] = t;
    }
    if (n && !combinedData['tender_no']) {
      combinedData['tender_no'] = n;
    }
    if (d && !combinedData['tender_issue_date']) {
      combinedData['tender_issue_date'] = d;
    }
  }

  // Bridge FORM_30_TECHNO_COMMERCIAL_TENDER title, tender_no, issue date, and pqb_no fallbacks
  if (formDef.formCode === 'FORM_30_TECHNO_COMMERCIAL_TENDER') {
    const t = item['tender_title'] || item['title'] || '';
    const n = item['tender_no'] || item['number'] || '';
    const d = item['tender_issue_date'] || item['issue_date'] || item['tender_date'] || '';
    const pqbNo = item['pqb_no'] || item['pqbNo'] || item['pqb_number'] || item['pqbNumber'] || '';
    if (t && !combinedData['tender_title']) {
      combinedData['tender_title'] = t;
    }
    if (n && !combinedData['tender_no']) {
      combinedData['tender_no'] = n;
    }
    if (d && !combinedData['tender_issue_date']) {
      combinedData['tender_issue_date'] = d;
    }
    if (pqbNo && !combinedData['pqb_no']) {
      combinedData['pqb_no'] = pqbNo;
    }
  }

  // Bridge FORM_31_BID_DOC_LTE title and number fallbacks
  if (formDef.formCode === 'FORM_31_BID_DOC_LTE') {
    const t = item['tender_title'] || item['title'] || '';
    const n = item['tender_no'] || item['lte_no'] || item['number'] || '';
    if (t && !combinedData['tender_title']) {
      combinedData['tender_title'] = t;
    }
    if (n && !combinedData['tender_no']) {
      combinedData['tender_no'] = n;
    }
  }

  // Bridge FORM_34_BID_DOC_STE title and number fallbacks
  if (formDef.formCode === 'FORM_34_BID_DOC_STE') {
    const t = item['tender_title'] || item['title'] || '';
    const n = item['tender_no'] || item['ste_no'] || item['number'] || '';
    if (t && !combinedData['tender_title']) {
      combinedData['tender_title'] = t;
    }
    if (n && !combinedData['tender_no']) {
      combinedData['tender_no'] = n;
    }
  }

  // Bridge FORM_36_BID_DOC_ICB title and number fallbacks
  if (formDef.formCode === 'FORM_36_BID_DOC_ICB') {
    const t = item['tender_title'] || item['title'] || '';
    const n = item['tender_no'] || item['number'] || '';
    if (t && !combinedData['tender_title']) {
      combinedData['tender_title'] = t;
    }
    if (n && !combinedData['tender_no']) {
      combinedData['tender_no'] = n;
    }
  }

  // Canonical title, number, and issue date fields for PAC Tender (FORM_13_PAC_TENDER)
  if (formDef.formCode === 'FORM_13_PAC_TENDER') {
    const t = (item['tender_title'] ?? item['title'] ?? item['pac_title'] ?? '') as string;
    const n = (item['tender_no'] ?? item['tender_number'] ?? item['pac_no'] ?? item['number'] ?? '') as string;
    const d = (item['tender_issue_date'] ?? item['tender_date'] ?? item['issue_date'] ?? '') as string;
    if (t && !combinedData['tender_title']) combinedData['tender_title'] = t;
    if (n) {
      if (!combinedData['tender_no']) combinedData['tender_no'] = n;
      if (!combinedData['tender_number']) combinedData['tender_number'] = n;
    }
    if (d) {
      if (!combinedData['tender_issue_date']) combinedData['tender_issue_date'] = d;
      if (!combinedData['tender_date']) combinedData['tender_date'] = d;
    }
  }

  // Bridge FORM_14_PURCHASE_ORDER po_no and po_number
  if (formDef.formCode === 'FORM_14_PURCHASE_ORDER') {
    const pNo = (item['po_no'] ?? item['po_number'] ?? '') as string;
    if (pNo) {
      if (!combinedData['po_no']) combinedData['po_no'] = pNo;
      if (!combinedData['po_number']) combinedData['po_number'] = pNo;
    }
  }

  // Calculate and bridge total_net_amount and total_gross_amount for tables with autoCalculateTotal
  if (formDef.tableConfig?.autoCalculateTotal) {
    const tKey = formDef.tableConfig.totalKey || 'total_amount';
    const computedNet = normalizedTableItems.reduce((sum, row) => sum + (Number(row[tKey]) || 0), 0);
    const existingNet =
      combinedData['total_net_amount'] !== undefined && combinedData['total_net_amount'] !== null && combinedData['total_net_amount'] !== ''
        ? Number(combinedData['total_net_amount'])
        : combinedData['net_total'] !== undefined && combinedData['net_total'] !== null && combinedData['net_total'] !== ''
          ? Number(combinedData['net_total'])
          : undefined;
    const netTotal = existingNet !== undefined && !isNaN(existingNet) ? existingNet : computedNet;
    combinedData['total_net_amount'] = netTotal;

    if (formDef.formCode !== 'FORM_10_COST_SHEET') {
      const rate = extractGstRate(combinedData, formDef.fields);
      const explicitGst =
        combinedData['gst_amount'] !== undefined && combinedData['gst_amount'] !== null && combinedData['gst_amount'] !== ''
          ? Number(combinedData['gst_amount'])
          : null;
      const totals = calculateTableTotalsWithGst(netTotal, rate, explicitGst);

      if (
        combinedData['total_gross_amount'] === undefined ||
        combinedData['total_gross_amount'] === null ||
        combinedData['total_gross_amount'] === '' ||
        isNaN(Number(combinedData['total_gross_amount']))
      ) {
        combinedData['total_gross_amount'] = totals.total_gross_amount;
      }
      if (
        totals.has_gst &&
        (combinedData['gst_amount'] === undefined ||
          combinedData['gst_amount'] === null ||
          combinedData['gst_amount'] === '' ||
          isNaN(Number(combinedData['gst_amount'])))
      ) {
        combinedData['gst_amount'] = totals.gst_amount;
      }
    } else {
      if (combinedData['total_amount_eur'] === undefined || combinedData['total_amount_eur'] === null || combinedData['total_amount_eur'] === 0) {
        combinedData['total_amount_eur'] = netTotal;
      }
    }
  }

  const rawStepNumber = item['step_number'] ?? item['step_order'];
  const stepNumber =
    rawStepNumber !== undefined && rawStepNumber !== null && !isNaN(Number(rawStepNumber))
      ? Number(rawStepNumber)
      : 0;

  return {
    id: stepId,
    project_id: Number(item['project_id']) || projectId,
    step_number: stepNumber,
    step_name: String(item['step_name'] || formDef.name),
    description: String(item['description'] || formDef.description || ''),
    status,
    progress_percentage: Number(
      item['progress_percentage'] ?? (status === 'completed' ? 100 : 50),
    ),
    completed_at: item['completed_at']
      ? String(item['completed_at'])
      : status === 'completed'
        ? item['created_at']
          ? String(item['created_at'])
          : new Date().toISOString()
        : null,
    form_code: formDef.formCode,
    category: formDef.category,
    data: combinedData,
    remarks: Array.isArray(rawRemarks) ? (rawRemarks as ProjectStepRemark[]) : [],
    created_at: item['created_at'] ? String(item['created_at']) : undefined,
    updated_at: item['updated_at'] ? String(item['updated_at']) : undefined,
  };
}

/**
 * Explicit mapping of form codes to their actual backend latest-record API endpoints.
 * Avoids dynamically appending `/latest` to `apiEndpoint`.
 */
export const FORM_LATEST_API_ENDPOINTS: Readonly<Record<string, string>> = {
  FORM_01_PQB: '/api/v1/pre-qualification-bids/latest',
  FORM_02_PQB_BID_DOCUMENT: '/api/v1/pqb-bid-documents/latest',
  FORM_03_CORRIGENDUM: '/api/v1/corrigendums/latest',
  FORM_04_LTE: '/api/v1/limited-tender-enquiries/latest',
  FORM_07_EOI: '/api/v1/expressions-of-interest/latest',
  FORM_08_CUSTOMER_QUERY: '/api/v1/customer-queries/latest',
  FORM_09_RFQ: '/api/v1/quotation-requests/latest',
  FORM_10_COST_SHEET: '/api/cost-sheet/latest',
  FORM_11_SUPPLIER_QUOTATION: '/api/v1/supplier-quotations/latest',
  FORM_12_CUSTOMER_QUOTATION: '/api/v1/customer-quotations/latest',
  FORM_13_PAC_TENDER: '/api/v1/pac-tenders/latest',
  FORM_14_PURCHASE_ORDER: '/api/v1/purchase-orders/latest',
  FORM_15_BID_DOCUMENT: '/api/v1/bid-submissions/latest',
  FORM_16_ORDER_CONFIRMATION: '/api/v1/order-confirmations/latest',
  FORM_17_PROFORMA_INVOICE: '/api/v1/proforma-invoices/latest',
  FORM_19_SUPPLIER_PACKING_LIST: '/api/v1/supplier-packing-lists/latest',
  FORM_26_TAX_INVOICE_CUSTOMER: '/api/v1/customer-tax-invoices/latest',
  FORM_27_SHIPPING_CLEARANCE: '/api/v1/bills-of-entry/latest',
  FORM_29_BID_DOC_TECHNO_COMMERCIAL: '/api/v1/bid-document-techno-commercial/latest',
  FORM_30_TECHNO_COMMERCIAL_TENDER: '/api/v1/techno-commercial-tenders/latest',
  FORM_31_BID_DOC_LTE: '/api/v1/bid-document-lte/latest',
  FORM_33_STE: '/api/v1/single-tender-enquiries/latest',
  FORM_34_BID_DOC_STE: '/api/v1/bid-document-ste/latest',
  FORM_35_ICB: '/api/v1/international-competitive-biddings/latest',
  FORM_36_BID_DOC_ICB: '/api/v1/bid-document-icb/latest',
};

@Injectable({
  providedIn: 'root',
})
export class FormApiService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  /**
   * Retrieves all entries for a given form definition and project using its dedicated individual REST endpoint.
   * Does NOT call /projects/:id/steps.
   */
  getEntries(formDef: FormDefinition, projectId: number): Observable<ProjectStep[]> {
    if (!formDef.apiEndpoint) {
      return of([]);
    }

    const endpointUrl = `${this.apiBaseUrl}${formDef.apiEndpoint}?project_id=${projectId}`;
    return this.http.get<unknown[] | { data: unknown[] }>(endpointUrl).pipe(
      map((res) => {
        const rawItems = Array.isArray(res)
          ? res
          : res && typeof res === 'object' && Array.isArray((res as Record<string, unknown>)['data'])
            ? ((res as Record<string, unknown>)['data'] as unknown[])
            : [];
        return rawItems.map((it) =>
          normalizeBackendEntityToStep(it as Record<string, unknown>, formDef, projectId),
        );
      }),
      catchError((err) => {
        console.error(`[FormApiService] Failed to fetch entries from ${formDef.apiEndpoint}:`, err);
        return of([]);
      }),
    );
  }

  /**
   * Retrieves the latest entry for a given form definition and project using its explicit
   * `latestApiEndpoint` (or explicit entry in `FORM_LATEST_API_ENDPOINTS`).
   * Does NOT dynamically append `/latest` to `apiEndpoint` and does not fall back to list GET.
   */
  getLatestEntry(formDef: FormDefinition, projectId: number): Observable<ProjectStep | null> {
    const latestEndpoint =
      formDef.latestApiEndpoint ||
      (formDef.apiEndpoint ? FORM_LATEST_API_ENDPOINTS[formDef.formCode] : undefined);
    if (!latestEndpoint) {
      return of(null);
    }

    const endpointUrl = `${this.apiBaseUrl}${latestEndpoint}?project_id=${projectId}`;
    return this.http.get<Record<string, unknown> | { data: Record<string, unknown> }>(endpointUrl).pipe(
      map((res) => {
        const item = unwrapLatestApiRecord(res);
        if (!item) return null;
        return normalizeBackendEntityToStep(item, formDef, projectId);
      }),
      catchError(() => of(null)),
    );
  }

  /**
   * Retrieves the latest preceding tender/enquiry step directly from the dedicated backend endpoint.
   * Route: GET /api/v1/corrigendums/latest-tender?project_id={projectId}
   */
  getLatestTenderForCorrigendum(projectId: number): Observable<ProjectStep | null> {
    const endpointUrl = `${this.apiBaseUrl}/api/v1/corrigendums/latest-tender?project_id=${projectId}`;
    return this.http.get<Record<string, unknown> | { data: Record<string, unknown> }>(endpointUrl).pipe(
      map((res) => {
        const item = unwrapLatestApiRecord(res);
        if (!item) return null;

        const fcode = String(item['form_code'] || 'FORM_04_LTE');
        const targetDef = getFormDefinition(fcode) || getFormDefinition('FORM_04_LTE');
        if (!targetDef) return null;

        return normalizeBackendEntityToStep(item, targetDef, projectId);
      }),
      catchError(() => of(null)),
    );
  }

  /**
   * Retrieves the latest Corrigendum record for a given project directly from the dedicated backend endpoint.
   * Route: GET /api/v1/corrigendums/latest?project_id={projectId}
   */
  getLatestCorrigendum(projectId: number): Observable<Record<string, unknown> | null> {
    const endpointUrl = `${this.apiBaseUrl}/api/v1/corrigendums/latest?project_id=${projectId}`;
    return this.http.get<Record<string, unknown> | { data: Record<string, unknown> }>(endpointUrl).pipe(
      map((res) => unwrapLatestApiRecord(res)),
      catchError(() => of(null)),
    );
  }

  /**
   * Retrieves a single entry by ID from its dedicated individual REST endpoint.
   */
  getEntryById(formDef: FormDefinition, stepId: number, projectId = 0): Observable<ProjectStep> {
    if (!formDef.apiEndpoint) {
      return throwError(() => new Error(`No individual API endpoint for ${formDef.name}`));
    }

    const endpointUrl = `${this.apiBaseUrl}${formDef.apiEndpoint}/${stepId}`;
    return this.http.get<Record<string, unknown> | { data: Record<string, unknown> }>(endpointUrl).pipe(
      map((res) => {
        const item = (res && typeof res === 'object' && 'data' in res ? res['data'] : res) as Record<string, unknown>;
        return normalizeBackendEntityToStep(item, formDef, projectId);
      }),
    );
  }

  /**
   * Creates a new entry using the dedicated REST endpoint (multipart/form-data or json).
   */
  createEntry(
    formDef: FormDefinition,
    projectId: number,
    payload: Record<string, unknown>,
    files: File[] = [],
  ): Observable<ProjectStep> {
    if (!formDef.apiEndpoint) {
      return throwError(() => new Error(`No individual API endpoint for ${formDef.name}`));
    }

    const endpointUrl = `${this.apiBaseUrl}${formDef.apiEndpoint}`;
    const { table_items, ...restPayload } = payload;
    const rawItems = (payload['items'] ?? table_items ?? []) as Array<Record<string, unknown>>;
    const cleanedItems = cleanTableItems(rawItems);
    const bodyPayload: Record<string, unknown> = {
      project_id: projectId,
      ...restPayload,
      items: cleanedItems,
    };

    if (formDef.formCode === 'FORM_09_RFQ') {
      const rDate =
        formatLocalDate(bodyPayload['request_date'] as string | Date) ||
        formatLocalDate(bodyPayload['quotation_requested_date'] as string | Date) ||
        formatLocalDate(bodyPayload['rfq_date'] as string | Date);
      if (rDate) {
        bodyPayload['quotation_requested_date'] = rDate;
        bodyPayload['request_date'] = rDate;
        bodyPayload['rfq_date'] = rDate;
      }
    }

    if (formDef.formCode === 'FORM_10_COST_SHEET') {
      const existingGp = (payload['globalParams'] || {}) as Record<string, unknown>;
      bodyPayload['title'] = payload['title'] || payload['project_title'] || 'Cost Sheet';
      bodyPayload['globalParams'] = {
        eurToInr: Number(payload['eur_to_inr_rate_prep'] ?? existingGp['eurToInr'] ?? 1),
        insuranceFreightRate: Number(payload['freight_insurance_pct'] ?? existingGp['insuranceFreightRate'] ?? 0),
        defaultCustomsDutyRate: Number(payload['custom_duty_pct'] ?? existingGp['defaultCustomsDutyRate'] ?? 0),
        igstRate: Number(payload['igst_pct'] ?? existingGp['igstRate'] ?? 0),
        transportationRate: Number(payload['transportation_pct'] ?? existingGp['transportationRate'] ?? 0),
        financeChargesRate: Number(payload['finance_charges_pct'] ?? existingGp['financeChargesRate'] ?? 0),
        marginRate: Number(payload['margin_pct'] ?? existingGp['marginRate'] ?? 0),
        gstRate: Number(payload['gst_pct'] ?? existingGp['gstRate'] ?? 0),
      };
    }

    if (formDef.formCode === 'FORM_26_TAX_INVOICE_CUSTOMER') {
      const rate = extractGstRate(bodyPayload, formDef.fields);
      if (rate !== null && rate !== undefined) {
        bodyPayload['gst_pct'] = rate;
        bodyPayload['gst_rate_pct'] = rate;
        bodyPayload['gst_rate'] = rate;
      }
    }

    if (formDef.formCode === 'FORM_13_PAC_TENDER') {
      if (bodyPayload['tender_no'] && !bodyPayload['tender_number']) {
        bodyPayload['tender_number'] = bodyPayload['tender_no'];
      } else if (bodyPayload['tender_number'] && !bodyPayload['tender_no']) {
        bodyPayload['tender_no'] = bodyPayload['tender_number'];
      }
      if (bodyPayload['tender_issue_date'] && !bodyPayload['tender_date']) {
        bodyPayload['tender_date'] = bodyPayload['tender_issue_date'];
      } else if (bodyPayload['tender_date'] && !bodyPayload['tender_issue_date']) {
        bodyPayload['tender_issue_date'] = bodyPayload['tender_date'];
      }
    }

    if (formDef.formCode === 'FORM_14_PURCHASE_ORDER') {
      if (bodyPayload['po_no'] && !bodyPayload['po_number']) {
        bodyPayload['po_number'] = bodyPayload['po_no'];
      } else if (bodyPayload['po_number'] && !bodyPayload['po_no']) {
        bodyPayload['po_no'] = bodyPayload['po_number'];
      }
    }

    if (formDef.tableConfig?.autoCalculateTotal) {
      const tKey = formDef.tableConfig.totalKey || 'total_amount';
      const computedNet = cleanedItems.reduce((sum, row) => sum + (Number(row[tKey]) || 0), 0);
      const existingNet =
        bodyPayload['total_net_amount'] !== undefined && bodyPayload['total_net_amount'] !== null && bodyPayload['total_net_amount'] !== ''
          ? Number(bodyPayload['total_net_amount'])
          : undefined;
      const netTotal = existingNet !== undefined && !isNaN(existingNet) ? existingNet : computedNet;
      bodyPayload['total_net_amount'] = netTotal;

      if (formDef.formCode !== 'FORM_10_COST_SHEET') {
        const rate = extractGstRate(bodyPayload, formDef.fields);
        const explicitGst =
          bodyPayload['gst_amount'] !== undefined && bodyPayload['gst_amount'] !== null && bodyPayload['gst_amount'] !== ''
            ? Number(bodyPayload['gst_amount'])
            : null;
        const totals = calculateTableTotalsWithGst(netTotal, rate, explicitGst);

        if (bodyPayload['total_gross_amount'] === undefined || bodyPayload['total_gross_amount'] === null || bodyPayload['total_gross_amount'] === '') {
          bodyPayload['total_gross_amount'] = totals.total_gross_amount;
        }
        if (totals.has_gst && (bodyPayload['gst_amount'] === undefined || bodyPayload['gst_amount'] === null || bodyPayload['gst_amount'] === '')) {
          bodyPayload['gst_amount'] = totals.gst_amount;
        }
        if (bodyPayload['total_amount'] === undefined) {
          bodyPayload['total_amount'] = totals.has_gst ? totals.total_gross_amount : netTotal;
        }
      } else {
        bodyPayload['total_amount_eur'] = netTotal;
      }
    }

    const sanitizedBody = sanitizePayloadDates(bodyPayload, formDef.fields, formDef.tableConfig?.columns);

    const fd = new FormData();
    fd.append('data', JSON.stringify(sanitizedBody));
    files.forEach((file) => fd.append('file', file, file.name));

    return this.http.post<Record<string, unknown>>(endpointUrl, fd).pipe(
      map((res) => {
        const item = (res && typeof res === 'object' && 'data' in res ? res['data'] : res) as Record<string, unknown>;
        return normalizeBackendEntityToStep(item || sanitizedBody, formDef, projectId);
      }),
      catchError(() => {
        // Fallback for development if dedicated form endpoint is not yet live on backend
        return of(normalizeBackendEntityToStep(sanitizedBody, formDef, projectId));
      }),
    );
  }

  /**
   * Updates an existing entry via PATCH to the dedicated REST endpoint.
   */
  updateEntry(
    formDef: FormDefinition,
    projectId: number,
    stepId: number,
    payload: Record<string, unknown>,
    files: File[] = [],
  ): Observable<ProjectStep> {
    if (!formDef.apiEndpoint) {
      return throwError(() => new Error(`No individual API endpoint for ${formDef.name}`));
    }

    const endpointUrl = `${this.apiBaseUrl}${formDef.apiEndpoint}/${stepId}`;
    const { table_items, ...restPayload } = payload;
    const rawItems = (payload['items'] ?? table_items ?? []) as Array<Record<string, unknown>>;
    const cleanedItems = cleanTableItems(rawItems);
    const bodyPayload: Record<string, unknown> = {
      project_id: projectId,
      ...restPayload,
      items: cleanedItems,
    };

    if (formDef.formCode === 'FORM_09_RFQ') {
      const rDate =
        formatLocalDate(bodyPayload['request_date'] as string | Date) ||
        formatLocalDate(bodyPayload['quotation_requested_date'] as string | Date) ||
        formatLocalDate(bodyPayload['rfq_date'] as string | Date);
      if (rDate) {
        bodyPayload['quotation_requested_date'] = rDate;
        bodyPayload['request_date'] = rDate;
        bodyPayload['rfq_date'] = rDate;
      }
    }

    if (formDef.formCode === 'FORM_10_COST_SHEET') {
      const existingGp = (payload['globalParams'] || {}) as Record<string, unknown>;
      bodyPayload['title'] = payload['title'] || payload['project_title'] || 'Cost Sheet';
      bodyPayload['globalParams'] = {
        eurToInr: Number(payload['eur_to_inr_rate_prep'] ?? existingGp['eurToInr'] ?? 1),
        insuranceFreightRate: Number(payload['freight_insurance_pct'] ?? existingGp['insuranceFreightRate'] ?? 0),
        defaultCustomsDutyRate: Number(payload['custom_duty_pct'] ?? existingGp['defaultCustomsDutyRate'] ?? 0),
        igstRate: Number(payload['igst_pct'] ?? existingGp['igstRate'] ?? 0),
        transportationRate: Number(payload['transportation_pct'] ?? existingGp['transportationRate'] ?? 0),
        financeChargesRate: Number(payload['finance_charges_pct'] ?? existingGp['financeChargesRate'] ?? 0),
        marginRate: Number(payload['margin_pct'] ?? existingGp['marginRate'] ?? 0),
        gstRate: Number(payload['gst_pct'] ?? existingGp['gstRate'] ?? 0),
      };
    }

    if (formDef.formCode === 'FORM_26_TAX_INVOICE_CUSTOMER') {
      const rate = extractGstRate(bodyPayload, formDef.fields);
      if (rate !== null && rate !== undefined) {
        bodyPayload['gst_pct'] = rate;
        bodyPayload['gst_rate_pct'] = rate;
        bodyPayload['gst_rate'] = rate;
      }
    }

    if (formDef.formCode === 'FORM_13_PAC_TENDER') {
      if (bodyPayload['tender_no'] && !bodyPayload['tender_number']) {
        bodyPayload['tender_number'] = bodyPayload['tender_no'];
      } else if (bodyPayload['tender_number'] && !bodyPayload['tender_no']) {
        bodyPayload['tender_no'] = bodyPayload['tender_number'];
      }
      if (bodyPayload['tender_issue_date'] && !bodyPayload['tender_date']) {
        bodyPayload['tender_date'] = bodyPayload['tender_issue_date'];
      } else if (bodyPayload['tender_date'] && !bodyPayload['tender_issue_date']) {
        bodyPayload['tender_issue_date'] = bodyPayload['tender_date'];
      }
    }

    if (formDef.formCode === 'FORM_14_PURCHASE_ORDER') {
      if (bodyPayload['po_no'] && !bodyPayload['po_number']) {
        bodyPayload['po_number'] = bodyPayload['po_no'];
      } else if (bodyPayload['po_number'] && !bodyPayload['po_no']) {
        bodyPayload['po_no'] = bodyPayload['po_number'];
      }
    }

    if (formDef.tableConfig?.autoCalculateTotal) {
      const tKey = formDef.tableConfig.totalKey || 'total_amount';
      const computedNet = cleanedItems.reduce((sum, row) => sum + (Number(row[tKey]) || 0), 0);
      const existingNet =
        bodyPayload['total_net_amount'] !== undefined && bodyPayload['total_net_amount'] !== null && bodyPayload['total_net_amount'] !== ''
          ? Number(bodyPayload['total_net_amount'])
          : undefined;
      const netTotal = existingNet !== undefined && !isNaN(existingNet) ? existingNet : computedNet;
      bodyPayload['total_net_amount'] = netTotal;

      if (formDef.formCode !== 'FORM_10_COST_SHEET') {
        const rate = extractGstRate(bodyPayload, formDef.fields);
        const explicitGst =
          bodyPayload['gst_amount'] !== undefined && bodyPayload['gst_amount'] !== null && bodyPayload['gst_amount'] !== ''
            ? Number(bodyPayload['gst_amount'])
            : null;
        const totals = calculateTableTotalsWithGst(netTotal, rate, explicitGst);

        if (bodyPayload['total_gross_amount'] === undefined || bodyPayload['total_gross_amount'] === null || bodyPayload['total_gross_amount'] === '') {
          bodyPayload['total_gross_amount'] = totals.total_gross_amount;
        }
        if (totals.has_gst && (bodyPayload['gst_amount'] === undefined || bodyPayload['gst_amount'] === null || bodyPayload['gst_amount'] === '')) {
          bodyPayload['gst_amount'] = totals.gst_amount;
        }
        if (bodyPayload['total_amount'] === undefined) {
          bodyPayload['total_amount'] = totals.has_gst ? totals.total_gross_amount : netTotal;
        }
      } else {
        bodyPayload['total_amount_eur'] = netTotal;
      }
    }

    const sanitizedBody = sanitizePayloadDates(bodyPayload, formDef.fields, formDef.tableConfig?.columns);

    const fd = new FormData();
    fd.append('data', JSON.stringify(sanitizedBody));
    files.forEach((file) => fd.append('file', file, file.name));

    return this.http.patch<Record<string, unknown>>(endpointUrl, fd).pipe(
      catchError((err: unknown) => {
        if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 405) {
          return this.http.put<Record<string, unknown>>(endpointUrl, fd);
        }
        return throwError(() => err);
      }),
      map((res) => {
        const item = (res && typeof res === 'object' && 'data' in res ? res['data'] : res) as Record<string, unknown>;
        return normalizeBackendEntityToStep(item || bodyPayload, formDef, projectId);
      }),
    );
  }

  /**
   * Deletes an entry via the dedicated REST endpoint.
   */
  deleteEntry(
    formDef: FormDefinition,
    projectId: number,
    stepId: number,
  ): Observable<boolean> {
    if (!formDef.apiEndpoint) {
      return of(false);
    }

    const endpointUrl = `${this.apiBaseUrl}${formDef.apiEndpoint}/${stepId}`;
    return this.http.delete<void>(endpointUrl).pipe(
      map(() => true),
    );
  }
}
