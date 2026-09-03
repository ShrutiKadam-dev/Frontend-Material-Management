import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { CostSheetService } from './cost-sheet';
import { API_BASE_URL } from '../tokens/api-base-url.token';

describe('CostSheetService', () => {
  let service: CostSheetService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CostSheetService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://127.0.0.1:5000' },
      ],
    });
    service = TestBed.inject(CostSheetService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
