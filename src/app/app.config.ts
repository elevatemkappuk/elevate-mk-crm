import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { environment } from '../environments/environment';
import { AuthService } from './core/auth/auth.service';
import {
  apiCredentialsInterceptor,
  csrfHeaderInterceptor,
} from './core/http/auth-http.interceptors';
import { API_CONFIG } from './core/http/api-config';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([apiCredentialsInterceptor, csrfHeaderInterceptor])),
    {
      provide: API_CONFIG,
      useValue: environment,
    },
    provideAppInitializer(() => inject(AuthService).initialize()),
  ]
};
