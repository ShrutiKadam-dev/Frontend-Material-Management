import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';

interface EntityProject {
  title: string;
  step: number;
}

interface CustomerRecord {
  name: string;
  email: string;
  contact: string;
  address: string;
  projects: EntityProject[];
}

@Component({
  selector: 'app-customer',
  imports: [ButtonModule, IconFieldModule, InputIconModule, InputTextModule, RouterLink],
  templateUrl: './customer.html',
  styleUrl: './customer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Customer {
  protected readonly customers: CustomerRecord[] = [
    {
      name: 'Bharat Forge Ltd',
      email: 'purchase@bharatforge.com',
      contact: '+91 20 6704 2476',
      address: 'Pune, India',
      projects: [{ title: 'Industrial Compressor Supply - Pune Plant', step: 8 }],
    },
    {
      name: 'DTDC Logistics Pvt Ltd',
      email: 'warehouse.ops@dtdc.com',
      contact: '+91 80 2536 5050',
      address: 'Bengaluru, India',
      projects: [{ title: 'Conveyor Belt System - Nagpur Warehouse', step: 13 }],
    },
    {
      name: 'Godrej Agrovet Ltd',
      email: 'coldchain@godrejagrovet.com',
      contact: '+91 22 2518 8010',
      address: 'Mumbai, India',
      projects: [{ title: 'Cold Storage Refrigeration Units', step: 3 }],
    },
    {
      name: 'Delhivery Ltd',
      email: 'procurement@delhivery.com',
      contact: '+91 124 671 9500',
      address: 'Gurugram, India',
      projects: [{ title: 'Pallet Racking - Bhiwandi Facility', step: 15 }],
    },
  ];

  protected initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }
}
