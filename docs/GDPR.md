# Elevate MK GDPR — CRM Functional and Technical Implementation Guide

Status: Living Documentation. The backend capability foundation is
implemented; CRM scope is documentation-only and no CRM application changes
are included in this stage.

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

Status: Implemented in the API; CRM capability integration remains Planned.

The API repository is authoritative for the capability catalog, role defaults,
evaluator precedence, governance boundary, schema, and indexes. CRM maintains
links to the API's [GDPR guide](../../elevate-mk-api/docs/GDPR.md),
[AUTHORIZATION.md](../../elevate-mk-api/docs/AUTHORIZATION.md), and
[DATABASE.md](../../elevate-mk-api/docs/DATABASE.md) rather than duplicating
those backend contracts. The foundation adds no CRM capability projection or
enforcement integration.

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

Phase 1A.2 remains deferred. No CRM capability integration or cross-repository
compatibility claim is made by this documentation-only stage.

## Evidence status

- **Approved:** CRM remains a permission-aware client of backend-authoritative
  contracts.
- **Implemented:** this stage's backend foundation and this initial CRM guide.
- **Source-confirmed:** the existing CRM `/auth/me/` and `staff_roles` contract
  shape was inspected in `src/app/core/auth/auth.service.ts`,
  `src/app/core/auth/auth.types.ts`, and the API
  `accounts/serializers.py`; no CRM application source changes were made.
- **Unverified:** CRM tests, builds, runtime behavior, Mobile and Community
  compatibility, cross-repository runtime behavior, and future capability API
  integration were not executed.
- **Verified elsewhere:** local API migration, schema, and focused capability
  test evidence is recorded in the API repository's [GDPR guide](../../elevate-mk-api/docs/GDPR.md)
  and does not verify CRM, Mobile, or Community runtime compatibility.
- **Planned:** later CRM integration and user-facing privacy workflows.
- **Unverified:** runtime behavior after future capability API integration.

Detailed backend schemas and evaluator rules are maintained in the API
repository's [GDPR guide](../../elevate-mk-api/docs/GDPR.md),
[DATABASE.md](../../elevate-mk-api/docs/DATABASE.md), and
[AUTHORIZATION.md](../../elevate-mk-api/docs/AUTHORIZATION.md).
