# Elevate MK CRM: Brevo Marketing Business Guide

This is the plain-language operating guide for the implemented Elevate MK CRM
and Brevo Marketing integration. It complements the
[technical integration reference](../../elevate-mk-api/docs/brevo-crm-integration.md) and the
[Staff CRM frontend guide](brevo-crm-frontend-guide.md).

## What the integration does

Elevate CRM remains the authoritative home for a Person, the Person's normal
contact details, and the Person's EMAIL marketing preference. Brevo is used to
deliver marketing communications and to hold a deliberately limited marketing
contact profile.

The current integration can:

- create or update an eligible Brevo marketing contact through controlled
  backend synchronization;
- keep approved Person name and mobile profile fields aligned without copying
  unrelated CRM data;
- receive a Brevo marketing unsubscribe and record it as a CRM opt-out; and
- process synchronization durably through a backend worker rather than making
  staff wait for a provider request in the browser.

Campaign V1 is available for CRM audience review and preparation of an
editable Brevo draft. Bulk sync, segments, journeys,
engagement analytics, or an Angular “sync now” action; the Staff CRM provides
a read-only audience eligibility preview based on People criteria.

## Staging-proven operation

The core Elevate-to-Brevo marketing flow has been exercised successfully in
staging. Staff recorded `EMAIL=OPTED_IN`, the durable Brevo job was processed,
the contact was added to the staging marketing list, and the approved profile
fields were synchronized. A later Person first-name edit updated the same
Brevo contact.

A real staging campaign unsubscribe was also verified: Brevo blocklisted the
contact, delivered the Marketing Email `Unsubscribed` webhook, and Elevate
recorded `EMAIL=OPTED_OUT` with source `Brevo`. The Person remained in CRM and
no outbound echo/resubscribe job was created.

Staging uses dedicated Brevo resources/configuration within the Brevo account,
not a separate Brevo environment. Its current marketing list is
`ELEVATE STAGING | Marketing Contacts`. No credentials are stored in this
guide.

## Why the boundary matters

The CRM and the provider have different jobs:

- CRM identity answers **which person is this?**
- CRM consent answers **may Elevate send marketing email?**
- Brevo answers provider delivery and contact-state questions.

Having an email address, being a Member, or appearing in a Brevo contact list
does not by itself prove marketing consent. Membership status is not a
marketing preference.

Transactional Brevo email remains a separate existing infrastructure. This
marketing integration must not be used to infer or change transactional-email
behavior.

## Consent and the staff workflow

The implemented CRM preference is for **EMAIL** and has three business-facing
states:

- **Not recorded** (`UNKNOWN`): Elevate has no explicit preference evidence.
- **Opted in** (`OPTED_IN`): permission for marketing email is recorded.
- **Opted out** (`OPTED_OUT`): marketing email must not be sent.

For an explicit staff record, CRM Admin and CRM Manager staff open the Person
Overview, review the context, choose **Change preference**, and select Opted in
or Opted out. The form explains the meaning before saving. CRM Viewer staff can
see the result but cannot change it.

The system records the staff source and preference history. Repeating the same
meaningful state is designed to be idempotent rather than creating noisy
duplicate history. The backend then creates durable Brevo work where the
current state is eligible. Staff do not need to create a Brevo contact by
hand.

Do not choose Opted in merely because:

- the Person is an active Member;
- an email address is present;
- a previous campaign included the contact; or
- Brevo currently shows a provider contact.

If the evidence is not available, leave the preference as Not recorded.

## Contact and profile updates

Elevate's Person record is the source of truth for the supported provider
profile fields:

- primary email;
- first name;
- last name; and
- mobile, only when it can be represented safely for Brevo.

Staff edit these fields in the normal Person profile workflow. A changed name
or mobile can create a background profile synchronization job for an existing
Brevo contact. This profile work does not grant consent, subscribe anyone, or
change a Person's CRM preference.

The provider profile is intentionally minimal. Membership, tickets, events,
professional details, notes, tags, and other CRM classifications are not
automatically copied into Brevo by this integration.

### Mobile numbers

`Person.mobile` is treated as a mobile-number field for the approved Brevo
`SMS` profile attribute. It is profile data, not SMS marketing permission.

Numbers already carrying an international country code can be formatting-
normalized. Ambiguous local numbers are omitted rather than assigned a guessed
country. The current system must not convert every leading zero to `+44`,
because Elevate may hold contacts from different countries. A future
country-aware normalization improvement remains planned.

If mobile is blank, profile synchronization can clear the provider's stale SMS
attribute. An unsafe mobile value does not block the Person's approved email
profile synchronization.

## Unsubscribe handling

When Brevo reports a supported marketing campaign unsubscribe, the backend:

1. authenticates the webhook request;
2. validates the unsubscribe event and reliable timestamp evidence;
3. resolves an exact normalized email match to one BUSINESS Person;
4. records `EMAIL=OPTED_OUT` with source `BREVO`;
5. records bounded receipt/fingerprint evidence; and
6. suppresses a new outbound Brevo echo job for that provider-originated event.

The real campaign unsubscribe shape may omit `list_id`. That is accepted when
the event, email, and reliable timestamp evidence are valid. If Brevo supplies
a list ID, it is still checked against the configured marketing list scope.
An ambiguous or non-exact identity is not guessed or assigned to a Person.

The webhook uses durable fingerprints for replay protection. The provider
payload's numeric webhook `id` is not treated as a globally unique event ID.
An exact replay is ignored, while a later legitimate unsubscribe with distinct
timestamp/campaign evidence can still be processed after re-consent.

The Brevo webhook must use the complete URL:

```text
https://<api-host>/api/v1/webhooks/brevo/marketing/
```

It uses HTTP Basic authentication, with credentials supplied through
environment configuration. Brevo must send the **Marketing Email ->
Unsubscribed** event. During staging setup, configuring only the API root
caused Brevo delivery to fail while the unsubscribe remained visible in
Brevo; Railway showed no request to the expected route and CRM remained
opted in. Correcting the full URL fixed delivery.

OpenAPI/schema-generation warnings for the raw webhook view are not evidence
of a failed webhook delivery.

### Webhook troubleshooting

| Symptom | First check |
| --- | --- |
| Contact missing in Brevo | Preference eligibility, Brevo sync job, worker, provider configuration, and list configuration |
| Profile change missing | `PERSON_PROFILE` job and worker; profile edits update existing contacts only |
| Brevo unsubscribe/blocklist but CRM remains opted in | Brevo webhook delivery |
| Brevo delivery failed and Railway shows no POST | Complete webhook URL |
| `401` | Basic Auth configuration |
| `404` | Webhook route/URL |
| `400` | Payload validation/parsing |
| `5xx` | Application error/logs and provider retry |
| Webhook succeeds but Person is unchanged | Exact BUSINESS-email resolution, receipt processing, and event eligibility |

## Opt-out protection and provider states

Opted out is a restrictive business outcome. The integration does not
automatically resubscribe an unsubscribed, cleaned, blocklisted, or otherwise
protected provider contact merely because staff later edit a profile or record
an opt-in. Provider restrictions must be respected and reconciled deliberately
under a future controlled workflow if needed.

Brevo delivery/provider state is not silently imported as general CRM consent.
The supported inbound consent outcome is the authenticated marketing
unsubscribe path described above.

In the Person Overview, staff-recorded preferences display as **Staff
recorded**, Brevo-originated unsubscribes display as **Brevo**, and other
generic provenance retains the **Other** fallback. A generic `OTHER` source is
not treated as proof that Brevo was involved.

## Where staff should act

| Need | Staff action |
| --- | --- |
| Record explicit email permission | Use Marketing Preferences on the Person Overview |
| Correct a name, email, or mobile | Edit the authoritative Person profile |
| Review current relationship or membership | Use the Person Overview/Membership sections |
| Investigate provider synchronization | Ask an authorized technical/operator owner to inspect backend jobs and references |
| Report an unsubscribe | Use the normal Brevo unsubscribe mechanism; the webhook carries it into CRM |
| Select/review campaign audience and CRM eligibility | Use Audience Preview and Campaign review |
| Prepare recipients or prepare/retry in Brevo | Admin/Manager Campaign actions |
| Change campaign content, preview/test, schedule, or send | Use Brevo after the draft is prepared |

Do not edit a provider contact as a substitute for correcting the CRM Person.
Do not create a second Person because a provider record appears unfamiliar.
Identity reconciliation is deliberately conservative.

## Delays, failures, and operational responsibility

CRM saves and consent changes commit to Elevate first. Brevo synchronization
then runs as durable background work. A successful staff save therefore means
the CRM decision was recorded; it does not necessarily mean that Brevo has
already updated.

Technical operators should monitor the Brevo worker and inspect failed or
pending `ExternalPersonSyncJob` records using the established backend/admin
tools. Temporary provider or network failures follow the durable retry model.
Validation, identity conflicts, protected provider states, and reconciliation
requirements are not fixed by repeatedly clicking a frontend action.

If Brevo is unavailable:

- keep the authoritative Person and consent decision in CRM;
- do not manually weaken opt-out protections;
- do not copy credentials or provider responses into staff notes; and
- escalate the job/error details to the integration owner for controlled
  recovery.

## Auditability and privacy

Meaningful preference changes append provider-neutral history and can be traced
to the recorded source and actor where applicable. Provider-originated
unsubscribe handling retains bounded event evidence and replay fingerprints,
not raw webhook bodies or raw recipient email addresses.

The Brevo profile mapping is intentionally minimized. It excludes membership,
event, ticket, professional-profile, note, tag, and other unrelated CRM data.
Provider credentials, webhook Basic Auth secrets, and API responses containing
unnecessary contact data must not be put into logs, notes, screenshots, or
support tickets.

Staff should access Person and consent information only for legitimate CRM
work. CRM Viewer is read-only. Django technical administration access is a
separate concern from the operational CRM roles.

## Current capability summary

| Area | Status today |
| --- | --- |
| CRM-owned Person identity/profile | Authoritative in Elevate |
| EMAIL preference recording | Staff Admin/Manager workflow implemented |
| Preference visibility | Person Overview for CRM staff |
| Brevo one-Person marketing sync | Implemented through backend service/worker |
| Brevo profile updates | Implemented for approved minimal fields |
| Inbound marketing unsubscribe | Implemented with exact identity and replay protection |
| CRM audience selection and EMAIL eligibility preview | Implemented as a read-only backend API and Staff CRM page |
| Transactional Brevo email | Existing separate infrastructure, unchanged |
| Mailchimp | Frozen rollback/reference implementation, not active automatic provider |
| Campaign V1 audience snapshot and Brevo draft preparation | Implemented for Admin/Manager; Viewer is read-only |
| Brevo content, preview/test, scheduling, and sending | Brevo-owned; not performed by Elevate |
| Bulk sync, saved audiences, segments, journeys | Not implemented |
| Opens, clicks, delivery analytics, general webhooks | Not implemented |

## Planned direction and limits

Future work may add audience operations, reconciliation tooling, richer
operational visibility, country-aware phone normalization, or campaign
capabilities. Each would require an explicit domain and permission decision.
None should make Brevo authoritative for Person identity or turn a provider
contact into proof of consent.

### Audience preview available to Staff CRM users

Elevate can now calculate a current marketing audience from active BUSINESS
People using the existing CRM selection criteria. The backend separately
classifies selected People as eligible or excluded according to CRM EMAIL
consent and usable email presence.

The preview is available through a read-only backend endpoint. It reports
selected, eligible, and excluded counts and explains exclusions such as:

- no usable primary email;
- explicit opt-out; or
- consent not recorded.

Staff can open the read-only Audience Preview page from the Staff CRM
navigation or from the People directory. It does not send email and does not
contact Brevo. Previewing an audience does not create a contact,
change consent, enqueue synchronization work, or reserve a campaign audience.
Provider unsubscribe/blocklist state is evaluated separately during provider
synchronization and is not confused with CRM consent eligibility.

The future operating model is expected to let staff select CRM criteria in the
Staff CRM, review the eligibility breakdown, and only then authorize a later
bulk synchronization workflow. That bulk workflow is not implemented yet and
must re-evaluate current CRM state before sending provider work.

The current rules remain:

1. Elevate owns Person identity and normal contact data.
2. Consent must be explicit; membership is not consent.
3. Opt-out is restrictive and must not be silently reversed.
4. Provider-originated unsubscribe must not echo back into an outbound job.
5. Exact identity matching is required; no fuzzy/name/phone guessing.
6. Only the approved minimal profile is synchronized.
7. Transactional Brevo and frozen Mailchimp behavior are separate.

## Campaign V1: what staff own and what Brevo owns

The operating boundary is simple: Elevate owns **WHO** and Brevo owns
**WHAT/WHEN**. Staff use Audience Preview to review People criteria and CRM
EMAIL eligibility, name a Campaign, prepare an immutable recipient snapshot,
and—when appropriate—prepare recipients in Brevo. The preparation re-checks
current consent and creates or reuses a dedicated Brevo recipient list and an
editable draft. The broad marketing list is never the campaign target.

After the Campaign is **Ready in Brevo**, staff edit the starter template,
choose the final subject and content, preview/test, schedule, and send in
Brevo. Elevate does not send or schedule the campaign and does not become an
email-content editor. The initial Campaign name is only a deterministic,
provider-required editable subject placeholder.

Campaign statuses distinguish CRM evidence from provider readiness. A
`SNAPSHOT_READY` campaign has an immutable CRM snapshot but is not yet ready in
Brevo. `PREPARED` means all included recipients are provider-ready and a draft
exists or was reused. `RECONCILIATION_REQUIRED` blocks the whole V1 campaign;
it is not permission to send the safe subset. A retry preserves the snapshot,
dedicated list, and completed safe work, then re-evaluates unresolved recipients
and current consent.

## When a Campaign needs attention

The Campaign page may show safe, staff-facing reasons such as:

- Brevo currently restricts marketing email. Elevate will not automatically
  unblock or resubscribe the contact.
- The CRM reference points to a provider contact that cannot be found. Review
  the underlying integration state; do not guess or create a replacement link.
- CRM and Brevo email identities differ. Verify the current CRM email and the
  linked provider contact before any identity change.
- A current CRM email is missing, or the contact is linked to another Person.
  Review with the integration owner and never force-merge or relink.

The Person Overview Brevo Integration card is a read-only inspection. It does
not repair, revoke, relink, unblock, resubscribe, or expose provider IDs/raw
payloads. Staff should resolve the underlying issue through an existing,
authorized CRM/provider workflow, then return to the Campaign and retry only
when the backend reports that retry is supported. If no supported repair
workflow exists, escalate rather than inventing one.

## Current limitations and future work

Campaign V1 does not include saved audiences, partial campaign readiness,
automatic provider repair, post-preparation consent removal from the mutable
provider list, list cleanup, or campaign automation. Country-aware E.164
normalization and a stronger explicit administrative identity-repair workflow
remain separate future work. See the [Campaign V1 foundation](../../elevate-mk-api/docs/campaign-v1-foundation.md)
and [technical integration guide](../../elevate-mk-api/docs/brevo-crm-integration.md)
for the authoritative state and provider contracts.
