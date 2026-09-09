import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { Step13CustomerDelivery } from './step-13-customer-delivery';
import { CustomerDeliveryService } from '../../../../core/services/customer-delivery';
import { ProjectService } from '../../../../core/services/project';
import { CustomerService } from '../../../../core/services/customer';
import { AttachmentService } from '../../../../core/services/attachment';

describe('Step13CustomerDelivery', () => {
  let component: Step13CustomerDelivery;
  let fixture: ComponentFixture<Step13CustomerDelivery>;

  const mockDeliveryService = {
    getTaxInvoices: () => of([]),
    getPackingLists: () => of([]),
    getDeliveryChallans: () => of([]),
    getWarrantyCertificates: () => of([]),
    getTransportDetails: () => of([]),
    getLatestPurchaseOrder: () => of(null),
  };

  const mockProjectService = {
    getProjectById: () => of({ id: 1, name: 'Test Project', customer_id: 1 }),
  };

  const mockCustomerService = {
    getCustomerById: () => of({ id: 1, name: 'Test Customer' }),
  };

  const mockAttachmentService = {
    downloadAttachment: () => of(new Blob()),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step13CustomerDelivery],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => '1' } },
            paramMap: of({ get: () => '1' }),
          },
        },
        { provide: CustomerDeliveryService, useValue: mockDeliveryService },
        { provide: ProjectService, useValue: mockProjectService },
        { provide: CustomerService, useValue: mockCustomerService },
        { provide: AttachmentService, useValue: mockAttachmentService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Step13CustomerDelivery);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
