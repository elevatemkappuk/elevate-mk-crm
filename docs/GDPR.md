# Elevate MK GDPR — CRM Functional and Technical Implementation Guide

Status: Living Documentation. The backend capability foundation and governance
implementation are source-inspected, with focused isolated PostgreSQL
migration/test validation recorded by the API repository. CRM integration
remains unverified. CRM scope remains documentation-only and no CRM application
changes are included in this stage.

## Purpose and boundary

The Angular Staff CRM presents CRM workflows, but Django remains authoritative
for authentication, authorization, privacy protection, and data projections.
Existing CRM roles remain `CRM_ADMIN`, `CRM_MANAGER`, and `CRM_VIEWER`.

This CRM work is documentation-only: no CRM application source,
API contract, tests, or runtime behavior are changed or validated by this
stage.

The foundation adds no capability response to `/auth/me/`, no Angular capability
guard, no masking behavior, no Person projection changes, and no new sensitive
data access path.

## API-authoritative capability foundation

Status: API foundation and governance implementation are source-inspected;
governance migration/test execution is verified in the API's isolated
PostgreSQL validation, while CRM capability integration remains Planned and
Unverified.

The API repository is authoritative for the capability catalog, role defaults,
evaluator precedence, governance boundary, schema, and indexes. CRM maintains
links to the API's [GDPR guide](../../elevate-mk-api/docs/GDPR.md),
[AUTHORIZATION.md](../../elevate-mk-api/docs/AUTHORIZATION.md), and
[DATABASE.md](../../elevate-mk-api/docs/DATABASE.md) rather than duplicating
those backend contracts. No CRM capability projection, UI, or enforcement
integration is included; CRM consumes no new capability API contract.

The approved Django superuser authority change is backend-only. Active
superusers may use the API's audited direct governance service path, while
ordinary CRM administrators remain subject to the existing governance rules.
No CRM UI, route, permission guard, or governance API contract was added;
runtime compatibility remains unverified.

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
- **Implemented:** the existing API capability foundation and this initial CRM
  guide; no CRM governance implementation.
- **Source-inspected / Source-confirmed:** existing CRM `/auth/me/`,
  `staff_roles`, session, CSRF, and role-guard conventions were inspected in
  `src/app/core/auth/auth.service.ts`, `src/app/core/auth/auth.types.ts`, and
  the API `accounts/serializers.py`; no CRM application source, UI, service,
  or capability API contract changes were made.
- **Unverified:** CRM tests, builds, runtime behavior, Mobile and Community
  compatibility, cross-repository runtime behavior, and future capability API
  integration were not executed.
- **Verified elsewhere:** prior isolated local API governance migration, schema
  and focused PostgreSQL test evidence is recorded in the API repository's [GDPR guide](../../elevate-mk-api/docs/GDPR.md).
  The final isolated API validation passed 41/41 focused tests and synthetic
  baseline migration verification. This does not verify CRM, Mobile, or
  Community runtime compatibility.
- **Planned:** later CRM integration and user-facing privacy workflows.
- **Unverified:** runtime behavior after future capability API integration.

Detailed backend schemas and evaluator rules are maintained in the API
repository's [GDPR guide](../../elevate-mk-api/docs/GDPR.md),
[DATABASE.md](../../elevate-mk-api/docs/DATABASE.md), and
[AUTHORIZATION.md](../../elevate-mk-api/docs/AUTHORIZATION.md).
