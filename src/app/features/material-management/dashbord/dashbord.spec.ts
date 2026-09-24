import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Dashbord } from './dashbord';

describe('Dashbord', () => {
  let component: Dashbord;
  let fixture: ComponentFixture<Dashbord>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashbord],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Dashbord);
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
});

