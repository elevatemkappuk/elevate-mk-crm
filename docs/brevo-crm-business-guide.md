# Elevate MK CRM: Brevo Marketing Business Guide

This is the plain-language operating guide for the implemented Elevate MK CRM
and Brevo Marketing integration. It complements the
[technical integration reference](brevo-crm-integration.md) and the
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

It does not currently provide campaigns, audience selection, bulk sync,
segments, journeys, engagement analytics, or an Angular “sync now” action.

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

## Opt-out protection and provider states

Opted out is a restrictive business outcome. The integration does not
automatically resubscribe an unsubscribed, cleaned, blocklisted, or otherwise
protected provider contact merely because staff later edit a profile or record
an opt-in. Provider restrictions must be respected and reconciled deliberately
under a future controlled workflow if needed.

Brevo delivery/provider state is not silently imported as general CRM consent.
The supported inbound consent outcome is the authenticated marketing
unsubscribe path described above.

## Where staff should act

| Need | Staff action |
| --- | --- |
| Record explicit email permission | Use Marketing Preferences on the Person Overview |
| Correct a name, email, or mobile | Edit the authoritative Person profile |
| Review current relationship or membership | Use the Person Overview/Membership sections |
| Investigate provider synchronization | Ask an authorized technical/operator owner to inspect backend jobs and references |
| Report an unsubscribe | Use the normal Brevo unsubscribe mechanism; the webhook carries it into CRM |
| Change campaign content or audience | Not available in this integration yet |

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
| Transactional Brevo email | Existing separate infrastructure, unchanged |
| Mailchimp | Frozen rollback/reference implementation, not active automatic provider |
| Bulk sync, campaigns, audience selection, segments, journeys | Not implemented |
| Opens, clicks, delivery analytics, general webhooks | Not implemented |

## Planned direction and limits

Future work may add audience operations, reconciliation tooling, richer
operational visibility, country-aware phone normalization, or campaign
capabilities. Each would require an explicit domain and permission decision.
None should make Brevo authoritative for Person identity or turn a provider
contact into proof of consent.

The current rules remain:

1. Elevate owns Person identity and normal contact data.
2. Consent must be explicit; membership is not consent.
3. Opt-out is restrictive and must not be silently reversed.
4. Provider-originated unsubscribe must not echo back into an outbound job.
5. Exact identity matching is required; no fuzzy/name/phone guessing.
6. Only the approved minimal profile is synchronized.
7. Transactional Brevo and frozen Mailchimp behavior are separate.
