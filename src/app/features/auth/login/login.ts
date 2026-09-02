import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';

import { AuthService } from '../../../core/services/auth';
import { AUTH_FORM_IMPORTS } from '../../../shared/shared-imports';

@Component({
  selector: 'app-login',
  imports: [...AUTH_FORM_IMPORTS],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly authService = inject(AuthService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly isSubmitting = signal(false);
  protected readonly passwordVisible = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';

    this.authService
      .login(this.form.getRawValue())
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => this.router.navigateByUrl(returnUrl),
        error: (err: unknown) => {
          if (err instanceof HttpErrorResponse) {
            const message: unknown = (err.error as { message?: unknown })?.message;
            this.errorMessage.set(
              typeof message === 'string' && message
                ? message
                : 'Invalid email or password. Please try again.',
            );
          } else {
            this.errorMessage.set('An unexpected error occurred. Please try again later.');
          }
        },
      });
  }

  protected togglePasswordVisibility(): void {
    this.passwordVisible.update((isVisible) => !isVisible);
  }
}
