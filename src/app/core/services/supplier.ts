import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Supplier, SupplierCreateInput, SupplierUpdateInput } from '../models/supplier.model';
import { API_BASE_URL } from '../tokens/api-base-url.token';

@Injectable({
  providedIn: 'root',
})
export class SupplierService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getSuppliers(): Observable<Supplier[]> {
    return this.http.get<Supplier[]>(`${this.apiBaseUrl}/api/v1/suppliers`);
  }

  getSupplierById(id: number): Observable<Supplier> {
    return this.http.get<Supplier>(`${this.apiBaseUrl}/api/v1/suppliers/${id}`);
  }

  createSupplier(supplier: SupplierCreateInput): Observable<Supplier> {
    return this.http.post<Supplier>(`${this.apiBaseUrl}/api/v1/suppliers`, supplier);
  }

  updateSupplier(id: number, supplier: SupplierUpdateInput): Observable<Supplier> {
    return this.http.put<Supplier>(`${this.apiBaseUrl}/api/v1/suppliers/${id}`, supplier);
  }
}
