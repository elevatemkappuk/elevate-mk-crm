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
2. Existing People and Users are reused where identity is confirmed.
3. Existing active Users keep their existing credentials.
4. Membership and Community access are not automatically changed.
5. One CRM-family role is active at a time.
6. CRM Administrator authority requires two distinct administrators.
7. Administrators cannot use Staff Management to perform prohibited actions on themselves.
8. Staff access deactivation is separate from disabling the User account.
9. Reactivation requires a new invitation and current permission review.
10. Privacy grants suspended during deactivation do not automatically return.
11. Login email and Person contact email remain separate.
12. Technical accounts receive restricted actions.
13. Lifecycle actions and denied sensitive operations are audited.

## Available workflows

The CRM provides:

- Staff directory and detail view;
- server-side search, filters and pagination;
- role, account, invitation and Administrator approval state;
- Administrator approval queue and proposal review;
- read-only staff activity history;
- onboarding Person lookup, validation and transactional invitation submission;
- public new-account invitation acceptance;
- existing-account authentication followed by invitation acceptance;
- backend-authorized role changes between Manager and Viewer;
- staff-access deactivation without global account disablement;
- Manager/Viewer reactivation invitations and Administrator reactivation proposals.

The following remain unavailable:
- existing Person search and identity review;
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
invitations or proposals. Global account lifecycle mutations remain unavailable
in the CRM screens.

Passwords, invitation tokens, reset tokens, invitation URLs and provider
payloads must never be displayed or recorded in ordinary staff workflows.

Exceptional recovery for a person who has lost both credentials and registered
email remains a controlled technical procedure outside the normal Staff
Management screens.

## Current limitations

- Global account mutation workflows remain unavailable in the CRM.
- Activity and directory behavior is implemented but runtime verification is pending.
- Mutation actions remain subject to backend authorization, current-state validation and mandatory reasons.
- Historical API and CRM regression baselines are not Staff Management validation.

## Related documentation

- [API Staff Management architecture](../../elevate-mk-api/docs/STAFF_MANAGEMENT.md)
- [CRM Staff Management architecture](STAFF_MANAGEMENT.md)
- [Privacy and Permissions Business Guide](privacy-and-permissions-business-guide.md)
