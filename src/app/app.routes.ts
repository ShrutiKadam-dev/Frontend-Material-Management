import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { MainLayout } from './core/layout/main-layout/main-layout';

export const routes: Routes = [
  {
    path: 'auth',
    canActivate: [guestGuard],
    canActivateChild: [guestGuard],
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/material-management/dashbord/dashbord').then((m) => m.Dashbord),
      },
      {
        path: 'projects',
        loadComponent: () =>
          import('./features/material-management/projects/projects').then((m) => m.Projects),
      },
      {
        path: 'projects/:projectId/steps',
        loadComponent: () =>
          import('./features/material-management/projects/project-timeline/project-timeline').then(
            (m) => m.ProjectTimeline,
          ),
      },
      {
        path: 'projects/:projectId/step-form/:stepId',
        loadComponent: () =>
          import('./features/material-management/dynamic-step/dynamic-step-form').then(
            (m) => m.DynamicStepForm,
          ),
      },
      {
        path: 'projects/:projectId/forms/:formCode',
        loadComponent: () =>
          import('./features/material-management/dynamic-step/dynamic-step-form').then(
            (m) => m.DynamicStepForm,
          ),
      },
      {
        path: 'customers',
        loadComponent: () =>
          import('./features/material-management/customer/customer').then((m) => m.Customer),
      },
      {
        path: 'suppliers',
        loadComponent: () =>
          import('./features/material-management/suppliers/suppliers').then((m) => m.Suppliers),
      }
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
