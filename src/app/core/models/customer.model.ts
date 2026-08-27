export interface Customer {
  id: number;
  name: string;
  email: string;
  contact_number: string;
  address: string;
  website_url: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerCreateInput {
  name: string;
  email: string;
  contact_number: string;
  address: string;
  website_url: string;
}

export interface CustomerUpdateInput {
  name: string;
  email: string;
  contact_number: string;
  address: string;
  website_url: string;
}
