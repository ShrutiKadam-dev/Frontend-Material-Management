import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth';
import { DashboardService } from '../../../core/services/dashboard';
import { DashboardMetric, DashboardProject } from '../../../core/models/dashboard.model';

@Component({
  selector: 'app-dashbord',
  imports: [RouterLink],
  templateUrl: './dashbord.html',
  styleUrl: './dashbord.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashbord implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly metrics = signal<DashboardMetric[]>([]);
  protected readonly recentProjects = signal<DashboardProject[]>([]);
  protected readonly loading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);

  protected readonly greetingTitle = computed(() => {
    const hour = new Date().getHours();
    let timeGreeting = 'Good morning';
    if (hour >= 12 && hour < 17) {
      timeGreeting = 'Good afternoon';
    } else if (hour >= 17) {
      timeGreeting = 'Good evening';
    }

    const user = this.authService.currentUser();
    const name = user?.name ? user.name.split(' ')[0] : 'Admin';
    return `${timeGreeting}, ${name}`;
  });

  ngOnInit(): void {
    this.loadDashboardData();
  }

  protected loadDashboardData(): void {
    this.loading.set(true);
    this.error.set(null);

    this.dashboardService.getDashboardData().subscribe({
      next: (data) => {
        this.metrics.set(data.metrics);
        this.recentProjects.set(data.recent_projects);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        console.error('Failed to load dashboard data', err);
        this.error.set('Failed to load dashboard data. Please try again.');
        this.loading.set(false);
      },
    });
  }

  protected navigateToProject(projectId: number): void {
    if (projectId) {
      this.router.navigate(['/projects', projectId, 'steps']);
    }
  }
}
