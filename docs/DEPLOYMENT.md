# Railway deployment

The CRM is an Angular 21 browser application. It does not define an Angular
SSR/server target, so Railway should build the browser bundle and serve the
static files with `serve`.

Configure the Railway service root as `elevate-mk-crm`.

Before a branch is deployed, GitHub Actions runs the `Frontend validation`
workflow from `.github/workflows/frontend-validation.yml`. It performs the
following checks:

1. Installs the lockfile-defined dependencies with `npm ci`.
2. Runs the full Angular test suite with `npm test -- --watch=false`.
3. Builds the production application with `npm run build`.
4. Validates Playwright test discovery with `npx playwright test --list`.

The workflow runs for pull requests targeting `staging` or `master`, and again
after pushes to either branch. The branch-to-Railway mapping is:

| Git branch | Railway frontend service |
| --- | --- |
| `staging` | `elevate-mk-crm` |
| `master` | `elevate-mk-crm-prod` |

This GitHub Action does not deploy to Railway, install Playwright browsers, or
run the staging Playwright tests.

## Railway deployment event inspection

The temporary `Inspect Railway deployment event` workflow in
`.github/workflows/inspect-railway-deployment.yml` listens for
`deployment_status` events and reports only successful deployments whose
environment is `staging`. It prints the deployment state, environment, ref,
commit SHA, environment URL, deployment ID, and status ID. It does not check
out code, install dependencies, call Railway, run Playwright, or modify the
application.

To verify the payload, merge the workflow to the repository default branch,
push a harmless commit to `staging`, and wait for Frontend validation and the
Railway staging deployment to complete. Then inspect the workflow run and
confirm that the reported environment is `staging` and that the reported SHA
matches the commit shown in Railway's staging deployment history. Production
deployments must not satisfy the workflow condition.

```text
Build Command: npm run build:railway
Start Command: npm run start:railway
```

`build:railway` requires `API_BASE_URL` and writes it into the compiled
environment configuration before running the production Angular build.
`start:railway` serves `dist/elevate-mk-crm/browser` as a single-page
application and binds to Railway's dynamic `PORT` on `0.0.0.0`.

Set one `API_BASE_URL` variable per Railway environment:

| Frontend environment | `API_BASE_URL` |
| --- | --- |
| Staging | `https://elevate-mk-api-staging.up.railway.app/api/v1` |
| Production | `https://elevate-mk-api-production.up.railway.app/api/v1` |

The same frontend commit and Railway build/start configuration can be deployed
to both environments; only `API_BASE_URL` changes. The local source environment
file remains configured for local development.

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

Run `npm run test:config` to validate the generator before deploying.
