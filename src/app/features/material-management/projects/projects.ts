import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';

interface ProjectSummary {
  title: string;
  supplier: string;
  customer: string;
  step: number;
  milestone: string;
}

@Component({
  selector: 'app-projects',
  imports: [ButtonModule],
  templateUrl: './projects.html',
  styleUrl: './projects.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Projects {
  protected readonly projects: ProjectSummary[] = [
    {
      title: 'Industrial Compressor Supply - Pune Plant',
      supplier: 'Kaeser Kompressoren GmbH',
      customer: 'Bharat Forge Ltd',
      step: 8,
      milestone: 'Customer issues Purchase Order (PO)',
    },
    {
      title: 'Conveyor Belt System - Nagpur Warehouse',
      supplier: 'Continental ContiTech',
      customer: 'DTDC Logistics Pvt Ltd',
      step: 13,
      milestone: "S.T. delivers Material to Customer's Place with S.T. Billing",
    },
    {
      title: 'Cold Storage Refrigeration Units',
      supplier: 'Carrier Transicold',
      customer: 'Godrej Agrovet Ltd',
      step: 3,
      milestone: "Supplier's Quotation",
    },
    {
      title: 'Pallet Racking - Bhiwandi Facility',
      supplier: 'Mecalux S.A.',
      customer: 'Delhivery Ltd',
      step: 15,
      milestone: 'S.T. makes Payment to Partner / Supplier',
    },
  ];

  protected progressPercent(step: number): number {
    return Math.round((step / 15) * 100);
  }
}
