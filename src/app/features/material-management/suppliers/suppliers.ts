import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

interface EntityProject {
  title: string;
  step: number;
}

interface SupplierRecord {
  name: string;
  email: string;
  contact: string;
  address: string;
  projects: EntityProject[];
}

@Component({
  selector: 'app-suppliers',
  imports: [ButtonModule, RouterLink],
  templateUrl: './suppliers.html',
  styleUrl: './suppliers.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Suppliers {
  protected readonly suppliers: SupplierRecord[] = [
    {
      name: 'Kaeser Kompressoren GmbH',
      email: 'sales@kaeser.com',
      contact: '+49 9561 6400',
      address: 'Coburg, Germany',
      projects: [{ title: 'Industrial Compressor Supply - Pune Plant', step: 8 }],
    },
    {
      name: 'Continental ContiTech',
      email: 'exports@contitech.com',
      contact: '+49 511 93801',
      address: 'Hanover, Germany',
      projects: [{ title: 'Conveyor Belt System - Nagpur Warehouse', step: 13 }],
    },
    {
      name: 'Carrier Transicold',
      email: 'coldchain@carrier.com',
      contact: '+1 800 227 7437',
      address: 'Athens, USA',
      projects: [{ title: 'Cold Storage Refrigeration Units', step: 3 }],
    },
    {
      name: 'Mecalux S.A.',
      email: 'projects@mecalux.com',
      contact: '+34 932 616 902',
      address: 'Barcelona, Spain',
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
