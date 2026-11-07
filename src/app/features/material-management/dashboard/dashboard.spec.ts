import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { Dashboard } from './dashboard';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should compute latestProjects taking only the latest 2 projects sorted by id descending', () => {
    (component as unknown as { projects: { set: (val: unknown) => void } }).projects.set([
      { id: 1, project_title: 'Old Project', health_status: 'on_track' },
      { id: 5, project_title: 'Newest Project', health_status: 'delayed' },
      { id: 3, project_title: 'Middle Project', health_status: 'on_track' },
    ]);

    const latest = (component as unknown as { latestProjects: () => Array<{ id: number; project_title: string }> }).latestProjects();
    expect(latest.length).toBe(2);
    expect(latest[0].id).toBe(5);
    expect(latest[1].id).toBe(3);
  });

  it('should compute progress percentage accurately', () => {
    const projectWithPercentage = { id: 1, progress_percentage: 60 } as unknown as Parameters<typeof component['getProgressPercent']>[0];
    expect(component['getProgressPercent'](projectWithPercentage)).toBe(60);

    const projectWithProgress = { id: 2, progress: 40 } as unknown as Parameters<typeof component['getProgressPercent']>[0];
    expect(component['getProgressPercent'](projectWithProgress)).toBe(40);

    const projectWithStep = { id: 3, current_step_number: 3 } as unknown as Parameters<typeof component['getProgressPercent']>[0];
    expect(component['getProgressPercent'](projectWithStep)).toBe(Math.round((3 / 15) * 100));

    const projectWithDynamicSteps = { id: 4, current_step_number: 3, total_steps: 6 } as unknown as Parameters<typeof component['getProgressPercent']>[0];
    expect(component['getProgressPercent'](projectWithDynamicSteps)).toBe(50);

    const projectCompleted = { id: 5, status: 'completed' } as unknown as Parameters<typeof component['getProgressPercent']>[0];
    expect(component['getProgressPercent'](projectCompleted)).toBe(100);
  });

  it('should compute dynamic phasesBreakdown across all 5 operational phases', () => {
    (component as unknown as { projects: { set: (val: unknown) => void } }).projects.set([
      { id: 1, current_form_code: 'FORM_01_PQB' },
      { id: 2, current_step_name: 'Customer Query' },
      { id: 3, current_step_name: 'Purchase Order' },
      { id: 4, current_step_name: 'Transportation Details' },
      { id: 5, status: 'completed' },
    ]);

    const breakdown = component['phasesBreakdown']();
    expect(breakdown.length).toBe(5);
    expect(breakdown[0].count).toBe(1); // Pre-Bidding
    expect(breakdown[1].count).toBe(1); // Sourcing
    expect(breakdown[2].count).toBe(1); // Orders
    expect(breakdown[3].count).toBe(1); // Logistics
    expect(breakdown[4].count).toBe(1); // Settlement
  });

  it('should format step display labels dynamically', () => {
    const dynamicProject = { current_step_number: 2, total_steps: 8 } as unknown as Parameters<typeof component['getStepDisplayLabel']>[0];
    expect(component['getStepDisplayLabel'](dynamicProject)).toBe('Step 2 of 8');

    const completedProject = { status: 'completed', total_steps: 5 } as unknown as Parameters<typeof component['getStepDisplayLabel']>[0];
    expect(component['getStepDisplayLabel'](completedProject)).toBe('5/5 Steps Done');

    const noTotalStepsProject = { current_step_number: 3 } as unknown as Parameters<typeof component['getStepDisplayLabel']>[0];
    expect(component['getStepDisplayLabel'](noTotalStepsProject)).toBe('Step 3');
  });

  it('should map status labels and badge classes appropriately', () => {
    expect(component['getStatusLabel']('completed')).toBe('Completed');
    expect(component['getStatusLabel']('on_hold')).toBe('On Hold');
    expect(component['getStatusLabel']('cancelled')).toBe('Cancelled');
    expect(component['getStatusLabel']('in_progress')).toBe('In Progress');

    expect(component['getStatusBadgeClass']('completed')).toBe('status-badge--completed');
    expect(component['getStatusBadgeClass']('on_hold')).toBe('status-badge--on-hold');
    expect(component['getStatusBadgeClass']('cancelled')).toBe('status-badge--cancelled');
    expect(component['getStatusBadgeClass']('in_progress')).toBe('status-badge--in-progress');
  });

  it('should patch first name and last name into greetingTitle', () => {
    const authService = TestBed.inject(AuthService);
    (authService as unknown as { sessionState: { set: (v: unknown) => void } }).sessionState.set({
      accessToken: 'mock-access',
      refreshToken: 'mock-refresh',
      user: {
        id: '2',
        name: 'shruti kadam',
        first_name: 'shruti',
        last_name: 'kadam',
        email: 'shruti.kadam@stcpl.com',
        role: 'admin',
      },
    });

    const greeting = (component as unknown as { greetingTitle: () => string }).greetingTitle();
    expect(greeting).toMatch(/Good (morning|afternoon|evening), Shruti Kadam/);
  });

  it('should not show placeholder "string" and should deduce from email or fallback', () => {
    const authService = TestBed.inject(AuthService);
    (authService as unknown as { sessionState: { set: (v: unknown) => void } }).sessionState.set({
      accessToken: 'mock-access',
      refreshToken: 'mock-refresh',
      user: {
        id: '2',
        name: 'string',
        email: 'shruti.kadam@stcpl.com',
        role: 'admin',
      },
    });

    const greeting = (component as unknown as { greetingTitle: () => string }).greetingTitle();
    expect(greeting).not.toContain('string');
    expect(greeting).toMatch(/Good (morning|afternoon|evening), Shruti Kadam/);
  });

  it('should fall back to Admin when no user is logged in', () => {
    const authService = TestBed.inject(AuthService);
    (authService as unknown as { sessionState: { set: (v: unknown) => void } }).sessionState.set(null);

    const greeting = (component as unknown as { greetingTitle: () => string }).greetingTitle();
    expect(greeting).toMatch(/Good (morning|afternoon|evening), Admin/);
  });
});

