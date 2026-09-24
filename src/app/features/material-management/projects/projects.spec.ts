import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

import { CustomerService } from '../../../core/services/customer';
import { SupplierService } from '../../../core/services/supplier';
import { ProjectService } from '../../../core/services/project';
import { Projects } from './projects';

describe('Projects', () => {
  let component: Projects;
  let fixture: ComponentFixture<Projects>;

  const mockProjectService = {
    getProjects: () => of([]),
    getProjectById: (id: number) =>
      of({
        id,
        project_title: 'Demo Project',
        project_code: 'PRJ-DEMO',
        nickname: 'DEMO-NICK',
        customer_id: 1,
        supplier_id: 2,
        created_at: '2026-08-27T11:00:00Z',
        updated_at: '2026-08-27T11:00:00Z',
      }),
    createProject: (p: any) => of({ id: 1, ...p }),
    updateProject: (id: number, p: any) => of({ id, ...p }),
    deleteProject: (id: number) => of(undefined),
  };

  const mockCustomerService = {
    getCustomers: () => of([]),
  };

  const mockSupplierService = {
    getSuppliers: () => of([]),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Projects],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        { provide: ProjectService, useValue: mockProjectService },
        { provide: CustomerService, useValue: mockCustomerService },
        { provide: SupplierService, useValue: mockSupplierService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Projects);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize form with project_code and nickname', () => {
    expect(component['projectForm'].get('project_code')).toBeDefined();
    expect(component['projectForm'].get('nickname')).toBeDefined();
    expect(component['projectForm'].get('nickname')?.value).toBe('');
  });

  it('should patch nickname when opening edit dialog', () => {
    component['openEditDialog']({ id: 1, project_title: 'Test' } as any);
    expect(component['projectForm'].get('nickname')?.value).toBe('DEMO-NICK');
  });

  it('should include nickname in create payload on submit', () => {
    let capturedPayload: any = null;
    vi.spyOn(mockProjectService, 'createProject').mockImplementation((payload: any) => {
      capturedPayload = payload;
      return of({ id: 99, ...payload });
    });

    component['openAddDialog']();
    component['projectForm'].patchValue({
      project_title: 'New Cooling System',
      project_code: 'PRJ-COOL',
      nickname: 'COOL-SYS',
      customer_id: 1,
      supplier_id: 2,
    });

    component['onSubmit']();
    expect(capturedPayload).toBeTruthy();
    expect(capturedPayload.nickname).toBe('COOL-SYS');
  });
});

