# Staff Management V1

Status: **Directory/detail, onboarding governance, invitation management and acceptance implemented; runtime verification pending**

This document is the CRM repository's living guide to the Staff Management
experience. The Django API remains authoritative for identity,
authorization, lifecycle state, privacy permissions, audit history and
security decisions. See the API repository's
[Staff Management guide](../../elevate-mk-api/docs/STAFF_MANAGEMENT.md) for
the backend contract and approved business rules.

## Current status

Staff Management directory, detail, onboarding submission, Administrator
approval queue, role changes, staff-access deactivation, reactivation,
invitation management and public invitation acceptance are implemented.
Invitation delivery remains durable and backend-authoritative;
runtime verification is pending final hardening.

The API provides the Staff Management authorization foundation and the
backend-authoritative `access.staff_management` indicator:
active CRM Administrators and eligible active Django Superusers with a valid
linked Person may reach the Staff Management boundary. The Superuser exception
is narrowly scoped and does not grant general CRM or privacy authority. The
directory and detail routes use backend responses. The exception
does not grant general CRM or privacy authority.

The API now enforces one active CRM-family role per staff member, atomic role
replacement, final usable-Administrator continuity and CRM-session invalidation
for material role changes. These backend contracts do not make CRM screens,
navigation and directory contracts available without the corresponding
frontend actions. Full CRM regression remains deferred until final hardening.

Administrator approval governance is implemented in the backend. The API stores
dedicated pending/approved/effected/rejected/cancelled/expired/invalidated
Administrator proposals, requires distinct authorized proposer and approver
accounts, and effects existing staff promotion atomically. New onboarding
approval issues an invitation whose acceptance activates the Administrator
role. Former-staff reactivation approvals remain invitation-dependent for the
reactivation workflow, with exact `REACTIVATE` operation binding.

The backend provides lifecycle foundations. Staff-access deactivation is
separate from global account disablement: it removes CRM-family roles,
suspends individual privacy grants, preserves restrictions and global account
eligibility, and invalidates incompatible invitations/proposals. Global
disablement retains role history but invalidates authentication credentials;
enablement resumes retained active roles and grants but does not restore revoked
roles, suspended grants, sessions or tokens. Staff Detail exposes backend-
authorized role-change, deactivation, reactivation and global account
disablement/enablement actions. Account actions retain roles and privacy grants
while making them ineffective during disablement.

The historical CRM regression baseline of 493/493 is not new Staff Management
verification.

## Identity boundary

Implementation status: **Implemented**. Verification status: **Pending
Verification**.

The API treats Community and Staff `Person`/`User` identities as separate
domains. Staff classification is required before ordinary CRM role access, but
classification alone grants no access. Community identities cannot receive
ordinary Staff roles, and Staff identities cannot receive Community access or
Memberships. A person who needs both experiences uses independent identities;
the CRM does not automatically merge or link them.

## Implemented contracts

The CRM consumes `GET /api/v1/staff/directory/`,
`GET /api/v1/staff/directory/{user_id}/`, and
`GET /api/v1/staff/directory/{user_id}/activity/`. Search, filters, stable
ordering and pagination are server-side. Detail presents privacy-safe identity,
role, account, invitation, approval and activity information, with only the
backend-authorized invitation and proposal actions. Tokens, credentials and
unrestricted audit metadata are never exposed.

Staff Detail also consumes the backend `privacy_summary` projection. When the
operator has the existing governed privacy-read authority, the CRM presents
capability names, effective state, backend-provided sources, role-default state,
stored individual assignment state, restrictions, suspended grants and account
or Staff eligibility. The CRM never calculates effective permissions locally.
When the API returns `UNAVAILABLE`, no capability or assignment details are
shown and the rest of Staff Detail remains usable. The available view links to
Privacy Administration with the target Staff User selected; that interface
remains the only place where privacy permissions can be changed.

The Staff role-change dialog requests the non-mutating
`POST /api/v1/staff/role-change/preview/` contract for a proposed role. It marks
the result as hypothetical and shows current/proposed effective permissions,
gained and lost capabilities, retained restrictions and suspended grants. Role
selection changes invalidate prior previews; stale responses cannot replace the
current target or role. The preview does not authorize or apply the eventual
role change, including Administrator approval workflows.

## Approved experience

The feature will support authorized CRM Administrators and eligible active
Django Superusers. A Superuser without a CRM role may enter Staff Management
only; this exception must not grant access to People, Marketing, Moderation or
other CRM resources.

The implemented and planned experience includes:

- server-side Staff directory;
- lifecycle, role and approval filters;
- Staff detail workspace;
- new Staff identity validation and onboarding;
- duplicate and identity-collision review in the onboarding boundary;
- invitation issue, resend and cancellation;
- Administrator approval queue;
- role changes;
- staff-access deactivation and reactivation;
- separate User-account disablement and enablement;
- administrative password recovery;
- verified login-email changes;
- read-only privacy capability summaries;
- lifecycle audit history.

Verified login-email changes are **Implemented / Pending Verification**. The
Staff Detail page queues an administrative request with a new email and
mandatory reason, displays its lifecycle, and permits cancellation when the
backend allows it. The public verification page inspects the link without
mutation, requires the account owner to sign in with the existing credentials,
and then confirms the request. It does not store or log the token. Completion
returns the account owner to a fresh sign-in because the backend revokes
credentials and sessions.

The backend uses shared account-security token and request-invalidation
infrastructure intended for future Community and Mobile entry points. This CRM
stage does not expose those self-service workflows.

## Invitation experience

Implemented contracts include:

```text
/administration/staff
/administration/staff/:id
/administration/staff/approvals
/staff/invitation/accept?invitation=<id>&token=<credential>
```

The onboarding drawer creates a new Staff identity after advisory validation
and reports the email as queued, never as delivered or active staff. The public acceptance page
keeps the bearer token in memory and does not store it in local storage.
For existing active accounts, the page uses the existing `AuthService` login
flow, clears any currently authenticated account before switching identity, and
then submits acceptance under that authenticated session. The API still checks
the exact invitation target and rejects a different account.

## Administrator approvals

Implementation status: **Implemented**. Verification status: **Pending
Verification**.

The Staff Management directory links to `/staff-management/administrator-approvals`.
The queue displays safe proposal state and opens proposal detail with backend
provided permitted actions. Approval, rejection and proposer cancellation use
the shared confirmation dialog and mandatory reasons where required. Approval
of onboarding issues an invitation but does not present Administrator access as
active; promotion approval replaces the existing CRM role atomically on the
backend. The frontend does not infer approval authority from a role label.

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

## Feature workflows

### Add Staff

The onboarding drawer collects a new Staff identity directly. Existing Person
selection and account reuse are not supported. It supports a new identity form,
shows backend account resolution, validates the requested canonical role and
requires a reason. It must not silently merge identities, overwrite contact
data, create Membership or expose restricted Person data. Final persistence is
unavailable until invitation issuance can be integrated safely.

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

The Staff Detail page exposes `Disable global account` and `Enable global
account` only when the backend returns the corresponding eligibility flags.
Disablement blocks ecosystem authentication, invalidates applicable sessions
and credentials, and cancels incompatible invitations, proposals and pending
email changes. Enablement requires fresh authentication and does not resurrect
invalidated credentials, revoked roles or suspended grants. Runtime API and
browser verification remains pending final hardening.
Reactivation requires a new invitation and does not restore suspended privacy
grants. Account enablement does not restore revoked staff access, invalidated
sessions or suspended grants.

Eligible Staff Administrators also receive a `Send Password Reset Email`
action for active Staff accounts. The action queues a reset email for the
registered login address only; Administrators cannot choose or view the
password or reset link. Existing credentials remain unchanged until the
account owner completes the existing public `/reset-password/:uid/:token`
workflow. The backend returns queued status, not inbox delivery confirmation.

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

Permanent onboarding frontend tests have been created but not executed.
Runtime and full regression verification remain pending final hardening.
