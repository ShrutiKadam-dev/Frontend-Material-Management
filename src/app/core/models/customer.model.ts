import type { PointOfContact } from './contact.model';

export type { PointOfContact } from './contact.model';

export interface Customer {
  id: number;
  name: string;
  nickname?: string;
  email?: string;
  contact_number?: string;
  address?: string;
  street?: string;
  area?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  pocs?: PointOfContact[];
  website_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerCreateInput {
  name: string;
  nickname?: string;
  street?: string;
  area?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  pocs?: PointOfContact[];
  website_url?: string | null;
  email?: string;
  contact_number?: string;
  address?: string;
}

export interface CustomerUpdateInput {
  name?: string;
  nickname?: string;
  email?: string;
  contact_number?: string;
  address?: string;
  street?: string;
  area?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  pocs?: PointOfContact[];
  website_url?: string | null;
}
