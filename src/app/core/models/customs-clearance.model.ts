import { Attachment } from './attachment.model';

export interface CustomsClearance {
  id: number;
  project_id: number;
  cha_name: string;
  bill_of_entry_no: string;
  boe_date: string;
  customs_location: string;
  duty_paid_date?: string | null;
  challan_no?: string | null;
  cfs_name?: string | null;
  transaction_ref_no?: string | null;
  duty_amount: number;
  igst_amount: number;
  other_customs_charges: number;
  total_customs_amount: number;
  remark?: string | null;
  attachments?: Attachment[];
  duty_challan_attachments?: Attachment[];
  boe_attachments?: Attachment[];
  other_attachments?: Attachment[];
  created_at?: string;
  updated_at?: string;
}

export interface CustomsClearanceCreateInput {
  project_id: number;
  cha_name: string;
  bill_of_entry_no: string;
  boe_date: string;
  customs_location: string;
  duty_paid_date?: string | null;
  challan_no?: string | null;
  cfs_name?: string | null;
  transaction_ref_no?: string | null;
  duty_amount: number;
  igst_amount: number;
  other_customs_charges: number;
  total_customs_amount: number;
  remark?: string;
}

export interface CustomsClearanceUpdateInput extends Partial<CustomsClearanceCreateInput> {}
