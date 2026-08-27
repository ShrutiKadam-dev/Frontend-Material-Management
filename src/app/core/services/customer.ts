import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Customer, CustomerCreateInput, CustomerUpdateInput } from '../models/customer.model';
import { API_BASE_URL } from '../tokens/api-base-url.token';

@Injectable({
  providedIn: 'root',
})
export class CustomerService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getCustomers(): Observable<Customer[]> {
    return this.http.get<Customer[]>(`${this.apiBaseUrl}/api/v1/customers`);
  }

  getCustomerById(id: number): Observable<Customer> {
    return this.http.get<Customer>(`${this.apiBaseUrl}/api/v1/customers/${id}`);
  }

  createCustomer(customer: CustomerCreateInput): Observable<Customer> {
    return this.http.post<Customer>(`${this.apiBaseUrl}/api/v1/customers`, customer);
  }

  updateCustomer(id: number, customer: CustomerUpdateInput): Observable<Customer> {
    return this.http.put<Customer>(`${this.apiBaseUrl}/api/v1/customers/${id}`, customer);
  }
}
