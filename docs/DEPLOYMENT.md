# Railway deployment

The CRM is an Angular 21 browser application. It does not define an Angular
SSR/server target, so Railway should build the browser bundle and serve the
static files with `serve`.

Configure the Railway service root as `elevate-mk-crm`.

```text
Staging Build Command: npm run build:staging
Production Build Command: npm run build:production
Start Command: npm run start:railway
```

Angular file replacements select the staging or production environment during
the build. `start:railway` serves `dist/elevate-mk-crm/browser` as a single-page
application and binds to Railway's dynamic `PORT` on `0.0.0.0`.

The API URL is selected from the tracked Angular environment files:

| Frontend environment | API base URL |
| --- | --- |
| Staging | `https://elevate-mk-api-staging.up.railway.app/api/v1` |
| Production | `https://elevate-mk-api-production.up.railway.app/api/v1` |

The source environment file keeps the local development API URL. No frontend
`API_BASE_URL` Railway variable is required.

The existing HTTP interceptors send `withCredentials: true` for API requests,
which is required for Django session cookies. Unsafe requests also copy the
`csrftoken` cookie into `X-CSRFToken`; the initial CSRF bootstrap request uses
the same credentialed API path.

After the frontend domains are known, set the matching values on the backend
Railway environment:

```text
CORS_ALLOWED_ORIGINS=https://<crm-staging-domain>
CSRF_TRUSTED_ORIGINS=https://<crm-staging-domain>
CRM_FRONTEND_URL=https://<crm-staging-domain>
```

Use the production frontend domain in the production backend environment.
Keep the backend API's `ALLOWED_HOSTS` set to its own Railway API hostname;
frontend domains belong in CORS and CSRF configuration. Backend
`DJANGO_DEBUG=False`, `SECURE_SSL_REDIRECT=True`, and the Railway proxy HTTPS
header settings should remain enabled for both environments.

Run the staging or production build locally to validate the selected
environment configuration before deploying.
