# Elevate MK Staff CRM: Brevo Marketing Frontend Guide

This guide describes the implemented Angular Staff CRM experience for Person
marketing preferences and the boundary between that UI and the asynchronous
Brevo marketing integration. It is a companion to the
[canonical Brevo integration guide](../../elevate-mk-api/docs/brevo-crm-integration.md) and the
[business guide](brevo-crm-business-guide.md).

## Purpose and boundary

The Staff CRM records and displays the CRM's provider-neutral **EMAIL**
marketing preference. It does not call Brevo directly. Elevate's Django API
remains authoritative for Person identity, permissions, consent state, audit
history, and the decision to enqueue Brevo synchronization work.

People is the canonical CRM directory. Audience Preview is the canonical
audience-selection workflow built on People criteria: it evaluates current
eligibility and does not duplicate or store People or create provider data.

The frontend provides the read-only Audience Preview and Campaign V1 review
workflow. It does not provide
sync, provider contact editing, webhook administration, or a “Sync to Brevo”
button. A successful UI save records CRM state; any Brevo work is handled
by the backend services described in the
[technical integration guide](../../elevate-mk-api/docs/brevo-crm-integration.md).

## Actual Angular architecture

The Staff CRM is an Angular 21 standalone-component application. Authenticated
CRM routes are children of `StaffCrmShellPageComponent`. The relevant route is:

```text
/people/:id  -> PersonDetailPageComponent
```

The marketing preference section is mounted inside the Person Overview by
`PersonDetailPageComponent`:

```text
PersonDetailPageComponent
`-- PersonMarketingPreferenceSectionComponent
`-- PersonBrevoIntegrationSectionComponent
```

The component reuses the shared `CrmSectionCardComponent` and
`StatusBadgeComponent`. The page already uses the shared state-message,
detail-list, drawer, and profile patterns for the rest of the profile.

The API boundary is kept in `PeopleService` and typed in
`core/people/people.types.ts`:

- `GET /api/v1/people/{person_id}/overview/` returns the overview projection,
  including `marketing_preference`.
- `POST /api/v1/people/{person_id}/marketing-preference/` records an explicit
  preference state.
- The frontend request body contains `state` only. The backend assigns the
  staff source for this UI path and remains responsible for authorization and
  synchronization-job creation.

The Person Overview also performs a separate read-only inspection through:

```text
GET /api/v1/people/{person_id}/brevo-integration/
```

The Brevo Integration card displays the current provider status, safe
explanation, and the CRM EMAIL marketing preference. It never exposes Brevo
contact IDs, external reference IDs, raw provider errors, or sync-job
terminology. A failed inspection leaves the rest of Person Overview usable.

The frontend source-label map includes the implemented CRM and provider
sources. Staff-recorded preferences display as `Staff recorded`,
Brevo-originated unsubscribes display as `Brevo`, and unknown generic source
values use the `Other` fallback. This is presentation of the backend source;
it does not change stored preference provenance.

## Location and display

Marketing Preferences appears as a section card in the Overview tab of the
Person detail page, alongside Personal details, Membership, and the other
profile sections. It is not a separate marketing page.

The card currently displays:

- **Email marketing preference** as a status badge;
- `Opted in` for `OPTED_IN`;
- `Opted out` for `OPTED_OUT`;
- `Not recorded` for `UNKNOWN`;
- the source when the API supplies one; and
- the recorded date/time when the API supplies one.

`UNKNOWN` is deliberately not rendered as `Opted out`. When neither source
nor recorded time exists, the card says that no email marketing preference has
been recorded.

The UI presents email permission, not general email availability, CRM
membership, or a statement that Brevo has already accepted a contact.

## Role-based actions

The frontend uses the authenticated user's CRM role for presentation:

| Role | Read the card | See/change controls |
| --- | --- | --- |
| `CRM_ADMIN` | Yes | Yes, for an active Person |
| `CRM_MANAGER` | Yes | Yes, for an active Person |
| `CRM_VIEWER` | Yes | No mutation controls |

The browser check is only a usability affordance. The Django API remains the
security boundary and must reject unauthorized writes even if a request is
made outside the Angular application. Archived People remain viewable, but
the preference change action is not offered for an archived record.

## Recording a preference

Admin and Manager staff select **Change preference**, then choose one of the
two explicit states:

- **Opted in** — the Person has given permission for marketing email.
- **Opted out** — marketing email must not be sent.

The form does not offer an `UNKNOWN` or “clear” action. Staff should not use
membership, a populated email field, or the existence of a Brevo contact as a
substitute for consent evidence.

On save, the component posts the selected state to the marketing-preference
endpoint. It disables the submit action while the request is pending, shows
the existing validation/authorization/general-error messages, and emits the
authoritative preference returned by the API. The Person page updates its
overview state from that response rather than reconstructing the preference
locally.

The backend records the source as `STAFF_RECORDED`, appends meaningful
provider-neutral preference history, and enqueues the applicable Brevo
marketing job. The browser does not wait for the provider API call and does
not claim that provider synchronization has already succeeded.

## Profile edits and automatic Brevo profile work

Person-owned edits continue through the existing **Edit personal details**
drawer and `PeopleService.updatePerson` path. The relevant CRM-owned fields
for the Brevo profile integration are:

- `primary_email`;
- `first_name`;
- `last_name`; and
- `mobile`.

After a successful edit, the Person Overview refreshes from the API. When one
of those fields has actually changed, the backend coalesces a durable
`PERSON_PROFILE` job for the active Brevo contact. The UI does not expose that
job as a foreground operation and does not add provider-specific fields to
the Person form.

Profile synchronization is deliberately separate from consent:

- editing a name or mobile number does not opt a Person in;
- having a mobile number does not grant SMS or email consent;
- profile synchronization does not change Brevo subscription, blocklist, or
  list-unsubscribe state; and
- an unsafe or ambiguous mobile value is omitted from the optional provider
  mapping rather than guessed.

Email identity changes are especially conservative. The backend reconciles
the existing Brevo contact identity and can require manual reconciliation; the
frontend should present the API outcome rather than silently treating an
email edit as a new provider contact.

## Unsubscribe and restrictive states

The frontend has no unsubscribe button and does not receive Brevo webhooks
itself. A Brevo marketing unsubscribe reaches the authenticated Django webhook
endpoint, where the backend resolves an exact normalized BUSINESS Person and
records `EMAIL=OPTED_OUT` with source `BREVO`. The Person Overview shows the
result on its next load or refresh.

An opt-out is restrictive. CRM opt-in or a profile edit must not silently
resubscribe a contact that Brevo marks as unsubscribed, cleaned, or otherwise
protected. The frontend should communicate API outcomes as CRM/provider
state; it must not offer a control that bypasses those protections.

Campaign reconciliation follows a deliberate review path:

```text
Campaign recipient needing attention
    -> Review person
    -> Person Overview / Brevo Integration
    -> resolve the underlying issue through the approved workflow
    -> Back to Campaign
    -> retry preparation when appropriate
```

`RESTRICTED` is review-only: the frontend does not offer unblock or
resubscribe actions. `CONTACT_MISSING` may show that an administrator can
reconcile the connection when the backend authorizes that guidance, but the
repair action is reserved for Phase 3C.3. `IDENTITY_CONFLICT` remains a
manual administrative escalation in Campaign V1. Historical Campaign reason
codes are not rewritten by this current Person inspection.

Campaign navigation passes only a validated numeric Campaign ID as the
internal `campaign` query parameter. Person Overview shows `Back to Campaign`
only for that validated context; normal Person navigation does not show it.

## Loading, errors, and responsive behavior

Person Overview uses the existing page-level loading, not-found, and error
state patterns. The marketing section follows the existing section-card
layout, native form controls, visible focus styles, and pending-submit guard.
Save failures are presented inline with `role="alert"`; successful saves use
the existing status feedback pattern. A `403` explains that the user no
longer has permission, a validation response asks for a valid preference, a
missing Person is reported as unavailable, and other failures use a safe
retry-oriented message.

The preference heading and metadata wrap at narrow widths. On mobile, action
buttons become full-width and the edit choices remain native labelled radio
controls. The component does not require a horizontal marketing table or a
separate responsive layout.

## Accessibility and reusable patterns

The implemented section uses:

- a semantic section-card heading;
- a labelled `fieldset` and `legend` for the two choices;
- native radio inputs and buttons;
- visible keyboard focus treatment;
- status feedback with `role="status"`; and
- error feedback with `role="alert"`.

Future changes should continue to reuse `CrmSectionCardComponent`,
`StatusBadgeComponent`, `PeopleService`, the typed People models, and the
Person Overview refresh pattern. Do not add a second local permission model,
provider HTTP client, or hand-built consent vocabulary in a feature component.

## Capability matrix

| Capability | Current frontend behavior | Owner |
| --- | --- | --- |
| View effective email preference | Implemented in Person Overview | Django API projection + Angular display |
| View source and recorded time | Implemented when returned | API response + section card |
| Record opt-in/opt-out | Implemented for Admin/Manager | API authorization and preference service |
| Viewer read-only experience | Implemented | Frontend affordance + API enforcement |
| Backend audience selection and preview | Implemented as a read-only API and Staff CRM page | Django audience preview endpoint + Angular route |
| Provider contact creation/update | Not a UI action | Backend Brevo worker |
| Brevo sync progress/result | Not shown in Person Overview | Durable backend job/admin inspection |
| Webhook receipt/replay handling | Not a UI action | Django webhook service |
| Campaign V1 audience review and preparation actions | Implemented for Admin/Manager; Viewer is read-only | Django Campaign API + backend orchestration |
| Brevo campaign design, sending, scheduling | Not an Elevate UI action | Brevo |
| Bulk sync, saved audiences, segments, journeys | Not implemented | Future backend/product work |

## Future frontend direction

Potential later UI work includes safe display of synchronization outcomes,
admin-oriented job inspection, and richer audit evidence if the backend
exposes a stable staff-facing contract. Those additions must preserve CRM
authority and must not turn Brevo into a second Person editor.

The backend now provides a stateless read-only audience preview at
`POST /api/v1/marketing/audiences/preview/`. It reuses the People selection
criteria, evaluates active BUSINESS People against CRM EMAIL consent, and
returns selected, eligible, and excluded counts with exclusion reasons. It
does not call Brevo or create synchronization jobs.

The Staff CRM route `/marketing/audience-preview` is implemented as a
read-only, URL-backed preview. Staff can open it from navigation or from the
People directory; the latter preserves compatible filters while resetting the
directory page and active/archived state. The page shows backend-selected,
eligible, and excluded counts, exclusion reasons, result views, and backend
pagination. CRM Admins and Managers can continue from an eligible preview to
`/marketing/campaigns`, supply a campaign name, and store the normalized
criteria as a Campaign. Campaign history is available at `/marketing/campaigns`
and review is available at `/marketing/campaigns/:id`; the Campaign detail page
can perform CRM-only **Prepare recipients**, re-checking current consent and
showing backend-authoritative snapshot counts and decisions. Viewers remain
read-only. Angular never calls Brevo directly. Admins and Managers may
deliberately choose **Prepare in Brevo** from `SNAPSHOT_READY`; the same action
is available as **Retry Brevo preparation** after a provider failure or
`RECONCILIATION_REQUIRED`. **Needs attention** is a read-only review of the
included snapshot recipients that still need a safe Brevo identity/provider
resolution. Staff must resolve the underlying issue through supported
CRM/Brevo workflows; Angular does not repair, unblock, resubscribe, merge, or
relink contacts. The deliberate retry re-checks unresolved recipients,
preserves completed preparation work, and keeps the whole campaign blocked
until every included recipient is safe. Restrictive Brevo states are never
automatically cleared. The UI refreshes from the backend and does not edit
consent, recipient decisions, or provider contact state.

Provider-facing staff labels are **Recipients ready**, **Preparing in Brevo**,
**Ready in Brevo**, **Brevo preparation failed**, **Needs attention**, and **No
recipients ready**. A prepared campaign may show a backend-supplied editor URL;
when it is unavailable, the UI does not guess one and instead directs staff to
open Brevo Campaigns. Brevo remains responsible for email design, final
subject/content, preview/test, scheduling, and sending.

Saved segments, engagement analytics, bulk preference editing, direct
Mailchimp/Brevo calls from Angular, automatic reconciliation repair, and
automated journeys are not implemented by this guide.

## Campaign V1 staff workflow

Campaign V1 is the frontend expression of the CRM-owned **WHO** / Brevo-owned
**WHAT/WHEN** boundary. Staff select and preview an audience in
`/marketing/audience-preview`; Admins and Managers can continue to
`/marketing/campaigns`, name the Campaign, and review the resulting immutable
snapshot at `/marketing/campaigns/:id`.

The Campaign page supports **Prepare recipients**, then **Prepare in Brevo**
or **Retry Brevo preparation** when the backend says that retry is supported.
The UI displays selected/included/excluded counts, provider-ready and issue
counts, immutable recipient decisions, and safe reconciliation reasons. A
`RECONCILIATION_REQUIRED` campaign is intentionally blocked as a whole in V1;
completed work is preserved by backend retry, but the ready subset is not a
sendable partial campaign.

The read-only “Recipients needing attention” section may show the snapshot
Person name and safe staff guidance. It must not expose provider contact IDs,
external-reference IDs, raw provider errors, or provider payloads. The
**Review person** link carries only a validated numeric Campaign ID. Person
Overview can show the live read-only Brevo Integration card and a safe **Back to
Campaign** link.

Safe live inspection reasons are presented with human-readable wording:

- `BREVO_CONTACT_RESTRICTED`: Brevo currently restricts marketing email;
  Elevate will not automatically unblock or resubscribe the contact.
- `BREVO_CONTACT_NOT_FOUND_FOR_EXISTING_REFERENCE`: the CRM reference points
  to a provider contact that cannot be found and needs review.
- `BREVO_EMAIL_IDENTITY_MISMATCH`: the linked Brevo contact uses a different
  email identity from the current CRM email; verify both identities before any
  change.
- `BREVO_CRM_EMAIL_MISSING`: review the current CRM email before reconciliation.
- `BREVO_CONTACT_LINKED_TO_OTHER_PERSON`: escalate for administrative review;
  never force-merge or relink from the Campaign page.
- `BREVO_CONTACT_IDENTITY_CONFLICT`: use the generic safe identity-review
  guidance when no more specific explanation is safe.

The Person Brevo Integration endpoint is a strictly read-only GET. The card
does not add repair, revoke, relink, unblock, resubscribe, or sync controls.
After an administrator resolves an issue through an actually supported
workflow, return to the Campaign and use the backend-supported retry. If no
repair workflow exists, the UI directs staff to the integration owner rather
than inventing an action.

Campaign provider preparation creates or reuses one dedicated Brevo list and
an editable starter-template draft. The broad marketing list is never the
campaign recipient target. The starter subject is the Campaign name only as a
provider-required deterministic placeholder; final subject/content, preview,
test, scheduling, and sending remain in Brevo. Angular never sends or
schedules the campaign.

## Campaign lifecycle workflow

Campaigns default to the **Active** view. Staff can switch to **Archived**;
the selection is reflected in the URL and requests the backend lifecycle filter.
Archive is reversible and removes a Campaign from Active Campaigns while
preserving its workflow status, recipient snapshot, preparation/history, and
Brevo resources. Archived Campaigns remain open for historical review.

On Campaign Detail, the backend capability flags control lifecycle actions:
**Archive campaign**, **Restore campaign**, and **Delete draft**. Delete draft
is shown only when the backend says the Campaign is a genuinely unused draft;
the frontend does not recreate the historical-evidence rule. Prepared or
historical Campaigns are archived rather than deleted. Archive, restore, and
delete use confirmations and prevent duplicate submission.

An archived Campaign clearly shows both concepts—for example, workflow
**Ready in Brevo** and lifecycle **Archived**. Preparation, recipient counts,
snapshot rows, reconciliation information, and Review person navigation remain
visible, while Prepare recipients, Prepare in Brevo, and Retry Brevo preparation
are hidden. Staff restore the Campaign before continuing workflow operations.
Viewer staff remain read-only; Admin and Manager actions are still constrained
by the backend capability flags. Lifecycle conflicts refresh the Campaign and
show safe staff-facing error text.
