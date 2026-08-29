import { DOCUMENT } from '@angular/common';
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { API_CONFIG } from './api-config';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isApiRequest(url: string, apiBaseUrl: string): boolean {
  return url.startsWith(apiBaseUrl);
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
  const csrfToken = readCookie(document, 'csrftoken');

  if (!csrfToken || request.headers.has('X-CSRFToken')) {
    return next(request);
  }

  return next(
    request.clone({
      headers: request.headers.set('X-CSRFToken', csrfToken),
    }),
  );
};
