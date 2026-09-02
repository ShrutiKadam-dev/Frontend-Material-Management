import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';

import { ProjectStepService } from '../../../../core/services/project-step';
import { ProjectService } from '../../../../core/services/project';
import { ProjectStep, StepStatus } from '../../../../core/models/project-step.model';
import { Project } from '../../../../core/models/project.model';

@Component({
  selector: 'app-project-timeline',
  imports: [ButtonModule, DatePipe],
  templateUrl: './project-timeline.html',
  styleUrl: './project-timeline.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTimeline implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectStepService = inject(ProjectStepService);
  private readonly projectService = inject(ProjectService);

  protected readonly project = signal<Project | null>(null);
  protected readonly steps = signal<ProjectStep[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly completedCount = computed(
    () => this.steps().filter((s) => s.status === 'completed').length,
  );
  protected readonly progressPercent = computed(() =>
    this.steps().length ? Math.round((this.completedCount() / this.steps().length) * 100) : 0,
  );

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('projectId'));
    if (!id) {
      this.error.set('Invalid project ID.');
      this.loading.set(false);
      return;
    }

    this.projectService.getProjectById(id).subscribe({
      next: (p) => this.project.set(p),
      error: () => {/* non-fatal — title just won't show */},
    });

    this.projectStepService.getSteps(id).subscribe({
      next: (data) => {
        this.steps.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load project steps. Please try again.');
        this.loading.set(false);
      },
    });
  }

  protected goBack(): void {
    this.router.navigate(['/projects']);
  }

  protected isStepClickable(stepNumber: number): boolean {
    return stepNumber === 1 || stepNumber === 2;
  }

  protected navigateToStep(stepNumber: number): void {
    const projectId = this.route.snapshot.paramMap.get('projectId');
    if (this.isStepClickable(stepNumber)) {
      this.router.navigate(['/projects', projectId, 'steps', stepNumber]);
    }
  }

  protected statusLabel(status: StepStatus): string {
    const map: Record<StepStatus, string> = {
      pending: 'Pending',
      in_progress: 'In Progress',
      completed: 'Completed',
      skipped: 'Skipped',
    };
    return map[status] ?? status;
  }

  protected statusIcon(status: StepStatus): string {
    const map: Record<StepStatus, string> = {
      pending: 'pi-clock',
      in_progress: 'pi-spin pi-spinner',
      completed: 'pi-check',
      skipped: 'pi-minus',
    };
    return map[status] ?? 'pi-clock';
  }
}
