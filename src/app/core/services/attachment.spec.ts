import { TestBed } from '@angular/core/testing';

import { Attachment } from './attachment';

describe('Attachment', () => {
  let service: Attachment;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Attachment);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
