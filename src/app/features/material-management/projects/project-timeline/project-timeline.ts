import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ProjectStepService } from '../../../../core/services/project-step';
import { ProjectService } from '../../../../core/services/project';
import { ProjectStep, StepStatus } from '../../../../core/models/project-step.model';
import { Project } from '../../../../core/models/project.model';
import { formatDisplayDate } from '../../../../core/utils/date.utils';

@Component({
  selector: 'app-project-timeline',
  imports: [ButtonModule],
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
    return stepNumber >= 1 && stepNumber <= 15;
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

  protected getStepDate(step: ProjectStep): { label: string; date: string } | null {
    if (step.completed_at) {
      const formatted = formatDisplayDate(step.completed_at);
      if (formatted && formatted !== '—') {
        return {
          label: 'Completed',
          date: formatted,
        };
      }
    }

    let d: Record<string, unknown> | null = null;
    if (step.data) {
      if (typeof step.data === 'object' && !Array.isArray(step.data)) {
        d = step.data as Record<string, unknown>;
      } else if (typeof step.data === 'string') {
        try {
          const parsed = JSON.parse(step.data);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            d = parsed as Record<string, unknown>;
          }
        } catch {
          d = null;
        }
      }
    }

    if (d) {
      const dateVal =
        d['quotation_date'] ||
        d['qo_date'] ||
        d['quotation_requested_date'] ||
        d['po_date'] ||
        d['order_confirmation_date'] ||
        d['confirmation_date'] ||
        d['order_date'] ||
        d['invoice_date'] ||
        d['proforma_invoice_date'] ||
        d['delivery_date'] ||
        d['delivery_challan_date'] ||
        d['payment_date'] ||
        d['boe_date'] ||
        d['clearance_date'] ||
        d['duty_paid_date'] ||
        d['tender_date'] ||
        d['submission_date'] ||
        d['submitted_date'] ||
        d['prepared_date'] ||
        d['packing_list_date'] ||
        d['certificate_date'] ||
        d['date'] ||
        d['created_at'] ||
        d['updated_at'];

      if (dateVal && (typeof dateVal === 'string' || typeof dateVal === 'number' || dateVal instanceof Date)) {
        const formatted = formatDisplayDate(dateVal);
        if (formatted && formatted !== '—') {
          return {
            label: step.status === 'completed' ? 'Completed' : 'Date',
            date: formatted,
          };
        }
      }
    }

    return null;
  }
}
