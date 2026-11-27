# Staff Management V1

Status: **Approved architecture / backend role integrity implemented; CRM implementation planned**

This document is the CRM repository's living guide to the planned Staff
Management experience. The Django API remains authoritative for identity,
authorization, lifecycle state, privacy permissions, audit history and
security decisions. See the API repository's
[Staff Management guide](../../elevate-mk-api/docs/STAFF_MANAGEMENT.md) for
the backend contract and approved business rules.

## Current status

Staff Management is approved architecture, not an implemented CRM feature.
The current Administration page is a placeholder. Proposed routes, components
and services in this document are not available until implementation is
authorized and completed.

The API now provides the Staff Management authorization foundation:
active CRM Administrators and eligible active Django Superusers with a valid
linked Person may reach the Staff Management boundary. The Superuser exception
is narrowly scoped and does not grant general CRM or privacy authority. This
does not make Staff Management screens, navigation, directory contracts or
lifecycle workflows available. CRM route guards and capability-aware state
remain future integration work and must use backend responses.

The API now enforces one active CRM-family role per staff member, atomic role
replacement, final usable-Administrator continuity and CRM-session invalidation
for material role changes. These backend contracts do not make CRM screens,
navigation, directory contracts or lifecycle workflows available. Full CRM
regression remains deferred until final hardening.

Administrator approval governance is implemented in the backend. The API stores
dedicated pending/approved/effected/rejected/cancelled/expired/invalidated
Administrator proposals, requires distinct authorized proposer and approver
accounts, and effects existing staff promotion atomically. New onboarding and
former-staff reactivation approvals remain invitation-dependent for the
onboarding and reactivation workflows. No CRM approval UI or frontend contract
is implemented.

The backend provides lifecycle foundations. Staff-access deactivation is
separate from global account disablement: it removes CRM-family roles,
suspends individual privacy grants, preserves restrictions and global account
eligibility, and invalidates incompatible invitations/proposals. Global
disablement retains role history but invalidates authentication credentials;
enablement does not restore roles, grants, sessions or tokens. No CRM lifecycle
UI or new public lifecycle endpoint is available, and the complete
invitation-backed reactivation workflow remains planned.

The historical CRM regression baseline of 493/493 is not new Staff Management
verification.

## Approved experience

The feature will support authorized CRM Administrators and eligible active
Django Superusers. A Superuser without a CRM role may enter Staff Management
only; this exception must not grant access to People, Marketing, Moderation or
other CRM resources.

The planned experience includes:

- server-side Staff directory;
- lifecycle, role and approval filters;
- Staff detail workspace;
- existing Person selection;
- duplicate and identity-collision review;
- invitation issue, resend and cancellation;
- Administrator approval queue;
- role changes;
- staff-access deactivation and reactivation;
- separate User-account disablement and enablement;
- administrative password recovery;
- verified login-email changes;
- read-only privacy capability summaries;
- lifecycle audit history.

## Planned route structure

Proposed routes are not implemented:

```text
/administration/staff
/administration/staff/:id
/administration/staff/approvals
/staff/activate/:invitation/:token
```

The route guard must consult backend-derived authority. Frontend navigation is
not a security boundary.

## Reusable CRM infrastructure

The implementation should reuse:

- `AuthService`;
- `StaffAccessService`;
- `auth.guards.ts`;
- `people.service.ts`;
- `people-directory-query.ts`;
- `person-duplicate-conflict.component.ts`;
- `add-person-drawer.component.ts`;
- `crm-drawer.component.ts`;
- `confirmation-dialog.component.ts`;
- `status-badge.component.ts`;
- `detail-list.component.ts`;
- existing audit-history and pagination patterns;
- existing CRM tokens, responsive styles and error states.

New visual components must use separate TypeScript, HTML, style and spec files.
Legacy inline components outside this feature are not being refactored here.

## Privacy-aware state

The API projection is authoritative. Staff detail, privacy summaries and audit
history must be cleared when access is lost. Late responses must not repopulate
restricted state. Effects should be stable and idempotent, and signals should
only be written when semantic values change.

The CRM must never infer effective privacy capabilities from role labels. It
should display the backend-provided summary and link to Privacy Administration
for governed changes.

The business-facing workflow summary is in
[staff-management-business-guide.md](staff-management-business-guide.md).

## Planned workflows

### Add Staff

The workflow will search permitted Persons, present identity-collision evidence,
allow an existing Person or a new Person, and establish or reuse the correct
User relationship. It must not silently merge identities, overwrite contact
data, create Membership or expose restricted Person data.

### Invitation

Delivery state and acceptance state are separate. Resend invalidates the prior
link. An existing active User retains credentials. A new unactivated User sets
their own password. A globally disabled User is not silently enabled.

### Administrator approval

The queue will show pending, expired, rejected, cancelled and invalidated
proposals using backend-derived state. Proposer and approver must be distinct.
Approval and invitation acceptance must both be satisfied before new or
reactivated CRM Administrator access becomes effective.

### Staff and account lifecycle

Staff-access deactivation and global account disablement are separate actions.
Reactivation requires a new invitation and does not restore suspended privacy
grants. Account enablement does not restore revoked staff access, invalidated
sessions or suspended grants.

### Privacy and audit

Staff Management may display an authorized read-only privacy summary and
lifecycle audit history. Privacy grant restoration remains within Privacy
Administration. Raw tokens, passwords, provider payloads and restricted data
must not appear in the UI.

## Accessibility and responsive behavior

Reuse existing drawers, dialogs, native form controls, focus management,
keyboard behavior, status badges, table patterns and responsive breakpoints.

Each workflow must provide loading, empty, permission-denied, validation,
conflict, delivery-failure and retry states. Destructive operations require
confirmation and a reason.

## Planned testing and verification

Future CRM coverage must include:

- route guards for CRM Admin and narrow Superuser access;
- denied Viewer/Manager/is_staff-only access;
- protected-account action visibility;
- self-management restrictions;
- directory filtering and pagination;
- identity collision review;
- invitation lifecycle states;
- approval queue behavior;
- lifecycle action confirmations;
- privacy-state invalidation and late-response protection;
- audit timeline projection;
- keyboard, focus and responsive interaction.

No Staff Management frontend tests have been created or executed in this
documentation stage.
