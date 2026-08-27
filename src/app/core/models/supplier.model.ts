export interface Supplier {
  id: number;
  name: string;
  email: string;
  contact_number: string;
  address: string;
  website_url: string;
  created_at: string;
  updated_at: string;
}

export interface SupplierCreateInput {
  name: string;
  email: string;
  contact_number: string;
  address: string;
  website_url: string;
}

export interface SupplierUpdateInput {
  name: string;
  email: string;
  contact_number: string;
  address: string;
  website_url: string;
}
