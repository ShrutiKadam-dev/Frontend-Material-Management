import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { MainLayout } from './core/layout/main-layout/main-layout';

const ENABLE_AUTH_GUARD = false;

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: '',
    component: MainLayout,
    canActivate: ENABLE_AUTH_GUARD ? [authGuard] : [],
    canActivateChild: ENABLE_AUTH_GUARD ? [authGuard] : [],
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
        path: 'customers',
        loadComponent: () =>
          import('./features/material-management/customer/customer').then((m) => m.Customer),
      },
      {
        path: 'suppliers',
        loadComponent: () =>
          import('./features/material-management/suppliers/suppliers').then((m) => m.Suppliers),
      },
      {
        path: 'project-steps/:stepId',
        loadComponent: () =>
          import('./features/material-management/ptoject-step/step-detail/step-detail').then(
            (m) => m.StepDetail,
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
