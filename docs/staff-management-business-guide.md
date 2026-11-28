# Staff Management V1 — Business Guide

Status: **Directory/detail, governance, role changes, staff-access lifecycle and invitation acceptance implemented; runtime verification pending**

This guide describes the Staff Management capability for authorized Elevate MK
administrators. Invitation-backed onboarding, Administrator approvals, direct
role changes, staff-access deactivation and reactivation are available;
runtime verification remains pending.

## Purpose

Staff Management will provide an operational alternative to relying on Django
Admin for routine CRM staff administration. It will manage operational CRM
access while keeping User accounts, Membership, Community access, privacy
permissions and Django technical privileges as separate responsibilities.

## Roles

- **CRM Administrator** — authorized to perform Staff Management operations permitted by the backend.
- **CRM Manager** — does not manage staff in V1.
- **CRM Viewer** — does not manage staff in V1.
- **Eligible Django Superuser** — may access Staff Management through a narrow technical exception, without automatically receiving general CRM access.

The backend decides whether an action is allowed. A hidden button is not proof
that an operation is unavailable or secure.

## Approved business rules

Staff Management will preserve the following rules:

1. Staff receive secure invitations and choose their own password.
2. New Staff onboarding always creates a new STAFF Person and User.
3. Existing Person selection and account reuse are not supported by new onboarding.
4. Former Staff reactivation reuses the existing Staff Person and User.
5. Existing active Users keep their existing credentials when using the separate invitation or reactivation workflows.
6. Membership and Community access are not automatically changed.
7. One CRM-family role is active at a time.
8. CRM Administrator authority requires two distinct administrators.
9. Administrators cannot use Staff Management to perform prohibited actions on themselves.
10. Staff access deactivation is separate from disabling the User account.
11. Reactivation requires a new invitation and current permission review.
12. Privacy grants suspended during deactivation do not automatically return.
13. Login email and Person contact email remain separate.
14. Technical accounts receive restricted actions.
15. Lifecycle actions and denied sensitive operations are audited.

## Staff and Community identity boundary

`Person` classification is a permanent domain boundary. A Community identity
cannot be converted into a Staff identity, and a Staff identity cannot be
converted into a Community identity. Staff deactivation preserves the Staff
identity, and reactivation reuses that existing Staff identity.

The same physical individual may have separate Community and Staff
`Person`/`User` identities. Staff onboarding always creates a new STAFF Person
and User; it must not reuse a Community member identity or overwrite its
Membership or contact data. Existing Staff identities use the dedicated
lifecycle or reactivation workflow. Staff duplicate signals are domain-scoped,
while login-email uniqueness remains global. The backend remains authoritative;
CRM visibility or form restrictions do not grant permission.

## Available workflows

The CRM provides:

- Staff directory and detail view;
- server-side search, filters and pagination;
- role, account, invitation and Administrator approval state;
- Administrator approval queue and proposal review;
- read-only staff activity history;
- new Staff identity validation and transactional invitation submission;
- public new-account invitation acceptance;
- existing-account authentication followed by invitation acceptance;
- backend-authorized role changes between Manager and Viewer;
- staff-access deactivation without global account disablement;
- Manager/Viewer reactivation invitations and Administrator reactivation proposals.

The following remain unavailable:
- existing Person selection and account reuse during new onboarding;
- invitation and delivery recovery controls;
- separate account disablement and enablement;
- password recovery request;
- verified login-email change;
- privacy capability summary;
- lifecycle audit history.

Remaining unavailable workflows are approved future functionality, not current
operating instructions.

## Privacy and security boundaries

Staff Management will not administer privacy grants or restrictions. Those
changes remain in Privacy Administration.

When staff access is deactivated, individual privacy grants will be suspended
protectively. Reactivation will not restore them automatically. An authorized
Privacy Administrator must explicitly restore a suspended grant through the
existing governed process.

The backend foundation now keeps staff-access deactivation separate from
global account disablement. Deactivation preserves global authentication
eligibility while removing CRM access. Account disablement invalidates account
credentials; enablement resumes retained active CRM roles and active privacy
grants, but does not restore revoked roles, suspended grants, sessions, tokens,
invitations or proposals. The CRM now exposes separate backend-authorized
global account disablement and enablement actions from Staff Detail. Disabled
accounts display retained roles as ineffective and require fresh
authentication after enablement.

Passwords, invitation tokens, reset tokens, invitation URLs and provider
payloads must never be displayed or recorded in ordinary staff workflows.

Exceptional recovery for a person who has lost both credentials and registered
email remains a controlled technical procedure outside the normal Staff
Management screens.

## Current limitations

- Global account actions require a mandatory reason; frontend visibility is not
  an authorization boundary.
- Active Staff accounts may expose `Send Password Reset Email`; the email is
  queued only to the registered login address and the account owner completes
  the existing secure password-recovery flow.
- Authorized Administrators may request a login-email change with a mandatory
  reason. The account owner must authenticate with the existing credentials and
  verify the new address. The Person contact email is not changed; sessions and
  credentials are revoked after completion. Staff-specific transactional-email
  templates must be configured before the action is available operationally.
- Activity and directory behavior is implemented but runtime verification is pending.
- Mutation actions remain subject to backend authorization, current-state validation and mandatory reasons.
- Historical API and CRM regression baselines are not Staff Management validation.

## Related documentation

- [API Staff Management architecture](../../elevate-mk-api/docs/STAFF_MANAGEMENT.md)
- [CRM Staff Management architecture](STAFF_MANAGEMENT.md)
- [Privacy and Permissions Business Guide](privacy-and-permissions-business-guide.md)
