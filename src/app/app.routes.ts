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
        path: 'projects/:projectId/steps/1',
        loadComponent: () =>
          import(
            './features/material-management/ptoject-step/step-01-customer-query/step-01-customer-query'
          ).then((m) => m.Step01CustomerQuery),
      },
      {
        path: 'projects/:projectId/steps/2',
        loadComponent: () =>
          import(
            './features/material-management/ptoject-step/step-02-request-quotation/step-02-request-quotation'
          ).then((m) => m.Step02RequestQuotation),
      },
      {
        path: 'projects/:projectId/steps/3',
        loadComponent: () =>
          import(
            './features/material-management/ptoject-step/step-03-supplier-quotation/step-03-supplier-quotation'
          ).then((m) => m.Step03SupplierQuotation),
      },
      {
        path: 'projects/:projectId/steps/4',
        loadComponent: () =>
          import(
            './features/material-management/ptoject-step/step-04-cost-sheet/step-04-cost-sheet'
          ).then((m) => m.Step04CostSheet),
      },
      {
        path: 'projects/:projectId/steps/5',
        loadComponent: () =>
          import(
            './features/material-management/ptoject-step/step-05-customer-quotation/step-05-customer-quotation'
          ).then((m) => m.Step05CustomerQuotation),
      },
      {
        path: 'projects/:projectId/steps/6',
        loadComponent: () =>
          import(
            './features/material-management/ptoject-step/step-06-tender/step-06-tender'
          ).then((m) => m.Step06Tender),
      },
      {
        path: 'projects/:projectId/steps/7',
        loadComponent: () =>
          import(
            './features/material-management/ptoject-step/step-07-bid-documents/step-07-bid-documents'
          ).then((m) => m.Step07BidDocuments),
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
