import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

import { Step06Tender } from './step-06-tender';

describe('Step06Tender', () => {
  let component: Step06Tender;
  let fixture: ComponentFixture<Step06Tender>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step06Tender],
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

    fixture = TestBed.createComponent(Step06Tender);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
