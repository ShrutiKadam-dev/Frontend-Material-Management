import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';

import { LocationService } from './location';
import { API_BASE_URL } from '../tokens/api-base-url.token';

describe('LocationService', () => {
  let service: LocationService;
  let httpClientMock: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    httpClientMock = {
      get: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        LocationService,
        { provide: HttpClient, useValue: httpClientMock },
        { provide: API_BASE_URL, useValue: 'http://localhost:5000' },
      ],
    });

    service = TestBed.inject(LocationService);
  });

  it('should fetch countries from backend and cache the response', () => {
    const mockCountries = { success: true, count: 3, data: ['India', 'Germany', 'USA'] };
    httpClientMock.get.mockReturnValue(of(mockCountries));

    let countries: string[] = [];
    service.getCountries().subscribe((res) => {
      countries = res;
    });

    expect(countries).toEqual(['India', 'Germany', 'USA']);
    expect(httpClientMock.get).toHaveBeenCalledWith('http://localhost:5000/api/v1/locations/countries');

    // Subsequent call should use cache
    service.getCountries().subscribe();
    expect(httpClientMock.get).toHaveBeenCalledTimes(1);
  });

  it('should fetch states with country parameter', () => {
    const mockStates = { success: true, count: 2, data: ['Maharashtra', 'Gujarat'] };
    httpClientMock.get.mockReturnValue(of(mockStates));

    let states: string[] = [];
    service.getStates('India').subscribe((res) => {
      states = res;
    });

    expect(states).toEqual(['Maharashtra', 'Gujarat']);
    expect(httpClientMock.get).toHaveBeenCalledWith(
      'http://localhost:5000/api/v1/locations/states',
      expect.objectContaining({
        params: expect.anything(),
      }),
    );
  });

  it('should fetch cities with country, state, and search parameters', () => {
    const mockCities = { success: true, count: 2, data: ['Pune', 'Mumbai'] };
    httpClientMock.get.mockReturnValue(of(mockCities));

    let cities: string[] = [];
    service.getCities('India', 'Maharashtra', 'Pu').subscribe((res) => {
      cities = res;
    });

    expect(cities).toEqual(['Pune', 'Mumbai']);
    expect(httpClientMock.get).toHaveBeenCalledWith(
      'http://localhost:5000/api/v1/locations/cities',
      expect.objectContaining({
        params: expect.anything(),
      }),
    );
  });

  it('should perform city lookup successfully', () => {
    const mockLookup = {
      success: true,
      data: { city: 'Pune', state: 'Maharashtra', country: 'India' },
    };
    httpClientMock.get.mockReturnValue(of(mockLookup));

    let result: unknown = null;
    service.lookupCity('Pune').subscribe((res) => {
      result = res;
    });

    expect(result).toEqual({ city: 'Pune', state: 'Maharashtra', country: 'India' });
  });

  it('should pass country and state parameters when performing city lookup', () => {
    const mockLookup = {
      success: true,
      data: { city: 'Tolosa', state: 'Guipuzcoa', country: 'Spain' },
    };
    httpClientMock.get.mockReturnValue(of(mockLookup));

    let result: unknown = null;
    service.lookupCity('Tolosa', 'Spain').subscribe((res) => {
      result = res;
    });

    expect(result).toEqual({ city: 'Tolosa', state: 'Guipuzcoa', country: 'Spain' });
    expect(httpClientMock.get).toHaveBeenCalledWith(
      'http://localhost:5000/api/v1/locations/lookup',
      expect.objectContaining({
        params: expect.any(Object),
      }),
    );
  });

  it('should gracefully return null when city lookup fails with 404 or network error', () => {
    httpClientMock.get.mockReturnValue(throwError(() => new Error('Not found')));

    let result: unknown = 'initial';
    service.lookupCity('UnknownCity').subscribe((res) => {
      result = res;
    });

    expect(result).toBeNull();
  });

  it('should normalize and deduplicate city entries with diacritical marks or macrons', () => {
    const mockCities = {
      success: true,
      count: 4,
      data: ['Kolhapur', 'Kolhāpur', 'Thāne', 'Thane', 'Pune'],
    };
    httpClientMock.get.mockReturnValue(of(mockCities));

    let cities: string[] = [];
    service.getCities('India', 'Maharashtra').subscribe((res) => {
      cities = res;
    });

    expect(cities).toEqual(['Kolhapur', 'Thane', 'Pune']);
  });
});
