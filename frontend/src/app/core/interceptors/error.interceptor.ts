import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiErrorInfo } from '../models/models';
import { AuthService } from '../services/auth.service';

export function toApiError(err: HttpErrorResponse): ApiErrorInfo {
  if (err.status === 0) {
    return { status: 0, code: 'NETWORK_ERROR', message: `Cannot reach the server. Make sure the backend is running at ${environment.apiUrl}.` };
  }
  const body = err.error;
  if (body && typeof body === 'object' && 'error' in body && body.error) {
    return { status: err.status, code: body.error.code, message: body.error.message, details: body.error.details };
  }
  if (err.status === 429) return { status: 429, code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment and try again.' };
  return { status: err.status, code: `HTTP_${err.status}`, message: err.status >= 500 ? 'The server had a problem. Please try again shortly.' : err.message };
}

/** Normalises every HTTP error into ApiErrorInfo and handles expired/revoked sessions. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const info = toApiError(err);
      const isLogin = req.url.endsWith('/auth/login') || req.url.endsWith('/auth/change-password');
      if (info.status === 401 && req.url.startsWith(environment.apiUrl) && !isLogin && req.headers.has('Authorization')) {
        auth.handleUnauthorized(info.code === 'TOKEN_EXPIRED' ? 'Your session has expired. Please log in again.' : 'Please log in again to continue.');
      }
      return throwError(() => info);
    })
  );
};
