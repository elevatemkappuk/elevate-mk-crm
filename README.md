# Elevate MK Staff CRM

Minimal Angular foundation for the Elevate MK staff-facing CRM, backed by the Django session-authentication API at `http://localhost:8000/api/v1`.

## Local development

Run the frontend:

```bash
npm start
```

The Angular app serves at `http://localhost:4200/`.

## API base URL

The backend base URL is configured in:

- `src/environments/environment.ts`
- `src/environments/environment.development.ts`

Current local value:

```ts
http://localhost:8000/api/v1
```

Change that value per environment rather than hard-coding endpoint URLs in components or services.

## Authentication flow

This frontend uses Django server-side sessions, not JWT.

1. On app startup, `AuthService.initialize()` calls `GET /auth/me/`.
2. A `200` restores the authenticated user into client state.
3. A `401` marks the client unauthenticated without redirect loops.
4. Before login, the client calls `GET /auth/csrf/` to force Django to issue the `csrftoken` cookie.
5. Unsafe API requests send `X-CSRFToken` from the current `csrftoken` cookie and always use `withCredentials: true`.
6. Successful login creates the normal Django `sessionid` cookie.
7. Logout clears the server session and client auth state.

The frontend never stores `sessionid` manually in `localStorage` or `sessionStorage`.

## Staff access rules

Authenticated access to the CRM shell requires one of these backend role codes:

- `CRM_ADMIN`
- `CRM_MANAGER`
- `CRM_VIEWER`

Authenticated users without one of those roles are redirected to `/access-denied`.

## Expected backend browser configuration

For browser testing from `http://localhost:4200` to `http://localhost:8000`, the Django API still needs:

- CORS configured to allow the exact origin `http://localhost:4200`
- credentialed cross-origin requests enabled
- `CSRF_TRUSTED_ORIGINS` including `http://localhost:4200`
- session and CSRF cookies left compatible with the local cookie-based flow

This frontend does not change backend CORS or CSRF settings.

## Quality checks

Run tests:

```bash
npm test -- --watch=false
```

Run a production build:

```bash
npm run build
```
