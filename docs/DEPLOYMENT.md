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

Railway watches `staging` for the staging service and `master` for the
production service; Wait for CI is enabled for the Railway deployments.

This GitHub Action does not deploy to Railway, install Playwright browsers, or
run the staging Playwright tests.

## Branch strategy and promotion

Use feature branches for work in progress, `staging` as the release candidate,
and `master` for production-ready code:

```text
feature/* -> PR to staging -> Frontend validation -> squash merge
staging   -> Railway staging -> deployment_status -> Staging E2E
staging   -> PR to master  -> Frontend validation -> merge commit
master    -> Railway production
```

Use Squash merge for feature-to-`staging` pull requests. Use a Merge commit for
`staging`-to-`master` promotion so the already validated staging commit
identities are preserved; squashing that promotion would create new commit
identities and make promoted commits appear again in later promotion requests.

Both `staging` and `master` are protected. They require a pull request, zero
required approvals, resolved conversations, and the `Frontend validation`
check. Force pushes and branch deletion are blocked. `master` also requires an
up-to-date branch before merging. The merge method described above is the
operational convention; this repository does not claim GitHub enforces that
only `staging` may target `master`.

## Post-deployment staging validation

After the Railway staging deployment succeeds, `.github/workflows/staging-e2e.yml`
checks out the exact deployed SHA and runs the four Playwright smoke tests:

```text
Railway staging success -> Staging E2E -> 4 Playwright smoke tests
```

The workflow runs only for the verified Railway environment
`positive-embrace / staging` and targets
`https://elevate-mk-crm-staging.up.railway.app`. It requires the GitHub secrets
`E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD`; production deployments are
deliberately excluded. Failed runs retain the `playwright-report` and
`test-results` artifacts in GitHub Actions for five days.

The workflow is intentionally staging-only: production events use
`positive-embrace / production` and are skipped, and the URL guard refuses any
target other than the exact staging URL. The deployed revision is checked out
from `github.event.deployment.sha`, rather than from the current `staging` HEAD.

After merging to `staging`, verify that the Frontend validation push run passes,
Railway waits for CI and deploys successfully, and a `Staging E2E` run appears
from the Railway deployment event (typically shown as created by
`railway-app`). A successful run reports four passing tests. Non-successful or
non-staging deployment events are expected to be skipped.

## Local staging Playwright testing (Git Bash)

Use a dedicated staging-only `CRM_ADMIN` account. Do not run the suite against
production because it creates and archives a synthetic Contact.

```bash
export PLAYWRIGHT_BASE_URL="https://elevate-mk-crm-staging.up.railway.app"
export E2E_ADMIN_EMAIL="YOUR_STAGING_E2E_EMAIL"
export E2E_ADMIN_PASSWORD="YOUR_STAGING_E2E_PASSWORD"

npx playwright install chromium
npx playwright test
```

Useful variants:

```bash
PWDEBUG=1 npx playwright test
npx playwright test --list
npx playwright test e2e/auth-dashboard.smoke.spec.ts
npx playwright test --headed
```

Git Bash uses `export`, rather than PowerShell's `$env:` syntax. These values
apply only to the current Git Bash session unless persisted separately. Always
check `PLAYWRIGHT_BASE_URL` before running.

## Troubleshooting

- Missing `E2E_ADMIN_EMAIL` or `E2E_ADMIN_PASSWORD`: configure the staging
  GitHub Environment or local Git Bash variables.
- Wrong `PLAYWRIGHT_BASE_URL`: set the exact staging URL before running; the CI
  guard rejects other targets.
- Chromium missing locally: run `npx playwright install chromium`.
- A test interrupted after Contact creation: manually archive or remove the
  clearly synthetic E2E record.
- `Staging E2E` skipped: confirm the deployment status is successful and the
  environment is exactly `positive-embrace / staging`.
- Railway waiting for CI: check that the push-side `Frontend validation` run
  for the staging commit has completed successfully.

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
 tt
