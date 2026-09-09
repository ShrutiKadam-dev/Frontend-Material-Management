export interface Customer {
  id: number;
  name: string;
  email: string;
  contact_number: string;
  address: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerCreateInput {
  name: string;
  email: string;
  contact_number: string;
  address: string;
}

export interface CustomerUpdateInput {
  name: string;
  email: string;
  contact_number: string;
  address: string;
}
