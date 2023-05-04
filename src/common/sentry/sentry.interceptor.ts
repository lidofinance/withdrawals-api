import { ExecutionContext, Injectable, NestInterceptor, CallHandler } from '@nestjs/common';
import { Observable, catchError, throwError } from 'rxjs';
import * as Sentry from '@sentry/core';

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        if ('status' in error && error.status >= 400 && error.status <= 499) {
          return throwError(() => error);
        }

        Sentry.captureException(error);
        return throwError(() => error);
      }),
    );
  }
}
