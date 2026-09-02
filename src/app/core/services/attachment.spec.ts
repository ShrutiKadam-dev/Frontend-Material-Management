import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AttachmentService } from './attachment';

describe('AttachmentService', () => {
  let service: AttachmentService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AttachmentService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
