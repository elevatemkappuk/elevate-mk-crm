# Elevate MK CRM UI/UX Polish Handover

Last updated: 2026-09-07

Scope: handover for a new Codex session focused on major Staff CRM UI/UX polish. This is implementation context, not a request to change business rules or API contracts.

## 1. Project Overview

Elevate MK Staff CRM is the internal relationship-management application for People, Membership, professional information, classifications, internal notes, audit history, and controlled historical-data import.

V1 is functionally mature. The next priority is a consistent, polished CRM UI foundation before the Dashboard is built.

- Backend/API repository: `elevate-mk-api` using Django 6.1, Django REST Framework, PostgreSQL, session authentication, and drf-spectacular.
- Frontend repository: `elevate-mk-crm` using Angular 21, standalone components, signals, RxJS, Angular Router, and Vitest.
- Repositories are separate. Frontend work must preserve the API contract; backend remains authoritative for permissions, lifecycle, identity, and import business rules.
- Reuse the existing shared components and patterns where they exist. Do not create parallel behavior for visual reasons.

Major implemented domains: custom User/authentication, People, Membership, Professional Profile/Industry, Skills, Interests, Tags, Notes, Audit Events, staff roles, Historical Imports, Event/EventParticipation, and password recovery.

## 2. Current Functional Status

The following are implemented and should be treated as working behavior:

- People directory with server-side search/filter/order/pagination.
- Person Overview with personal details, Membership, Professional Profile, Skills, Interests, Tags, Internal Notes, Audit History, and archive/restore.
- Add Contact, Add Member, Person edit, duplicate-collision review, and explicit separate-Person override.
- Active/Former Membership lifecycle, Professional Profile create/edit, and taxonomy assignment/removal.
- Role-aware Notes and Audit History presentation.
- Password recovery using the existing session-authentication environment.
- Historical Imports V1, including Membership Form and Eventbrite upload, reconciliation, identity review, validation messages, authoritative Add to CRM, and imported read-only outcomes.
- Event/EventParticipation import domain. Eventbrite can create/reuse People, Events, and participations; it does **not** create Memberships.

Historical Imports V1 is considered functionally complete. Do not turn visual polish into a rewrite of reconciliation or import semantics.

## 3. Current Frontend Architecture

Application routes are in `src/app/app.routes.ts`. Authenticated CRM routes sit inside `StaffCrmShellPageComponent`; `/people` is the default route. People routes are `/people`, `/people/new/contact`, `/people/new/member`, `/people/:id`, and `/people/:id/edit`. Administration and Historical Imports are CRM_ADMIN-only routes.

The shell provides the persistent sidebar, responsive off-canvas menu, page header/title, user panel, and outlet. Current shared UI components live in `src/app/shared/ui/`:

- `CrmSectionCardComponent`
- `ConfirmationDialogComponent`
- `DetailListComponent`
- `StateMessageComponent`
- `StatusBadgeComponent`

People also has focused reusable components: directory filters, Person form, duplicate-conflict view, lifecycle actions, Notes section, and Audit History section. Imports reuse `ConfirmationDialogComponent`, `StateMessageComponent`, import type/label helpers, and one reconciliation service.

Current visual language is light, restrained, and CSS-in-component. `src/styles.scss` supplies only global reset/background/font basics; there is no formal token layer or reusable button/input/table primitive yet. Many components repeat near-identical button, card, table, form-control, spacing, and responsive CSS. This is the main structural opportunity for polishing.

Responsive behavior already exists in the shell, directory, filters, tables, and several feature screens. Preserve it while consolidating patterns; do not assume every component has been manually tested at all breakpoints.

## 4. People Directory UX

The directory is one of the most important screens. Its URL is the **sole source of directory state**.

- `src/app/core/people/people-directory-query.ts` parses and serializes state.
- Query fields: `q`; repeated `relationship`, `location`, `industry`, `career_stage`, `interest`, `skill`, `tag`; plus `record_state`, `ordering`, `page`, and `page_size`.
- Defaults are omitted from canonical URLs: active records, last-name ordering, page 1, page size 25.
- `PeopleService` uses repeated `HttpParams` values for multi-select filters.
- `PeoplePageComponent` observes query parameters and uses `switchMap`, so refresh, browser back/forward, deep links, and stale request cancellation work predictably.
- Filters include explicit search, relationship/career-stage/catalog multi-selects, exact-location chips, record state, ordering, and page size.
- Unresolved catalog IDs remain visible as removable fallback chips instead of silently changing a deep link.
- Clear filters preserves page size.

UI polish must not move this state to component-only memory, change query names, remove repeated values, or locally filter API results. Dashboard links should eventually use these canonical directory URLs.

## 5. Person Detail UX

`PersonDetailPageComponent` loads the backend Person Overview projection and displays a detail page built from section-card/detail-list patterns:

- identity/status and archive/restore actions
- personal details and record information
- Professional Profile
- Skills, Interests, and Tags
- Membership, including Make Member and End Membership
- Internal Notes for CRM_ADMIN/CRM_MANAGER
- Audit History for CRM staff, subject to backend filtering

After a mutation, the page refreshes the authoritative overview rather than reconstructing the aggregate in the browser. Archived People remain viewable but normal mutations are unavailable. Reuse this refresh and loading/error approach when polishing the section layout.

## 6. Person Creation UX

`PersonWritePageComponent` is the shared route component for Add Contact, Add Member, and edit. It composes `PersonFormComponent`, `PersonDuplicateConflictComponent`, shared `ConfirmationDialogComponent`, and state-message behavior.

- Add Contact creates a Person without Membership.
- Add Member creates a Person and active Membership through one backend workflow.
- Possible email/mobile identity collisions show candidate warnings and require staff review.
- **Create separate Person** is an explicit confirmation flow, not an automatic merge or bypass.
- The backend can reject a retry as stale collision evidence; the UI must preserve that controlled error path.

Do not remove confirmation, pending, double-submit, or role guards during visual changes.

## 7. Historical Imports UX

Routes: `/imports`, `/imports/:id`, `/imports/:id/review/:recordId`. They are visible and routable only to CRM_ADMIN in the current frontend.

- Batch list: upload entry point, batch cards, status/counts, loading/empty/error states.
- Upload: Membership Form and Eventbrite choices through the shared upload component.
- Membership Form: upload -> reconciliation/review if needed -> ready -> Add to CRM -> imported/read-only.
- Eventbrite: upload -> `STAGED` -> **Analyze buyers** -> reconciliation/review -> ready -> Add to CRM -> imported/read-only.
- Review: candidate cards, source/evidence, Same Person/Different Person decisions, and confirmation for strong collision decisions.
- Batch preview: Source, Contact, Decision, Destination; invalid rows show backend validation reasons and `Excluded` destination.
- After import, the preview remains as historical `Import results` and shows actual resolved People.
- Add to CRM has confirmation, loading/one-click protection, and safe 409 refresh behavior. It posts to the shared import endpoint with no invented frontend logic.

The shared success banner shows Added to CRM, success copy, Processed, People created, and People matched. Membership Form retains its useful Membership-created/skipped information. Eventbrite deliberately keeps Events/participations/skipped metrics out of the banner even though the API result type retains them for detailed/future reporting.

## 8. Permissions

Frontend visibility is role-aware but is not authorization:

- `CRM_ADMIN`: full current CRM management and Administration/Historical Imports access.
- `CRM_MANAGER`: normal People operational writes, but not administration/import workspace.
- `CRM_VIEWER`: People read access; no normal Person mutation and no Internal Notes.

Django `is_staff` and `is_superuser` are not CRM roles. Membership is not staff access. The API is authoritative for every action, including actions hidden or disabled in the browser.

## 9. Agreed Design Principles

- Major UI polish happens now, before Dashboard.
- Improve structural reuse as part of polish, but do not redesign working business logic.
- Do not rewrite working feature architecture solely for visuals.
- Prefer practical shared primitives over one-off screen styling.
- Establish one consistent, accessible CRM design language.
- Dashboard is built after this foundation and must reuse it.
- A later screen-by-screen final consistency/accessibility pass is expected.
- Avoid a huge late structural refactor by making reusable decisions now.

## 10. Visual Direction

Use the agreed dashboard mockup as direction, not as a literal specification:

- clean professional CRM with a light workspace
- strong hierarchy and compact information density
- restrained card surfaces, subtle borders/shadows, and clear section headings
- polished but practical sidebar/navigation
- accessible contrast and readable type
- consistent spacing and action hierarchy
- responsive layouts

Avoid flashy decoration or a generic dashboard clone. Existing branding is intentionally restrained.

## 11. Recommended Design-System Foundation

First audit the current frontend and propose a small layer that builds on existing shared components:

- colour, typography, spacing, radius, elevation, container-width, and breakpoint tokens
- page header and section/card primitives
- primary/secondary/destructive/quiet button variants
- input, select, checkbox/radio, validation, and form-group primitives
- status badges, chips, tables, pagination, dialogs, banners, and state messages
- sidebar/navigation states and responsive behavior

Prefer SCSS/CSS custom properties and shared components/styles where appropriate. Migrate incrementally: establish a primitive, apply it to a representative screen, then reuse it. Do not require a wholesale rewrite of inline component styles in one step.

## 12. Recommended Polish Order

1. Audit existing UI, shared components, and repeated styles.
2. Define/refine tokens and shared primitives.
3. Polish global shell, sidebar, header, and page containers.
4. Polish People directory.
5. Polish Person Overview.
6. Polish Add Member/Add Contact.
7. Polish Historical Imports.
8. Review responsive/mobile behavior.
9. Build Dashboard using the established system.
10. Perform the later final consistency/accessibility pass.

## 13. Testing and Validation Workflow

- Add or update focused tests when UI behavior changes.
- Do **not** run tests during intermediate polish unless explicitly requested.
- Use lightweight validation while iterating: `npm run build` and `git diff --check`.
- Frontend and backend tests are accumulated for final hardening.

For this handover, no tests were run. A production `npm run build` was run on 2026-09-07 and completed with the warnings recorded below.

## 14. Do Not Break Checklist

- URL-driven People filters and canonical/deep-link behavior.
- Duplicate override confirmation and stale-collision protection.
- Role-aware visibility and backend-authoritative permission outcomes.
- Import reconciliation, source-specific Eventbrite analysis, Add to CRM, and imported read-only state.
- Contact versus Membership distinction; Eventbrite must never create Membership.
- Notes and Audit History role visibility rules.
- Archive/restore lifecycle behavior.
- Loading, pending, and double-submit guards.
- Existing API paths, payloads, and response contracts.

## 15. Current UI Warnings and Technical Debt

Verified from the 2026-09-07 production build:

- Initial bundle is 503.94 kB, 3.94 kB above the configured 500 kB warning budget.
- `person-detail-page.component.ts` styles are 4.11 kB, 107 bytes above the 4 kB `anyComponentStyle` warning budget.

Observed architecture debt, suitable for incremental polish:

- Repeated component-local CSS for primary/secondary buttons, cards, tables, form controls, pagination, and state surfaces.
- No central design tokens beyond global base styles in `src/styles.scss`.
- Several feature components contain large inline templates/styles, especially Person Detail and import pages.
- Responsive handling exists but is per-component; inspect narrow layouts as each screen is migrated.

No current build error was found. Do not attempt bundle reduction by removing required feature behavior; consolidate shared styling first and assess afterward.

## 16. Dashboard Next

Dashboard is the next major functional UI feature, **after** this polish. Current direction: People, Active Members, Contacts, Former Members, growth, community profile, Events, attention items, and quick actions.

It should consume a dedicated backend projection and link to canonical People directory URLs. Do not implement Dashboard in this handover/polish-start task, and do not fabricate metrics from existing list data.

## 17. Recommended First Task

Start by auditing the shell and existing shared UI components, then propose a small token/primitives plan with an incremental migration path. Use the People directory as the first representative feature screen because it exercises forms, filters, chips, tables, pagination, states, and role-aware actions while its behavior is well constrained by URL state.

Inspect first:

- `src/styles.scss`
- `src/app/features/auth/staff-crm-shell-page.component.ts`
- `src/app/shared/ui/`
- `src/app/features/people/people-page.component.ts`
- `src/app/features/people/people-directory-filters.component.ts`
- `src/app/features/people/person-detail-page.component.ts`
- `src/app/features/people/person-write-page.component.ts`
- `src/app/features/imports/`
- `src/app/core/people/people-directory-query.ts`
- `docs/people-domain-frontend.md` and `docs/historical-imports-frontend.md`

Uncertainties to confirm before deciding scope: the precise dashboard mockup/assets are not stored as a frontend specification in this repository; visual token names and final brand typography are not yet formalized. Treat the existing light neutral palette as a starting point, not a final brand contract.
