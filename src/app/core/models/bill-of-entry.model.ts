import { Attachment } from './attachment.model';

export interface BillOfEntry {
  id: number;
  project_id: number;
  bill_of_entry_no: string;
  date: string;
  bcd: number;
  sws: number;
  igst: number;
  total_assessable_value: number;
  total_duty?: number;
  remark?: string;
  attachments?: Attachment[];
  created_at?: string;
  updated_at?: string;
}

export interface BillOfEntryCreateInput {
  project_id: number;
  bill_of_entry_no: string;
  date: string;
  bcd: number;
  sws: number;
  igst: number;
  total_assessable_value: number;
  total_duty?: number;
  remark?: string;
}

export interface BillOfEntryUpdateInput {
  project_id?: number;
  bill_of_entry_no?: string;
  date?: string;
  bcd?: number;
  sws?: number;
  igst?: number;
  total_assessable_value?: number;
  total_duty?: number;
  remark?: string;
}
