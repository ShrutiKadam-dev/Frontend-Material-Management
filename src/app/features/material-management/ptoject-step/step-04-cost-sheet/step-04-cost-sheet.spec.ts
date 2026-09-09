import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

import { Step04CostSheet } from './step-04-cost-sheet';

describe('Step04CostSheet', () => {
  let component: Step04CostSheet;
  let fixture: ComponentFixture<Step04CostSheet>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step04CostSheet],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideNoopAnimations(),
        MessageService,
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => '1' } },
            paramMap: of({ get: () => '1' }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Step04CostSheet);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
