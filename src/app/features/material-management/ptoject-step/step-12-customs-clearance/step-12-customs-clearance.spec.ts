import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

import { Step12CustomsClearance } from './step-12-customs-clearance';

describe('Step12CustomsClearance', () => {
  let component: Step12CustomsClearance;
  let fixture: ComponentFixture<Step12CustomsClearance>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step12CustomsClearance],
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

    fixture = TestBed.createComponent(Step12CustomsClearance);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
