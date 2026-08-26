import { TestBed } from '@angular/core/testing';

import { ProjectStep } from './project-step';

describe('ProjectStep', () => {
  let service: ProjectStep;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProjectStep);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
