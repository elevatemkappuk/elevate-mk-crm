# Elevate MK Privacy and Permissions — Business Guide

Status: Living documentation. This is a business-facing guide to the current
privacy and permissions boundaries across Staff CRM, Mobile, Community, and the
shared Django API. It is not a legal privacy notice, a GDPR compliance
determination, or a replacement for the API contracts.

## How to use this guide

This guide explains who may use each product, which business data is visible,
and what happens when access or consent changes. It uses the following status
labels:

- **Approved** — an accepted requirement or architecture decision; not proof of
  implementation.
- **Implemented** — supported by inspected source or repository documentation.
- **Verified** — supported by an existing recorded test, build, UAT, or runtime
  result. This documentation stage did not rerun those checks.
- **Unverified** — implementation or compatibility evidence is incomplete.
- **Deferred** — intentionally outside the current accepted scope.
- **Superseded** — historical evidence retained for traceability but no longer
  the current contract.

The API owns the authoritative backend contract. The CRM, Community, and Mobile
repositories document their respective user experiences and client behavior.
Where this guide summarizes a rule, the linked API document remains authoritative.

## 1. Product boundaries and audiences

| Product or interface | Primary audience | Authentication boundary | Business authorization boundary |
| --- | --- | --- | --- |
| Staff CRM | Staff operating People, privacy, imports, and marketing workflows | Django server-side session with CSRF protection | Active operational staff roles and backend-evaluated capabilities |
| Mobile | Eligible members using the mobile application | Mobile access and refresh JWTs | Backend account and active-membership checks; mobile JWTs do not grant CRM staff access |
| Community web application | Community members | Django server-side session with CSRF protection | Active Community eligibility and member-owned or relationship-scoped projections |
| Django Admin and API documentation | Technical administrators and approved technical users | Django technical session | Separate Django technical permissions or approved active-superuser authority; not a CRM role |

The API is shared, but product sessions are intentionally separate. A login to
one product must not be treated as a promise of shared sign-on or shared
authorization in another product.

Technical details: [API authentication](../../elevate-mk-api/docs/AUTHENTICATION.md),
[API authorization](../../elevate-mk-api/docs/AUTHORIZATION.md), and the
[Community platform contract](../../elevate-mk-api/docs/community-platform.md).

## 2. Identity and permission concepts

### Person, User, and Membership

- `Person` is the canonical human and CRM record.
- `User` is the authentication account and is linked to exactly one Person.
- `Membership` describes the person's Elevate relationship; it is not itself a
  login credential or a staff permission.
- A Person may exist without a User, membership, or application access.

Membership, an email address, or inclusion in a provider contact list does not
prove marketing consent or staff authorization.

### Staff roles and capabilities

The current operational CRM roles are:

- **CRM Admin** — administrative People and governance operations permitted by
  the backend.
- **CRM Manager** — management workflows permitted by the backend.
- **CRM Viewer** — read-oriented CRM access; no normal People writes and no
  Internal Notes access.

Roles are evaluated from active, unrevoked role assignments linked to active
  role definitions. Django `is_staff` and `is_superuser` are technical Django
  concepts, not ordinary CRM roles. The approved audited superuser exception
  remains a distinct backend path and must not be presented as normal staff
  access.

Capabilities provide finer privacy and governance boundaries. They do not
replace CRM-role admission, record scope, consent rules, or backend
authorization. Current capability names and evaluator precedence are owned by
[API `AUTHORIZATION.md`](../../elevate-mk-api/docs/AUTHORIZATION.md).

### Community eligibility

Community access requires an authenticated active User linked to a non-archived
BUSINESS Person and an ACTIVE Membership. Community frontend guards improve
navigation but are not security boundaries; the API derives the Person and
enforces eligibility.

## 3. What staff and members may see

### Staff CRM People data

The CRM People domain is limited to BUSINESS People. TECHNICAL records are not
shown or searchable in normal People workflows. Archive preserves the record and
history; it does not erase the Person or bypass privacy rules.

Current privacy capabilities separately govern:

- contact fields such as email and mobile;
- demographic fields such as age range and gender;
- contact search and export columns; and
- selected protected disclosure and governance workflows.

The API may return masked or `Restricted` values. The CRM must not infer hidden
values, persist protected values in browser storage, or treat a hidden field as
permission to edit it. CRM Viewer access excludes Internal Notes and their
related operational audit rows.

Location, professional profile fields, skills, interests, tags, notes,
membership data, marketing preferences, Community lifecycle/provider data, and
general audit-history classification are not all resolved by the current privacy
policy. Their broader classification and enforcement remain deferred or
unverified as recorded in the [API GDPR guide](../../elevate-mk-api/docs/GDPR.md).

### Community profile and connections

Members can manage the approved self-service profile fields. Community does not
expose CRM notes, staff roles, provider state, invitation internals, or other
staff-only data through the member profile projection.

Directory and connection projections are privacy-scoped. Directory cards do not
include email or mobile. An accepted, currently effective connection may expose
canonical contact values where the backend permits it; disconnecting or losing
eligibility removes that connection-derived access.

See the [Community profile guide](../../elevate-mk-community/docs/profile.md)
and [Connections guide](../../elevate-mk-community/docs/connections.md) for the
member-facing workflow.

### Marketing data

Elevate CRM owns the provider-neutral EMAIL preference:

- `UNKNOWN` — no explicit preference evidence;
- `OPTED_IN` — explicit permission for marketing email;
- `OPTED_OUT` — marketing email must not be sent.

Membership, an email address, a previous campaign, or a Brevo contact does not
imply consent. CRM Admin and CRM Manager may record explicit preferences;
CRM Viewer is read-only. Brevo provider state is separate from CRM consent.

See [marketing consent](../../elevate-mk-api/docs/marketing-consent.md) and the
[Brevo business guide](brevo-crm-business-guide.md).

## 4. Access and consent lifecycle

### Access changes

Implemented staff-role revocation removes the assignment from active role
evaluation and records audit history. Capability loss is intended to invalidate
protected CRM presentation state and prevent late responses from repopulating
restricted data. The backend remains authoritative for every request.

The architecture also requires immediate staff-session invalidation after role
removal, credential invalidation after account deactivation or password reset,
and defined CRM idle and absolute session limits. Cross-repository operational
verification of those requirements remains **Unverified**; this guide does not
upgrade them to implemented or verified claims.

### Authentication recovery

Password recovery uses generic responses for unknown or ineligible accounts and
does not disclose account existence. Successful recovery does not automatically
sign the user in. Existing Django session invalidation is documented, while
complete mobile access/refresh-token invalidation and production behavior remain
subject to the API's recorded verification and deployment prerequisites.

### Marketing preference changes

A preference change is recorded in Elevate first, with append-only history where
applicable. Provider synchronization is asynchronous and must re-read current
consent. An opt-out is restrictive and must not be silently reversed. Provider
unsubscribe handling records a CRM opt-out without creating an outbound echo
job.

### Synthetic example

Suppose a synthetic Person has an active Membership, no CRM staff role, and an
explicit EMAIL `OPTED_OUT` preference. That person may be eligible for the
Community member experience, cannot open Staff CRM People workflows, and must
not be included in a marketing send. Each result comes from a separate
backend-authoritative boundary.

## 5. Business operating rules

- Use the minimum role and capability needed for the task.
- Search and review before creating or linking a Person; do not use name-only
  matching as identity proof.
- Treat masked or `Restricted` values as unavailable, not as clues to recover.
- Do not use Django technical access as a substitute for operational CRM access.
- Do not record marketing opt-in without explicit evidence.
- Do not copy CRM-only information into Community projections or provider
  profiles unless the approved contract permits it.
- Escalate a denied, stale, conflicting, or unavailable workflow rather than
  bypassing it or inventing a repair path.

## 6. Permission matrix and effective access

The API evaluates the following seven privacy and governance capabilities. A
capability is not effective merely because it appears in a proposal or because
someone has technical Django access.

| Capability | Business-friendly name | Business meaning | Initial ordinary role default |
| --- | --- | --- |
| `PERSON_CONTACT_READ` | Contact information | View permitted contact information and use approved contact-aware workflows | CRM Manager and CRM Admin |
| `PERSON_DEMOGRAPHIC_READ` | Demographic information | View permitted demographic information | CRM Admin |
| `PERSON_EXPORT` | People exports | Export People using the protected export workflow | CRM Admin |
| `PERSON_RESTRICTED_ACCESS` | Exceptional restricted access | Additional gate for a future explicitly approved exceptional workflow | None |
| `PRIVACY_AUDIT_READ` | Privacy audit history | View the safe privacy-audit history projection | None |
| `STAFF_CAPABILITY_ADMIN` | Staff privacy administration | Administer staff privacy capabilities through approved governance workflows | CRM Admin |
| `LEGAL_HOLD_ADMIN` | Legal holds and retention evaluation | Administer legal holds and approved retention evaluation workflows | None |

CRM Viewer has no privacy capabilities by default. Individual grants may add
capabilities when the staff member is eligible. Explicit restrictions override
role defaults and grants. Suspended or revoked grants do not become active when
a restriction is removed. Pending changes are not effective permissions.

## 7. Permission administration and approval

Ordinary privacy administrators use controlled workflows. Sensitive role-default
changes and granting or restoring `STAFF_CAPABILITY_ADMIN` require one distinct
authorized proposer and approver. Other individual capability changes require
an authorized administrator, a reason where required, and an audit record.

Proposals may be approved, rejected, cancelled, expired or invalidated. They
expire after 30 calendar days and are rechecked against current authority,
eligibility and policy state before approval. Staff members cannot approve
their own proposals or use ordinary administration to grant themselves access.
Urgent restriction or suspension of another administrator may take effect
immediately where the approved workflow allows it; restoration remains subject
to the required approval rules.

## 8. Django superuser authority

An active authenticated Django superuser using the authorized Django Admin
boundary may directly administer staff roles and privacy permissions,
including their own, without ordinary business justification or two-person
approval. This is a separate technical exception, not a normal CRM role.

Automatic auditing, actor attribution, before/after state, outcome,
privileged-bypass metadata and fail-closed audit persistence remain mandatory.
The exception does not extend to unrelated controls or separately governed
legal-hold workflows. Ordinary `is_staff` status and ordinary CRM roles do
not grant this authority.

## 9. Personal information and People workflows

Staff may see only the Person records and fields authorized by the backend.
Contact information may be fully visible, deterministically masked or shown as
Restricted. Demographic information is separately controlled. Missing values
are not converted into fabricated data.

People search, creation and editing preserve record-level authorization.
Unauthorized protected fields are hidden or read-only and omitted from update
requests. Permission loss clears protected in-memory state and prevents late
responses from restoring it. The browser does not store protected values.

## 10. Marketing, exports and audit history

Marketing consent is separate from staff permission. `UNKNOWN`, `OPTED_IN` and
`OPTED_OUT` are business states; membership, an email address or a provider
record does not prove consent. Audience previews, recipient views and provider
operations must respect current contact permissions.

Personal-information exports require `PERSON_EXPORT`, preserve record-level
authorization, protect restricted fields in CSV and XLSX, and are subject to
mandatory export auditing. Export controls are presentation only; the backend
remains authoritative.

Privacy audit history exposes a safe projection to authorized readers. It may
show the actor, target, operation, time, outcome and decision information that
the reader is allowed to see. It does not expose raw audit metadata or
unrestricted personal information. Deliberate protected disclosures are audited
before disclosure; ordinary masked or routine authorized reads are not blanket
disclosure events. Comprehensive Person access auditing remains deferred as
`GDPR-FUTURE-001`.

## 11. Legal holds and retention

Authorized staff may place a Person-wide or event-specific legal hold where the
approved workflow permits it. Holds protect the relevant records from eligible
disposal. Release requests preserve their requester, decision, reason and
history. The original requester may cancel a pending request with a reason;
this leaves the hold active and permits a later request. Ordinary approval
requires separation of duties. The approved
superuser exception is not a general substitute for legal-hold governance.

The proposed initial privacy-audit retention period is 24 months from audit
event creation, but remains provisional pending formal legal/privacy approval.
Automatic disposal and anonymisation are not activated by this guide.

## 12. Practical scenarios

- A CRM Viewer can use ordinary CRM functions but receives no privacy
  capability by default.
- A CRM Manager can view approved contact information but sees restricted
  demographics unless separately authorized.
- A restriction overrides an otherwise active grant or role default.
- A revoked capability takes effect on the next backend request without
  requiring ordinary session termination.
- An ordinary administrator proposes a sensitive permission change and a
  distinct authorized administrator approves or rejects it.
- An active Django superuser performs a direct audited administrative change;
  the absence of ordinary justification is recorded accurately.
- A privacy officer reviews safe audit history without receiving raw audit
  payloads or unrestricted Person data.

## 13. Workflow playbooks

### Reviewing a Person

1. Open the People area using an authorized CRM account.
2. Search only for a legitimate business purpose.
3. Treat the displayed contact and demographic values as the authorized
   projection, not as evidence that additional values may be retrieved.
4. Use the established restricted or masked presentation when a field is not
   available.
5. Report an unexpected denial or stale display rather than bypassing it.

### Requesting a staff permission change

1. Confirm that the target is eligible and that the requested capability is
   necessary for the role.
2. Submit the change with the required reason.
3. Wait for the backend to show whether the change is immediate or pending
   independent approval.
4. A distinct authorized administrator reviews the proposal when separation of
   duties applies.
5. Check the resulting state; a pending proposal never grants access.

### Responding to a permission loss

1. Stop relying on any previously displayed protected information.
2. Allow the CRM to refresh the effective access state.
3. Retry only the ordinary functions that remain available.
4. If access cannot be confirmed, use the access-denied or support route.
5. Do not sign out other users or attempt to restore the permission locally.

### Placing or releasing a legal hold

1. Confirm the Person or event scope and the legitimate preservation reason.
2. Place the hold through the authorized workflow.
3. For release, submit a release request with its required reason.
4. A distinct authorized decision-maker approves or rejects the request where
   separation of duties applies.
5. Treat the hold as active until the backend records an approved release.

### Preparing an export

1. Confirm that the task requires an export and that the account has People
   exports permission.
2. Select only the necessary People and fields.
3. Review the safe preview or result state before downloading.
4. Keep the downloaded file within the approved business handling process.
5. Do not treat an export as permission to disclose data elsewhere; export
   activity is audited.

## 14. Frequently asked questions

### Why can I see a Person but not the email address?

Record visibility and contact visibility are separate permissions. The API may
return a masked or Restricted value.

### Why did an action disappear?

The backend no longer reports the action as permitted, often because a grant was
revoked, a restriction was added or a proposal became pending or stale.

### Can I approve my own permission proposal?

No. Ordinary governance requires separation of duties. The approved active
Django superuser exception is a separate audited administrative path.

### Does a pending proposal grant access?

No. Pending changes are not effective until the approved operation is applied.

### What does a legal hold do?

It preserves the covered subject from eligible disposal until an authorized
release workflow completes. It does not itself grant broad data visibility.

### Is the system legally GDPR-compliant because these controls exist?

No. Code and documentation support privacy governance but do not replace legal,
organizational or regulatory review.

### Why is my permission change still pending?

Sensitive role-default changes and certain administrator capabilities require a
distinct authorized approver. Pending status means the change has not taken
effect.

### Can a CRM Viewer receive a privacy capability?

An individual grant may be possible when the staff member is eligible and the
approved governance rules are satisfied. The CRM Viewer role itself grants no
privacy capability by default.

### Does a restriction disappear when a grant is restored?

No. An explicit restriction continues to override the grant until it is
separately removed through the authorized workflow.

### Why can I not see a legal-hold release request?

Legal-hold history is permission-aware. A user may be allowed to administer a
hold without being allowed to view unrelated privacy-audit information.

### Can I use the API documentation or Django Admin to bypass CRM rules?

No. Technical access is separately governed. Only the approved active Django
superuser exception permits direct role and privacy-permission administration,
and that activity remains automatically audited.

### Who should approve the retention period?

The current 24-month period is provisional. Formal legal/privacy ownership and
approval have not been assigned in the approved documentation.

## 15. Current limitations and prerequisites

- The provisional 24-month retention period requires legal/privacy approval.
- Production and staging migrations, deployment behavior and cross-repository
  runtime compatibility remain separately verified prerequisites.
- AUTH-001, AUTH-002, GOV-003, GOV-005, uncovered GOV-006 paths and trusted
  provenance runtime/deployment verification retain their documented status;
  unresolved security findings are not risk-accepted here.
- Broader personal-data classifications remain outstanding.
- Final automated hardening, export/audit runtime verification, provider
  verification and any waived UAT scenarios remain subject to their recorded
  gates.

## 16. Glossary and technical references

- **Person:** the canonical human/CRM record.
- **User:** the authentication account linked to a Person.
- **Capability:** a backend-evaluated permission for a defined operation.
- **Restriction:** an explicit denial that overrides a grant or role default.
- **Effective permission:** the result after role, grant, restriction, suspension
  and eligibility rules are evaluated.
- **Privacy audit:** the safe, permission-aware history of privacy operations.
- **Legal hold:** a preservation control that prevents eligible disposal.
- **Masking:** a safe partial presentation that does not disclose the full value.

## 17. Evidence and limitations

| Subject | Current classification | Evidence and limitation |
| --- | --- | --- |
| Backend staff roles and role evaluation | Implemented; source-inspected | API authorization contract; operational deployment is separately unverified |
| CRM capability and privacy projections | Implemented; source-inspected | CRM consumes API state; cross-repository runtime remains unverified |
| Community member session and profile boundaries | Implemented; source-inspected | API and Community guides; production/deployment verification remains unverified |
| Mobile JWT lifecycle and secure-storage policy | Implemented; source-inspected | Mobile auth implementation and repository instructions; no separate Mobile business guide exists |
| Focused API/CRM tests and UAT | Verified as recorded evidence | Existing guides record named isolated runs; this stage did not rerun tests |
| Production/staging and cross-repository compatibility | Unverified | Requires authorized runtime, deployment, and compatibility validation |
| Provisional 24-month retention period | Approved provisionally; not legal approval | Retention remains subject to formal legal/privacy approval; disposal is not enabled |
| Comprehensive Person record-access auditing | Deferred | `GDPR-FUTURE-001`; it does not replace failure or privileged-operation auditing |

The full technical evidence, unresolved findings, unexecuted tests, pending
migrations, operational prerequisites, and security limitations remain in the
[API GDPR guide](../../elevate-mk-api/docs/GDPR.md) and [CRM GDPR guide](GDPR.md).

## Related authoritative documentation

- [API authentication](../../elevate-mk-api/docs/AUTHENTICATION.md)
- [API authorization](../../elevate-mk-api/docs/AUTHORIZATION.md)
- [API GDPR and privacy evidence](../../elevate-mk-api/docs/GDPR.md)
- [API endpoint contracts](../../elevate-mk-api/docs/API.md)
- [CRM GDPR implementation guide](GDPR.md)
- [People Domain staff guide](people-domain-business-guide.md)
- [Brevo CRM business guide](brevo-crm-business-guide.md)
- [Community account lifecycle](../../elevate-mk-community/docs/account-lifecycle.md)
- [Community profile privacy](../../elevate-mk-community/docs/profile.md)
- [Community connections privacy](../../elevate-mk-community/docs/connections.md)
