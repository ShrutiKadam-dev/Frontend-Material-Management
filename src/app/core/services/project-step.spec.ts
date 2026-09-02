import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ProjectStepService } from './project-step';

describe('ProjectStepService', () => {
  let service: ProjectStepService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ProjectStepService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
