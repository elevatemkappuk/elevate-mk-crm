# Staff Management V1 — Business Guide

Status: **Approved planned feature; not currently available**

This guide describes the approved future Staff Management capability for
authorized Elevate MK administrators. It is not an instruction manual for a
currently deployed screen and must be updated when the implemented CRM
workflow becomes available.

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

## Planned workflows

The planned CRM will provide:

- Staff directory and detail view;
- Add Staff workflow;
- existing Person search and identity review;
- invitation and delivery recovery controls;
- Administrator approval queue;
- role changes;
- staff-access deactivation and reactivation;
- separate account disablement and enablement;
- password recovery request;
- verified login-email change;
- privacy capability summary;
- lifecycle audit history.

These workflows are approved plans, not current operating instructions. Exact
screen names, labels and navigation will be documented after implementation.

## Privacy and security boundaries

Staff Management will not administer privacy grants or restrictions. Those
changes remain in Privacy Administration.

When staff access is deactivated, individual privacy grants will be suspended
protectively. Reactivation will not restore them automatically. An authorized
Privacy Administrator must explicitly restore a suspended grant through the
existing governed process.

Passwords, invitation tokens, reset tokens, invitation URLs and provider
payloads must never be displayed or recorded in ordinary staff workflows.

Exceptional recovery for a person who has lost both credentials and registered
email remains a controlled technical procedure outside the normal Staff
Management screens.

## Current limitations

- Staff Management screens are not implemented.
- Proposed API endpoints are not available.
- No Staff Management operational instructions should be inferred from this guide.
- Historical API and CRM regression baselines are not Staff Management validation.

## Related documentation

- [API Staff Management architecture](../../elevate-mk-api/docs/STAFF_MANAGEMENT.md)
- [CRM Staff Management architecture](STAFF_MANAGEMENT.md)
- [Privacy and Permissions Business Guide](privacy-and-permissions-business-guide.md)
