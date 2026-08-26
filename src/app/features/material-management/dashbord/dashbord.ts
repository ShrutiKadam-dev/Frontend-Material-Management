import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface DashboardMetric {
  label: string;
  value: string;
  trend: string;
  tone: 'success' | 'warning';
}

interface RecentProject {
  title: string;
  supplier: string;
  customer: string;
  step: string;
  milestone: string;
  progress: number;
  status: 'In Progress' | 'Completed';
}

@Component({
  selector: 'app-dashbord',
  imports: [RouterLink],
  templateUrl: './dashbord.html',
  styleUrl: './dashbord.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashbord {
  protected readonly metrics: DashboardMetric[] = [
    { label: 'Active Projects', value: '3', trend: 'Across 4 suppliers', tone: 'success' },
    { label: 'Completed', value: '1', trend: 'Fully paid & closed', tone: 'success' },
    { label: 'Suppliers', value: '4', trend: 'Foreign & domestic', tone: 'success' },
    { label: 'Customers', value: '4', trend: '2 pending PO', tone: 'warning' },
  ];

  protected readonly recentProjects: RecentProject[] = [
    {
      title: 'Industrial Compressor Supply - Pune Plant',
      supplier: 'Kaeser Kompressoren GmbH',
      customer: 'Bharat Forge Ltd',
      step: 'Step 8 of 15',
      milestone: 'Customer issues Purchase Order (PO)',
      progress: 53,
      status: 'In Progress',
    },
    {
      title: 'Conveyor Belt System - Nagpur Warehouse',
      supplier: 'Continental ContiTech',
      customer: 'DTDC Logistics Pvt Ltd',
      step: 'Step 13 of 15',
      milestone: "S.T. delivers Material to Customer's Place with S.T. Billing",
      progress: 87,
      status: 'In Progress',
    },
    {
      title: 'Cold Storage Refrigeration Units',
      supplier: 'Carrier Transicold',
      customer: 'Godrej Agrovet Ltd',
      step: 'Step 4 of 15',
      milestone: 'Supplier quotation received',
      progress: 20,
      status: 'In Progress',
    },
    {
      title: 'Pallet Racking - Bhiwandi Facility',
      supplier: 'Mecalux S.A.',
      customer: 'Delhivery Ltd',
      step: 'Step 15 of 15',
      milestone: 'Payment settled and project closed',
      progress: 100,
      status: 'Completed',
    },
  ];
}
