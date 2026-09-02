# People Domain: CRM Implementation Guide

Last updated: 2026-09-02

## Scope

The Staff CRM People experience is the frontend for the backend-owned Person domain. It is not an independent source of truth: API permissions, BUSINESS-only visibility, identity checks, lifecycle rules, and audit creation remain authoritative on the Django API.

Related guides:

- [People backend guide](../../elevate-mk-api/docs/people-domain-backend.md)
- [People staff business guide](people-domain-business-guide.md)
- [Historical Imports frontend guide](historical-imports-frontend.md)

## Routes and Access

The protected CRM shell contains these Person routes:

- `/people`: People directory.
- `/people/new/contact`: create a Contact.
- `/people/new/member`: create a Person with an active Membership.
- `/people/:id`: Person Overview.
- `/people/:id/edit`: edit Person-owned fields.

CRM staff authentication is required before entering the shell. `CRM_ADMIN`, `CRM_MANAGER`, and `CRM_VIEWER` can read the People experience. The interface enables operational writes only for Admin/Manager; the API enforces the same rule. A Django Admin user or superuser is not automatically an operational CRM user.

## Directory

`PeoplePageComponent` implements a server-side directory with search, filters, ordering, page size, pagination, loading, empty, and retry states. Rows navigate with an actual router link to the Person Overview, preserving keyboard access.

Directory state is URL-owned. `people-directory-query.ts` parses and serializes `q`, repeated `relationship`, `location`, `industry`, `career_stage`, `interest`, `skill`, and `tag`, plus `record_state`, `ordering`, `page`, and `page_size`. The page observes route query parameters, maps them to the typed query state, and uses `switchMap` for the API request. This keeps deep links, browser back/forward, refresh, and stale-request handling deterministic.

The UI defaults to active records, last-name ordering, page 1, and 25 records per page. It uses repeated query keys for multi-select filters, matching the API contract. Do not introduce local filtering or frontend-calculated directory results.

`PeopleDirectoryFiltersComponent` provides explicit search, relationship and career-stage multi-selects, catalog multi-selects, exact-location chips, and clear filters. If a catalog option no longer loads, an unresolved ID remains visible as a removable fallback chip so an existing deep link is not silently changed. Clearing filters retains the selected page size.

Because filter state is shareable in the URL, future CRM areas can link directly to a meaningful People view without inventing a second directory-state mechanism. No Dashboard feature is implied by this readiness.

## Create and Edit

The write page supports two explicit creation modes:

- **Add Contact** creates a Person without a Membership.
- **Add Member** creates the Person and active Membership in the backend's single authoritative workflow.

Editing changes only Person-owned demographics and contact fields. Professional Profile is not edited through the general Person form. The UI sends the API's canonical demographic values; presentation helpers handle labels and accepted user-facing values.

If the create API returns an identity-collision response, the UI presents the candidate evidence for an explicit staff decision. It must not auto-confirm a collision, merge two people locally, or reuse an ID based on name. The confirmation retry uses the backend's reviewed-override contract; stale evidence remains a backend-controlled conflict.

The write workflow composes `PersonFormComponent`, `PersonDuplicateConflictComponent`, and the shared `ConfirmationDialogComponent`. Reuse those components for future Person create flows instead of creating a second override UX.

## Person Overview

The detail route loads `GET /people/{id}/overview/` and renders the current aggregate projection. It contains:

- Identity and Person-owned details, record status, and archive/restore controls where permitted.
- Professional Profile: optional job, company, industry, career stage, and LinkedIn details.
- Skills, Interests, and Tags: current assignments with catalog-backed add/remove actions for authorized staff.
- Membership: derived relationship state, Membership details, Make Member for eligible Contacts, and End Membership for active Members.
- Internal Notes: visible and mutable only for Admin/Manager.
- Audit History: read-only history; the backend omits sensitive Internal Note audit events for Viewer access.

After a successful mutation, the view refreshes the authoritative overview rather than attempting to manually rebuild the aggregate client-side. Archived records remain viewable but the UI does not offer normal mutation actions.

The screen uses the shared `CrmSectionCardComponent`, status badge, state-message, and Person lifecycle-action patterns. Taxonomy assignment components load their catalogs only when an authorized user opens the relevant assignment UI, and reuse the current overview after the mutation succeeds.

## UI and Service Boundaries

`PeopleService` owns the HTTP calls for People, overview, lifecycle, membership, profile, taxonomy assignments, notes, and audit history. Components hold UI state, form validation, pending/error presentation, and navigation only. API models in `core/people/people.types.ts` must retain backend response fields even when a particular screen does not currently display all of them.

The service uses the configured API base URL and the application's session/CSRF HTTP infrastructure. It does not manage the Django `sessionid` directly. Unsafe requests continue using the established credentialed session and CSRF flow.

Age and gender options use the shared Person demographic helpers so UI labels and canonical backend values stay aligned. Do not add a second local copy of those vocabularies.

## Historical Imports Boundary

Historical Imports is an administrative workflow that may create or reuse People after reconciliation. It is not a substitute for normal People create/edit UI. The People directory and overview display the resulting authoritative CRM records; the imports screens retain source-row provenance, review decisions, and batch outcomes.

Do not add source-specific identity resolution or authoritative-import rules to People components. See [Historical Imports frontend guide](historical-imports-frontend.md) and the [backend guide](../../elevate-mk-api/docs/historical-imports-backend.md).

## Extension Rules

When extending this UI:

- Keep directory query state in the URL and backend filtering on the server.
- Keep new relationship domains in their own components/services instead of expanding Person DTOs speculatively.
- Use the overview refresh pattern after mutations.
- Preserve accessible semantic controls, labels, real links, focus states, and pending/error feedback.
- Treat backend `401`, `403`, `404`, and `409` as authoritative outcomes, not cases to work around in the browser.

## Focused Test Coverage

Focused specs cover directory query parsing/serialization, repeated query values and URL behavior, directory component states, Person forms and duplicate confirmation, detail sections, lifecycle actions, notes, and audit history. Existing tests are component/service focused; documentation does not imply that the full Angular suite was run for a documentation change.
