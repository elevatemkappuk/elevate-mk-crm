# Elevate MK GDPR — CRM Functional and Technical Implementation Guide

Status: Living Documentation. The backend capability foundation and governance
implementation are source-inspected, with focused isolated PostgreSQL
migration/test validation recorded by the API repository. The latest targeted
Phase 1A.4A contract is API-only and CRM integration remains unverified.
CRM scope remains documentation-only and no CRM application
changes are included in this stage.

## Purpose and boundary

The Angular Staff CRM presents CRM workflows, but Django remains authoritative
for authentication, authorization, privacy protection, and data projections.
Existing CRM roles remain `CRM_ADMIN`, `CRM_MANAGER`, and `CRM_VIEWER`.

This CRM work is documentation-only: no CRM application source, CRM-side API
consumer contract, tests, or runtime behavior are changed or validated by this
stage. The API-owned Phase 1A.4A contract is documented below; it is not
implemented or consumed in this CRM repository.

The foundation adds no capability response to `/auth/me/`, no Angular capability
guard, no masking behavior, no Person projection changes, and no new sensitive
data access path. Phase 1A.4A adds an API-only Staff Access contract, but the CRM
does not consume it yet.

## API-authoritative capability foundation

Status: API foundation and governance implementation are source-inspected;
governance migration/test execution is verified in the API's isolated
PostgreSQL validation, while CRM capability integration remains Planned and
Unverified.

The API repository is authoritative for the current seven-capability catalog;
the original six-capability Phase 1A.2 baseline and separately audited
`LEGAL_HOLD_ADMIN` catalogue extension remain distinct. It is authoritative
for role defaults,
evaluator precedence, governance boundary, schema, and indexes. CRM maintains
links to the API's [GDPR guide](../../elevate-mk-api/docs/GDPR.md),
[AUTHORIZATION.md](../../elevate-mk-api/docs/AUTHORIZATION.md), and
[DATABASE.md](../../elevate-mk-api/docs/DATABASE.md) rather than duplicating
those backend contracts. No CRM capability projection, UI, or enforcement
integration is included. The API's new Staff Access contract is authoritative,
but CRM consumption remains deferred and unverified.

The approved Django superuser authority change is backend-only. Active
superusers may use the API's audited direct governance service path, while
ordinary CRM administrators remain subject to the existing governance rules.
No CRM UI, route, permission guard, or capability disclosure consumer was added;
runtime compatibility remains unverified.

The API's catalogue extension advances policy version atomically and records
migration provenance without adding a CRM role default. Its historical Person
subject backfill preserves unresolved references without inventing Persons.
The operational Person audit-history contract excludes privacy-domain events;
the dedicated privacy projection remains API-only and requires backend
capability plus Person-scope authorization. No CRM privacy-audit route or
projection is exposed.

### Phase 1A.4A Staff Access contract

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

The initial CRM capability disclosure allowlist is intentionally empty to avoid
exposing capability decisions before a later approved CRM consumer and disclosure
policy exist. `policy_version` is informational only; `2` is the verified
current example value, not a fixed contract value, and it is not a grant, token,
or client precondition. The API reads the locked singleton policy state and
performs the effective-access evaluation in one transaction; no policy mutation
is performed. The response is marked `Cache-Control: private, no-store`.

An admitted Django superuser remains subject to the active CRM-role admission
boundary. Its existing audited superuser evaluator path remains in force, but
the empty allowlist means no capability codes are disclosed. Phase 1A.4B is
deferred.

Evidence classification: **API source-inspected; CRM integration unverified.**
The route, view, serializer, permission, allowlist, transaction, and cache
behavior were inspected in the API repository. The API focused suite passed
34/34 against isolated PostgreSQL database
`test_elevate_gdpr_phase1a4a_20261124`; `manage.py check` passed;
`makemigrations --check --dry-run` reported `No changes detected`;
`migrate --plan` reported no planned migration operations; and `git diff --check`
was clean. No schema or migration files changed or were applied. CRM tests,
builds, runtime, deployment, and cross-repository compatibility remain
unverified.

The revised superuser authority was runtime-verified in the API's final
isolated validation: capability foundation 13/13 passed, CRM-admin concurrency
1/1 passed, and the complete focused run passed 41/41. CRM behavior, CRM
capability integration, and cross-repository compatibility remain unverified.

## Current Angular architecture and contracts

Existing route, component, service, interface, session, CSRF, and role-guard
behavior remains unchanged. CRM UI role checks remain presentation hints;
they do not replace backend authorization. The CRM continues consuming the
existing `/auth/me/` contract and `staff_roles` field.

No CRM files outside this document were changed. Mobile JWT
authentication, Community sessions, Community projections, and existing CRM
role semantics are outside this documentation-only change; their
cross-repository compatibility is **Unverified**.

## Deferred functionality

The following are approved for later stages but are not implemented here:

- staff capability management screens, routes, services, or forms;
- grant, restriction, suspension, revocation, or approval workflows;
- capability-aware navigation or permission guards;
- contact masking and demographic restrictions;
- Person creation/editing privacy enforcement;
- search, filtering, marketing, campaign, and export protection;
- privacy audit history presentation;
- active-session capability refresh or invalidation behavior.

Capability integration and user-facing privacy workflows remain deferred. No CRM
capability integration or cross-repository compatibility claim is made by this
documentation-only stage.

## Evidence status

- **Approved:** CRM remains a permission-aware client of backend-authoritative
  contracts.
- **Implemented:** the existing API capability foundation, the API-only Phase
  1A.4A Staff Access contract, and this CRM guide; no CRM consumer or governance
  UI implementation.
- **Source-inspected / Source-confirmed:** existing CRM `/auth/me/`,
  `staff_roles`, session, CSRF, and role-guard conventions were inspected in
  `src/app/core/auth/auth.service.ts`, `src/app/core/auth/auth.types.ts`, and
  the API `accounts/serializers.py`; no CRM application source, UI, service,
  or CRM-side capability API consumer changes were made.
- **Verified elsewhere:** the API Phase 1A.4A focused suite passed 34/34 against
  isolated PostgreSQL database `test_elevate_gdpr_phase1a4a_20261124`;
  `manage.py check` passed; `makemigrations --check --dry-run` reported `No
  changes detected`; `migrate --plan` reported no planned migration operations;
  and `git diff --check` was clean. No schema or migration files changed or were
  applied.
- **Unverified:** CRM tests, builds, runtime behavior, Mobile and Community
  compatibility, cross-repository runtime behavior, deployment behavior, and
  CRM consumption of the Staff Access contract were not verified.
- **Verified elsewhere:** prior isolated local API governance migration, schema
  and focused PostgreSQL test evidence is recorded in the API repository's [GDPR guide](../../elevate-mk-api/docs/GDPR.md).
  The latest authorized API validation passed 69/69 focused tests and 9/9
  remediation tests, including synthetic subject/catalogue verification. This
  does not verify CRM, Mobile, or
  Community runtime compatibility.
- **Planned:** later CRM integration and user-facing privacy workflows.
- **Deferred:** Phase 1A.4B and any non-empty CRM capability disclosure allowlist.
- **Unverified:** runtime behavior after future capability API integration.

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
cross-repository runtime evidence; no CRM test or build was run.
