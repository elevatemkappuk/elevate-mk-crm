import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AuthService } from '../auth/auth.service';
import { API_CONFIG } from './api-config';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export function clearCsrfToken(): void {
  csrfToken = null;
}

function isApiRequest(url: string, apiBaseUrl: string): boolean {
  return url.startsWith(apiBaseUrl);
}

function isPublicAuthenticationRequest(url: string, apiBaseUrl: string): boolean {
  if (!isApiRequest(url, apiBaseUrl)) {
    return true;
  }

  const path = url.slice(apiBaseUrl.length);
  return [
    '/auth/csrf/',
    '/auth/login/',
    '/auth/password-reset/',
    '/auth/password-reset/confirm/',
  ].some((publicPath) => path === publicPath);
}

function isExpiredSessionResponse(error: HttpErrorResponse): boolean {
  if (error.status === 401) {
    return true;
  }

  if (error.status !== 403 || !error.error || typeof error.error !== 'object') {
    return false;
  }

  return (error.error as Record<string, unknown>)['code'] === 'session_expired';
}

function readCookie(document: Document, name: string): string | null {
  const value = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!value) {
    return null;
  }

  return decodeURIComponent(value.slice(name.length + 1));
}

export const apiCredentialsInterceptor: HttpInterceptorFn = (request, next) => {
  const { apiBaseUrl } = inject(API_CONFIG);

  if (!isApiRequest(request.url, apiBaseUrl)) {
    return next(request);
  }

  return next(request.clone({ withCredentials: true }));
};

export const csrfHeaderInterceptor: HttpInterceptorFn = (request, next) => {
  const { apiBaseUrl } = inject(API_CONFIG);

  if (!isApiRequest(request.url, apiBaseUrl) || !UNSAFE_METHODS.has(request.method)) {
    return next(request);
  }

  const document = inject(DOCUMENT);
  const token = csrfToken ?? readCookie(document, 'csrftoken');

  if (!token || request.headers.has('X-CSRFToken')) {
    return next(request);
  }

  return next(
    request.clone({
      headers: request.headers.set('X-CSRFToken', token),
    }),
  );
};

export const sessionExpiryInterceptor: HttpInterceptorFn = (request, next) => {
  const { apiBaseUrl } = inject(API_CONFIG);
  const auth = inject(AuthService);
  const router = inject(Router, { optional: true });

  if (isPublicAuthenticationRequest(request.url, apiBaseUrl)) {
    return next(request);
  }

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (auth.currentUser() && isExpiredSessionResponse(error)) {
        const shouldRedirect = auth.handleSessionExpired();
        if (shouldRedirect && router && !router.url.startsWith('/login')) {
          void router.navigateByUrl('/login');
        }
      }

      return throwError(() => error);
    }),
  );
};
