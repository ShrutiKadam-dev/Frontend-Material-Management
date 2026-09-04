export interface CostSheetGlobalParams {
  eurToInr: number;
  insuranceFreightRate: number;
  defaultCustomsDutyRate: number;
  igstRate: number;
  transportationRate: number;
  financeChargesRate: number;
  marginRate: number;
  gstRate: number;
}

export interface CostSheetItemInput {
  quotationNumber: string;
  quotationIndex: string;
  itemDescription: string;
  itemCode: string;
  pricePerUnitEur: number;
  quantity: number;
  customsDutyRate: number;
}

export interface CostSheetPriceChange {
  id?: number;
  oldPriceEur?: number;
  newPriceEur?: number;
  supplierName?: string;
  changeReason?: string;
  changedBy?: number;
  createdAt?: string;
  isRateIncrease?: boolean;
}

export interface CostSheetItem extends CostSheetItemInput {
  id?: number;
  hasRateIncrease?: boolean;
  latestPriceChange?: CostSheetPriceChange | Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;

  // Client-side computed landed cost properties for display
  cifBaseInr?: number;
  insuranceFreightInr?: number;
  assessableValueInr?: number;
  customsDutyInr?: number;
  igstInr?: number;
  landedCostInr?: number;
  transportationInr?: number;
  financeChargesInr?: number;
  totalCostPerUnitInr?: number;
  marginInr?: number;
  sellingPricePerUnitInr?: number;
  pricePerUnitInr?: number;
  totalPriceInr?: number;
  totalLineEur?: number;
  totalLineInr?: number;
}

export interface CostSheetCreateInput {
  project_id: number;
  title: string;
  globalParams: CostSheetGlobalParams;
  items: CostSheetItemInput[];
}

export interface CostSheetUpdateInput {
  project_id?: number;
  title?: string;
  globalParams?: CostSheetGlobalParams;
  items?: CostSheetItemInput[];
}

export interface CostSheet {
  id: number;
  project_id: number;
  product_id?: number;
  versionNumber?: number;
  title: string;
  globalParams?: CostSheetGlobalParams;
  output?: Record<string, unknown>;
  status?: string;
  createdBy?: number;
  createdAt?: string;
  updatedAt?: string;
  totalItemCount?: number;
  cumulativeProjectCostInr?: number;
  totalPriceInr?: number;
  hasRateIncrease?: boolean;
  latestPriceChange?: CostSheetPriceChange | Record<string, unknown>;
  recentPriceChanges?: CostSheetPriceChange[];
  items: CostSheetItem[];
}
