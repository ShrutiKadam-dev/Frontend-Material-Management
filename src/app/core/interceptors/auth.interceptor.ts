import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from '../services/auth';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const token = authService.accessToken();

  // Skip adding auth header for the refresh endpoint itself to avoid loops
  const isRefreshRequest = request.url.includes('/api/v1/auth/refresh');

  const authorizedRequest =
    token && !isRefreshRequest
      ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : request;

  return next(authorizedRequest).pipe(
    catchError((error: unknown) => {
      // If 401 and we have a refresh token, attempt a silent refresh and retry once
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !isRefreshRequest &&
        authService.refreshTokenValue()
      ) {
        return authService.refreshToken().pipe(
          switchMap((newAccessToken) => {
            // Retry the original request with the new access token
            const retried = request.clone({
              setHeaders: { Authorization: `Bearer ${newAccessToken}` },
            });
            return next(retried);
          }),
          catchError((refreshError: unknown) => {
            // Refresh also failed — log out the user
            authService.logout();
            return throwError(() => refreshError);
          }),
        );
      }

      return throwError(() => error);
    }),
  );
};
