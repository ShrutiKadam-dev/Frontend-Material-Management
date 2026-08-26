import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        console.error('HTTP request failed', {
          status: error.status,
          url: error.url,
          message: error.message,
        });
      }

      return throwError(() => error);
    }),
  );
};
