export type PhaseFilter = 'all' | 'phase-1' | 'phase-2' | 'phase-3' | 'phase-4' | 'phase-5';

export interface PhaseInfo {
  id: PhaseFilter;
  title: string;
  shortTitle: string;
  stepRange: string;
  badgeClass: string;
}

export const PIPELINE_PHASES: PhaseInfo[] = [
  {
    id: 'phase-1',
    title: 'Pre-Bidding & Tenders',
    shortTitle: 'Phase 1: Pre-Bidding',
    stepRange: 'Phase 1',
    badgeClass: 'phase-pill--bidding',
  },
  {
    id: 'phase-2',
    title: 'Sourcing & Quotations',
    shortTitle: 'Phase 2: Sourcing',
    stepRange: 'Phase 2',
    badgeClass: 'phase-pill--sourcing',
  },
  {
    id: 'phase-3',
    title: 'Supplier Orders & Invoices',
    shortTitle: 'Phase 3: Orders',
    stepRange: 'Phase 3',
    badgeClass: 'phase-pill--orders',
  },
  {
    id: 'phase-4',
    title: 'Logistics & Customs',
    shortTitle: 'Phase 4: Logistics',
    stepRange: 'Phase 4',
    badgeClass: 'phase-pill--logistics',
  },
  {
    id: 'phase-5',
    title: 'Customer & Supplier Settlement',
    shortTitle: 'Phase 5: Settlement',
    stepRange: 'Phase 5',
    badgeClass: 'phase-pill--settlement',
  },
];

export const CATEGORY_TO_PHASE_ID: Record<string, PhaseFilter> = {
  'Pre-Bidding & Tenders': 'phase-1',
  'Sourcing & Quotations': 'phase-2',
  'Supplier Orders & Invoices': 'phase-3',
  'Logistics & Customs': 'phase-4',
  'Customer & Supplier Settlement': 'phase-5',
};

