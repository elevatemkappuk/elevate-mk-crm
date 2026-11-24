# Elevate MK GDPR — CRM Functional and Technical Implementation Guide

Status: Living Documentation. Phase 1A.1 backend capability foundation is
implemented; no CRM application changes are included in this stage.

## Purpose and boundary

The Angular Staff CRM presents CRM workflows, but Django remains authoritative
for authentication, authorization, privacy protection, and data projections.
Existing CRM roles remain `CRM_ADMIN`, `CRM_MANAGER`, and `CRM_VIEWER`.

Phase 1A.1 adds no capability response to `/auth/me/`, no Angular capability
guard, no masking behavior, no Person projection changes, and no new sensitive
data access path.

## Approved backend capability foundation

The backend defines six capabilities and the following initial defaults:

| Role | Defaults |
| --- | --- |
| `CRM_VIEWER` | none |
| `CRM_MANAGER` | `PERSON_CONTACT_READ` |
| `CRM_ADMIN` | `PERSON_CONTACT_READ`, `PERSON_DEMOGRAPHIC_READ`, `PERSON_EXPORT`, `STAFF_CAPABILITY_ADMIN` |

`PERSON_RESTRICTED_ACCESS` and `PRIVACY_AUDIT_READ` are not ordinary role
defaults. The backend evaluator combines role defaults and active individual
assignments, applies explicit restrictions, and excludes suspended or revoked
assignments. A Django superuser exception is backend-audited and does not
change operational CRM-role membership.

## Current Angular architecture and contracts

Existing route, component, service, interface, session, CSRF, and role-guard
behavior remains unchanged. CRM UI role checks remain presentation hints;
they do not replace backend authorization. The CRM continues consuming the
existing `/auth/me/` contract and `staff_roles` field.

No CRM files outside this document were changed in Phase 1A.1. Mobile JWT
authentication, Community sessions, Community projections, and existing CRM
role semantics remain compatible.

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

## Evidence status

- **Approved:** CRM remains a permission-aware client of backend-authoritative
  contracts.
- **Implemented:** this stage's backend foundation and this initial CRM guide.
- **Source-confirmed:** existing CRM contract compatibility was inspected in
  `src/app/core/auth/auth.service.ts`,
  `src/app/core/auth/auth.types.ts`, and the API
  `accounts/serializers.py`; no CRM source changes were required.
- **Unverified:** CRM tests, builds, runtime behavior, Mobile and Community
  compatibility, and future capability API integration were not executed.
- **Planned:** later CRM integration and user-facing privacy workflows.
- **Unverified:** runtime behavior after future capability API integration.

Detailed backend schemas and evaluator rules are maintained in the API
repository's [GDPR guide](../../elevate-mk-api/docs/GDPR.md),
[DATABASE.md](../../elevate-mk-api/docs/DATABASE.md), and
[AUTHORIZATION.md](../../elevate-mk-api/docs/AUTHORIZATION.md).
