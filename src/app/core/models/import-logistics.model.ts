import { Attachment } from './attachment.model';

export type LogisticType = 'air' | 'sea';

export interface ImportLogistics {
  id: number;
  project_id: number;
  logistic_type: LogisticType;

  // Air freight fields
  airway_bill_no?: string;
  flight_name?: string;
  flight_no?: string;
  airport_of_loading?: string;

  // Sea freight fields
  bill_of_lading_no?: string;
  vessel_name?: string;
  voyage_no?: string;
  port_of_loading?: string;

  // Common fields
  date: string;
  port_of_discharge: string;
  remark?: string;
  attachments?: Attachment[];
  created_at?: string;
  updated_at?: string;
}

export interface ImportLogisticsCreateInput {
  project_id: number;
  logistic_type: LogisticType;
  airway_bill_no?: string;
  flight_name?: string;
  flight_no?: string;
  airport_of_loading?: string;
  bill_of_lading_no?: string;
  vessel_name?: string;
  voyage_no?: string;
  port_of_loading?: string;
  date: string;
  port_of_discharge: string;
  remark?: string;
}

export interface ImportLogisticsUpdateInput {
  project_id?: number;
  logistic_type?: LogisticType;
  airway_bill_no?: string;
  flight_name?: string;
  flight_no?: string;
  airport_of_loading?: string;
  bill_of_lading_no?: string;
  vessel_name?: string;
  voyage_no?: string;
  port_of_loading?: string;
  date?: string;
  port_of_discharge?: string;
  remark?: string;
}
