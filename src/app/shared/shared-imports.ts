import { ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';

export const AUTH_FORM_IMPORTS = [
  ButtonModule,
  IconFieldModule,
  InputIconModule,
  InputTextModule,
  ReactiveFormsModule,
] as const;
