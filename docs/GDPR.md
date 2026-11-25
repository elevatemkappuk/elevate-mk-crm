# Elevate MK GDPR — CRM Functional and Technical Implementation Guide

Status: Living Documentation. The backend capability foundation and governance
implementation are source-inspected, with focused isolated PostgreSQL
migration/test validation recorded by the API repository. The latest targeted
Phase 1A.4D CRM privacy consumer is implemented in source. The available
evidence is a successful Angular development build and 12/12
focused API legal-hold tests. Broader Angular/backend suites,
migration/concurrency validation, browser UAT for this remediation, and
cross-repository deployment behavior remain historical or unverified.

## Purpose and boundary

The Angular Staff CRM presents CRM workflows, but Django remains authoritative
for authentication, authorization, privacy protection, and data projections.
Existing CRM roles remain `CRM_ADMIN`, `CRM_MANAGER`, and `CRM_VIEWER`.

The API-owned Phase 1A.4A contract remains authoritative. Phase 1A.4B adds a
CRM-side consumer in `StaffAccessService` and AuthService lifecycle integration;
this guide records source inspection and the supplied focused test/build
evidence, but does not claim runtime or cross-repository verification.

The foundation adds no capability response to `/auth/me/`, no Angular capability
guard, no masking behavior, no Person projection changes, and no new sensitive
data access path. Phase 1A.4A adds the API Staff Access contract, which the
Phase 1A.4B CRM consumer now reads into memory-only presentation state.

## API-authoritative capability foundation

Status: API foundation and governance implementation are source-inspected;
governance migration/test execution is verified in the API's isolated
PostgreSQL validation, while the Phase 1A.4B CRM capability consumer is
source-inspected with focused tests, build, and configuration checks verified;
runtime remains unverified.

The API repository is authoritative for the current seven-capability catalog;
the original six-capability Phase 1A.2 baseline and separately audited
`LEGAL_HOLD_ADMIN` catalogue extension remain distinct. It is authoritative
for role defaults,
evaluator precedence, governance boundary, schema, and indexes. CRM maintains
links to the API's [GDPR guide](../../elevate-mk-api/docs/GDPR.md),
[AUTHORIZATION.md](../../elevate-mk-api/docs/AUTHORIZATION.md), and
[DATABASE.md](../../elevate-mk-api/docs/DATABASE.md) rather than duplicating
those backend contracts. No CRM capability authorization or backend enforcement
is introduced. The API's Staff Access contract remains authoritative; CRM
consumption is implemented as memory-only presentation state and remains
runtime-unverified.

The approved Django superuser authority change is backend-only. Active
superusers may use the API's audited direct governance service path, while
ordinary CRM administrators remain subject to the existing governance rules.
Phase 1A.4D adds capability-aware CRM consumers and the protected legal-hold
route; Django remains the authorization boundary and runtime deployment
compatibility remains unverified.

The API's catalogue extension advances policy version atomically and records
migration provenance without adding a CRM role default. Its historical Person
subject backfill preserves unresolved references without inventing Persons.
The operational Person audit-history contract excludes privacy-domain events;
the dedicated privacy projection remains API-authoritative and requires
backend capability plus Person-scope authorization. The Phase 1A.4D CRM
consumer is documented below; broader record-access auditing remains deferred.

### Phase 1A.4A Staff Access contract (historical; superseded disclosure)

The API now exposes `GET /api/v1/staff/access/me/`. It is a session-only CRM
endpoint admitted for authenticated users with an active `CRM_ADMIN`,
`CRM_MANAGER`, or `CRM_VIEWER` role. Anonymous callers receive `401`, other
authenticated users receive `403`, mobile JWTs are not accepted, and Django
`is_staff` or `is_superuser` alone does not grant admission.

The successful response has exactly two fields:

```json
{
  "capability_codes": [],
  "policy_version": 2
}
```

Historically, the initial CRM capability disclosure allowlist was intentionally
empty before the later approved CRM consumer and disclosure policy. The current
coordinated Phase 1A.4D allowlist is documented below. `policy_version` is informational only; `2` is the verified
current example value, not a fixed contract value, and it is not a grant, token,
or client precondition. The API reads the locked singleton policy state and
performs the effective-access evaluation in one transaction; no policy mutation
is performed. The response is marked `Cache-Control: private, no-store`.

An admitted Django superuser remains subject to the active CRM-role admission
boundary. Its existing audited superuser evaluator path remains in force, but
the empty allowlist means no capability codes are disclosed. Capability-aware
guards and directives remain deferred.

Evidence classification: **API source-inspected; CRM consumer source-inspected;
CRM runtime and cross-repository integration unverified.**
The route, view, serializer, permission, allowlist, transaction, and cache
behavior were inspected in the API repository. The API focused suite passed
34/34 against isolated PostgreSQL database
`test_elevate_gdpr_phase1a4a_20261124`; `manage.py check` passed;
`makemigrations --check --dry-run` reported `No changes detected`;
`migrate --plan` reported no planned migration operations; and `git diff --check`
was clean. No schema or migration files changed or were applied. CRM tests,
builds, and configuration evidence are verified below for Phase 1A.4B; browser
runtime, staging/deployment, and cross-repository behavior remain unverified.

The revised superuser authority was runtime-verified in the API's final
isolated validation: capability foundation 13/13 passed, CRM-admin concurrency
1/1 passed, and the complete focused run passed 41/41. CRM behavior, CRM
capability integration, and cross-repository compatibility remain unverified.

### Phase 1A.4B CRM Staff Access consumer

Status: **Implemented / source-inspected; focused test and build validation
verified; runtime and cross-repository verification not claimed.**

`StaffAccessService` consumes `GET /staff/access/me/` through the configured API
base URL and existing credentialed session HTTP infrastructure. Its typed
projection is:

- `StaffAccessProjection.capability_codes: readonly string[]`
- `StaffAccessProjection.policy_version: number`

Its exposed signal/computed state includes `state`, `status`, `projection`,
`capabilityCodes`, `policyVersion`, and `isReady`. State statuses are `idle`,
`loading`, `ready`, `unauthenticated`, `forbidden`, and `error`. State and
projection objects, capability arrays, and the empty production array are
immutable/frozen in memory.

The production disclosure registry is intentionally empty. Response validation
requires exactly the two expected object keys; capability codes must be
non-empty strings with no duplicates, and every code must be present in the
empty registry. `policy_version` must be a safe non-negative integer. Malformed,
duplicate, unknown, or otherwise invalid responses fail closed: the projection
is cleared, the service enters `error`, and `hasCapability()` returns `false`.

`hasCapability(code)` is a presentation helper only. It does not authorize API
requests, replace backend permission checks, or establish a capability grant.
No capability-aware route guard or directive is implemented by this phase;
future guards/directives and broader UI enforcement remain deferred.

AuthService integration is source-inspected as follows:

- `initialize()` loads `/auth/me/`, then refreshes Staff Access before marking
  authentication initialized.
- `login()` resets expiry state, authenticates, refreshes CSRF, sets the account,
  and refreshes Staff Access.
- `setAuthenticatedUser()` selects the account; account replacement invalidates
  prior Staff Access state and advances its epoch.
- `clearUserState()` clears Staff Access and current-user state.
- `logout()` clears both on success and also clears them when logout fails.
- Session expiry clears Staff Access and CSRF state once; the existing interceptor
  handles `401` and only the explicit session-expired `403` contract. Ordinary
  permission `403` remains a forbidden state and is not treated as expiry.

Refreshes are deduplicated for the same account and epoch. Account replacement,
logout, or invalidation advances the epoch; stale responses and stale errors are
ignored, so they cannot repopulate a newer account's state.

No session identifiers, capability projections, or policy state are written to
`localStorage` or `sessionStorage`; the browser session remains cookie-backed
and the Staff Access projection is memory-only. The API's `private, no-store`
response policy remains authoritative.

Test classification: the Phase 1A.4B service and AuthService specs were
source-inspected and cover the exact empty projection, strict/unknown response
rejection, `401` versus ordinary `403`, concurrent refresh deduplication,
account replacement, logout invalidation, non-CRM admission, initialization,
login/logout integration, expiry handling, and storage non-persistence. Test
execution is **Verified**: the focused Angular command passed 5 files and 38
tests; `npm run build` passed; `npm run test:config` passed 3/3; and
`git diff --check` passed. CRM runtime, staging, deployment, and
cross-repository behavior remain **Unverified**.

## Current Angular architecture and contracts

Existing route, component, session, CSRF, and role-guard behavior remains
unchanged. `AuthService` continues consuming `/auth/me/` and `staff_roles`, and
now coordinates the separate Staff Access projection. CRM UI role checks and
`hasCapability()` remain presentation hints; they do not replace backend
authorization.

The Phase 1A.4B implementation includes `StaffAccessService`, its projection
types/signals, and AuthService lifecycle integration. Mobile JWT authentication,
Community sessions, Community projections, and existing CRM role semantics are
outside this implementation; their cross-repository compatibility is
**Unverified**.

## Phase 1A.4C.3 Staff Privacy Administration

Status: **Implemented / isolated local runtime verified; deployment and
cross-repository production compatibility remain unverified.**

The CRM now contains a separate `/privacy-administration` route and navigation
entry guarded by the backend-projected `STAFF_CAPABILITY_ADMIN` capability. Existing CRM_ADMIN
Administration and import routes remain unchanged. The separate route is
available for eligible delegated CRM staff when the API projects
`STAFF_CAPABILITY_ADMIN`, `PRIVACY_AUDIT_READ`, and `LEGAL_HOLD_ADMIN`; the
API remains authoritative for the disclosure allowlist.

Earlier local validations covered 51 files and 457/457 tests; those counts are
historical. For this remediation, the Angular development build passed; the
full repository-native test count and additional lifecycle regression are not
claimed as current evidence.

`PrivacyAdministrationService` consumes the API governance contracts for safe
Staff directory search, target detail, role-default state, proposal creation,
direct individual mutations and proposal resolution. `PrivacyAdministrationPageComponent`
renders only identifiers, staff-role state, capability assignment/restriction
state and backend-permitted actions. It does not display contact or demographic
fields, store capability data in browser storage, or authorize requests
client-side. Human-readable capability labels/descriptions and the shared
accessible confirmation dialog are used; ordinary individual changes apply immediately,
while `STAFF_CAPABILITY_ADMIN` grant/restore/unrestrict uses proposal flow.
Reasons are collected for each mutation, duplicate pending proposals have a
stable user-facing error, and backend responses remain authoritative for
approval, audit, eligibility and errors.

Role-default management uses the backend's `permitted_actions` projection.
The CRM displays every active canonical CRM role and capability, including
disabled defaults, and offers only the server-provided enable or disable
operation. For ordinary administrators, a submitted role-default change is sent
through the existing proposal endpoint with a mandatory justification and is
clearly shown as awaiting independent approval. An admitted superuser uses the
dedicated direct endpoint instead. Matching pending proposals suppress further
role-default actions; duplicate, stale, rejected, cancelled, expired and
invalidated outcomes remain backend-authoritative and are reported as
operation feedback rather than success.

When the backend marks a permitted action with `DIRECT_SUPERUSER`, the CRM
routes it to the dedicated `/staff/governance/superuser-actions/` endpoint.
The backend remains authoritative for CRM admission, mandatory
justification, transactional auditing and the direct operation result. The
ordinary proposal workflow is not used for these direct actions. A superuser
without an active operational CRM role remains denied.

Individual and role-default changes use the same accessible in-page
confirmation dialog pattern with operation, target, capability, proposed
state, justification, loading, confirm and cancel controls. The CRM does not
reimplement eligibility, separation-of-duty, self-approval, or superuser
rules. The dedicated API superuser route remains the authoritative direct
exception and is not replaced by the ordinary proposal flow.

Permission changes during an active session are handled through the shared
`StaffAccessService`. When a protected governance read returns `403`, the page
immediately clears protected state, invalidates its request epoch, and prevents
stale or in-flight responses from repopulating the directory, target, history,
role-default, and pending-action state. It then refreshes
`GET /staff/access/me/`. If `STAFF_CAPABILITY_ADMIN` is no longer effective, or
the refresh fails, the CRM redirects to the existing `/access-denied` route.
The authenticated session and ordinary CRM functionality remain intact.

This read-side access-loss handling is distinct from action-specific business
denials: mutation errors continue to be presented locally and do not remove
valid governance access merely because an operation such as self-approval is
prohibited. Search loading state is reset on success, failure, and cancellation,
so a failed request can be retried.

The role-default workflow is implemented against the additive API projection:
disabled defaults are visible, only backend-permitted enable/disable actions
are shown, `execution_mode` distinguishes proposals from direct superuser
operations, and target action modes are supplied by the backend. Proposal
actions are limited by the backend-provided actor-specific `permitted_actions`
list.

Isolated local manual acceptance verified the two-browser suspension scenario:
an administrator suspended the viewer's `STAFF_CAPABILITY_ADMIN` grant, the
viewer received `403` from the staff directory request, and the viewer was
redirected to `http://localhost:4200/access-denied` without signing out. The
isolated database was `elevate_gdpr_phase1a4c_manual`. Deployment and
cross-repository compatibility remain **Unverified**.

## Deferred functionality

The following are approved for later stages but are not implemented here:

- broader staff capability management screens and workflows beyond the
  implemented Privacy Administration feature;
- contact masking, demographic restriction and other Person privacy workflows;
- broader capability-consuming UI, additional route guards, or directives;
- contact masking and demographic restrictions;
- Person creation/editing privacy enforcement;
- Person search/filtering, marketing, campaign, and export protection;
- broader privacy-audit and legal-hold workflows beyond the implemented
  Phase 1A.4D consumers;
- broader Phase 1A.4C workflows beyond the separate capability-protected
  administration foundation described above.

Broader capability-consuming UI, masking, and Person user-facing privacy
workflows remain deferred. The Phase 1A.4B memory-only Staff Access integration
and Phase 1A.4D privacy consumers are implemented as documented below; runtime/browser, staging,
deployment, and cross-repository behavior remain **Unverified**.

## Evidence status

- **Approved:** CRM remains a permission-aware client of backend-authoritative
  contracts.
- **Implemented / Source-inspected:** the existing API capability foundation,
  the historical Phase 1A.4A Staff Access contract, the implemented Phase 1A.4B
  `StaffAccessService`, projection types/signals, AuthService lifecycle
  integration, and the Phase 1A.4C.3 privacy-administration route, service,
  guard, page and safe-presentation contracts; backend authorization remains
  authoritative.
- **Source-inspected / Source-confirmed:** CRM `/auth/me/`, `staff_roles`,
  session, CSRF, role-guard conventions, `StaffAccessService`, access types,
  AuthService lifecycle integration, and interceptors were inspected in
  `src/app/core/auth/`, `src/app/core/http/`, and the API contract sources.
- **Verified elsewhere:** the API Phase 1A.4A focused suite passed 34/34 against
  isolated PostgreSQL database `test_elevate_gdpr_phase1a4a_20261124`;
  `manage.py check` passed; `makemigrations --check --dry-run` reported `No
  changes detected`; `migrate --plan` reported no planned migration operations;
  and `git diff --check` was clean. No schema or migration files changed or were
  applied.
- **Verified:** Phase 1A.4B focused Angular validation passed 5 files and 38
  tests; the historical CRM validation passed 51 files and 454/454 tests;
  the historical repository-native Angular validation passed 51 files and
  457/457 tests;
  the role-default UI changes were included in that run; `npm run build` passed;
  `npm run test:config` passed 3/3; and
  `git diff --check` passed.
- **Verified / isolated local runtime:** `http://localhost:4200` consumed the
  isolated API projection; a synthetic delegated manager reached
  `/privacy-administration`, an explicitly restricted synthetic account failed
  closed at `/access-denied`, and Chromium verified the live Staff directory
  search against `http://localhost:8000` using the isolated database, returning
  a synthetic Staff result with the search control re-enabled. The governance
  page also supported target loading and an ordinary audited mutation. A
  subsequent two-browser suspension test verified authorization-loss refresh,
  protected-state clearing, and redirect to `/access-denied` while preserving
  the viewer's authenticated session. The isolated database was
  `elevate_gdpr_phase1a4c_manual`; no credentials are stored here.
- **Unverified:** Mobile and Community compatibility, deployment behavior, and
  production/staging cross-repository runtime behavior.
- **Verified elsewhere:** prior isolated local API governance migration, schema
  and focused PostgreSQL test evidence is recorded in the API repository's [GDPR guide](../../elevate-mk-api/docs/GDPR.md).
  The latest authorized API validation passed 69/69 focused tests and 9/9
  remediation tests, including synthetic subject/catalogue verification. This
  does not verify CRM, Mobile, or
  Community runtime compatibility.
- **Planned:** later capability-aware guards/directives, broader UI enforcement,
  and user-facing privacy workflows.
- **Implemented:** the CRM capability disclosure allowlist exposes
  `STAFF_CAPABILITY_ADMIN`, `PRIVACY_AUDIT_READ`, and `LEGAL_HOLD_ADMIN` for
  the coordinated Phase 1A.4D rollout; other capability consumers remain
  deferred.
- **Unverified:** Mobile and Community compatibility, deployment behavior, and
  runtime behavior after future capability-aware UI integration.
- **Verified (Phase 1A.4D.4 targeted evidence):** the affected Angular
  component specifications passed 120/120, the production build passed, the
  focused API legal-hold suite passed 12/12, the focused PostgreSQL concurrency
  suite passed 4/4, the Django system check and migration-drift check passed,
  and live API/CRM probes returned expected UAT responses. The complete
  repository-wide suites, operational migration application, and browser
  workflow retest remain unverified for this remediation.

Detailed backend schemas and evaluator rules are maintained in the API
repository's [GDPR guide](../../elevate-mk-api/docs/GDPR.md),
[DATABASE.md](../../elevate-mk-api/docs/DATABASE.md), and
[AUTHORIZATION.md](../../elevate-mk-api/docs/AUTHORIZATION.md).

## Phase 1A.3 status

This CRM repository has no Phase 1A.3 application change. The API-only
privacy-audit foundation is **Implemented and verified in the API's isolated
PostgreSQL validation**, but remains **Unverified from the CRM runtime
perspective**. It introduces separate operational and
privacy audit domains, normalized Person associations, `LEGAL_HOLD_ADMIN`,
versioned retention policy records, legal holds, and a non-destructive dry-run
evaluator. No CRM route, Angular service, interface, guard, state store, or
response contract was added.

The API remains authoritative for authorization, masking, privacy projections,
retention, and legal-hold behavior. CRM integration, privacy-audit history
presentation, capability management, active-session refresh, and later
Person/search/campaign/export enforcement remain **Planned/Deferred**. The
provisional 24-month retention period is subject to formal legal/privacy
approval; no disposal is enabled. Earlier 19/19, 41/41, and 102/102 results
remain historical evidence in the API guide. API evidence is not CRM or
cross-repository runtime evidence; the current CRM test and build evidence is
recorded above.

### Mandatory access-control acceptance checklist

- Least privilege: **Implemented; runtime verified through backend action modes.**
- Deny by default: **Implemented; runtime verified through protected routes.**
- Backend-authoritative authorization: **Implemented; runtime verified by API/UI
  contract tests.**
- Resource scope and safe projections: **Implemented; runtime verified in API
  projections, with cross-repository deployment still unverified.**
- Horizontal escalation prevention: **Implemented; partially runtime verified.**
- Vertical escalation prevention: **Implemented; partially runtime verified.**
- Authorization revocation: **Implemented; runtime verified in focused CRM
  lifecycle coverage.**
- Security-sensitive authorization-failure logging: **Implemented in the API;
  CRM/browser-runtime verification for this closure batch remains unverified.**
- Privileged-operation auditing: **Implemented; backend runtime evidence exists.**
- Functional access-control regression testing: **Partially verified; 12/12
  focused API tests, 4/4 focused PostgreSQL concurrency tests, and 120/120
  affected Angular component tests passed. Legal-holds-specific component
  coverage, repository-wide suites, and adversarial negative projections remain
  unverified.**
- OWASP review: **Implemented review gate; independent runtime security evidence
  remains unverified.**

### Final Phase 1A.4C closure-batch presentation

The CRM governance page renders backend-projected effective capability state,
including whether a capability is effective, its source (role default,
individual grant, explicit restriction, suspended/revoked assignment or
superuser bypass), the backend reason, and any pending change. Pending
proposals are never treated as effective permissions.

Revoked assignments remain visible as historical state, are not effective, and
may be granted again through the backend-permitted `INDIVIDUAL_GRANT` action;
the revoked record is not silently deleted or reactivated.

Governance history is presented as one de-duplicated safe view with a
human-readable operation and capability, target, actor, timestamp, outcome,
reason, proposal/decision status, and before/resulting state where supplied by
the API. Direct audited superuser operations are visibly marked. The CRM does
not consume unrestricted AuditEvent metadata and does not calculate authority
locally.

The API records applicable governance authorization denials with safe opaque
references, safe reason codes, and route-specific operation labels. The CRM
preserves the existing authorization error and access-loss handling. Browser
workflow and deployment behavior remain unverified.

### Phase 1A.4D frontend implementation

The CRM now has typed `PrivacyAuditService` and `LegalHoldsService` consumers,
a separate Privacy audit tab on Person profiles, and a capability-guarded
`/legal-holds` route. The operational History tab remains unchanged.

`PRIVACY_AUDIT_READ` and `LEGAL_HOLD_ADMIN` are independent capabilities. The
CRM validates both codes strictly, stores the projection in memory only, and
uses backend-provided permitted actions and execution modes. It does not infer
authority from roles or superuser state.

Privacy history supports pagination and bounded date, activity, outcome, and
superuser-operation filters. Legal Holds supports person and opaque event
targets, active/released holds, pending/approved/rejected requests, ordinary
release requests, approval, rejection, and direct superuser release.

When either capability is revoked, the corresponding protected state and open
dialog are cleared and stale responses are ignored. Ordinary CRM access is
preserved. Sensitive data is not written to browser storage.

Legal-hold list/detail responses include backend-projected release-request
summaries. An independent authorized administrator can discover pending
requests after login or refresh and approve or reject them from the relevant
hold without manually entering an internal request ID. Self-approval controls
remain backend-calculated; the CRM only renders permitted actions.

Status: **Implemented / isolated validation and manual UAT verified; operational
deployment unverified**. Older CRM
clients must not consume the expanded API capability disclosure until this
frontend version is deployed in the coordinated rollout.

Phase 1A.4D.4 remediation adds a permission-aware searchable Person selector
for Person-wide holds, contextual navigation from an authorized Person profile,
and contextual event-hold navigation from privacy-audit rows only when the
backend supplies an opaque reference and `place_event_hold` action. The
dedicated page retains the opaque-reference workflow without exposing event
discovery to users who lack `PRIVACY_AUDIT_READ`. Hold and release history now
uses safe actor and Person names, timestamps, reasons, decision state, and
decision actors. Pending release requests no longer show the duplicate request
action. Privacy filters use controlled activity and outcome values supported by
the current API projection. The complete Phase 1A.4D isolated manual UAT is
accepted for the API/CRM workflow. Minor UX polish remains deferred as
non-blocking backlog work; operational migrations, deployment, cross-repository
release compatibility, and final-hardening evidence remain outstanding.

## Phase 1A.4E and 1A.6 consolidated status

Status: **Implemented / source-inspected; final automated hardening deferred.**
The CRM continues to consume backend-calculated capability state, permitted
actions, privacy projections, and revocation behavior through the accepted
Django session-authenticated API contracts. Mobile JWT authentication remains
outside Staff CRM routes; no duplicate frontend authorization system was added.

Phase 1A.5 legacy reconciliation is explicitly skipped because the current
dataset is test data. No CRM reconciliation UI, dashboard, or remediation flow
was added. Minor UX polish remains a non-blocking backlog item. Automated tests,
cross-repository deployment verification, and final hardening remain unverified
until the consolidated GDPR hardening stage.

The unresolved API security and governance obligations (AUTH-001, AUTH-002,
GOV-003, GOV-005, uncovered GOV-006 paths, and trusted-provenance verification)
are carried into GDPR Phase 1C final hardening and are not risk-accepted here.
Independent specialist acceptance was incomplete because the active agent-thread
limit prevented the remaining delegations. All implementation-stage regression
tests remain **Implemented / Unexecuted**. Production activation still requires
the final security, QA, architecture and documentation gates plus runtime and
deployment verification.
