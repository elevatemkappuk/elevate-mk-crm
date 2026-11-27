# CRM visual foundation

Phase 1 establishes shared presentation only. Routes, API models, permission checks,
feature state, and workflows remain owned by their existing implementations.

## Files and tokens

`src/styles.scss` loads `styles/_tokens.scss`, `styles/_fonts.scss`, and
`styles/_patterns.scss` once.
Tokens use the `--crm-` prefix: semantic workspace/surface/border/text/action colours,
paired feedback foregrounds and surfaces, focus and overlay, spacing (4–48px),
three corner radii plus pill, two elevations, control heights, content widths,
typography, and dialog stacking order. Feedback colours always accompany
text; colour alone must not communicate status.

Manrope is the global application font, self-hosted with `font-display: swap`.
The Latin variable subset is preloaded; Latin Extended loads on demand. Assets,
source URLs, and the licence live in `public/fonts/manrope/`. Typography weights
are 400 (`normal`), 500 (`emphasis`), 600 (`medium`, labels/controls/buttons), and
700 (`bold`, headings). Native form elements inherit the application font.

`styles/_breakpoints.scss` exports `compact` (680px), `medium` (900px), and `wide`
(1200px), expressed in rem. Import it with SCSS `@use` relative to the consuming
file. These are a vocabulary for deliberate future migration; existing feature
breakpoints have not been replaced. The shared detail list retains its 680px threshold.

## Opt-in patterns

- Buttons: `crm-button` plus `crm-button--primary`, `--secondary`, `--quiet`, or
  `--destructive`. Use actual buttons for actions and links for navigation.
- Fields: `crm-field`, `crm-label`, `crm-control` on native input/select/textarea,
  `crm-choice` and `crm-check` for labelled native checkboxes and radios.
- Support: `crm-help`, `crm-error`, `crm-actions` (optional `crm-actions--end`).
  Associate labels and help/errors using native labels and `aria-describedby`;
  expose invalid state with `aria-invalid` using existing validation state.
- Pending: `crm-pending` or `aria-busy="true"` on a styled button changes the cursor.
  Keep meaningful pending copy, native `disabled`, and existing submission guards.
  CSS and `aria-disabled` do not prevent actions or disable links by themselves.
- Supporting UI: `crm-chip`, `crm-table-wrap`/`crm-table`, `crm-pagination`, and
  `crm-banner` (informational by default; `--success`, `--warning`, `--error`).
  Consumers retain table headers/captions and pagination labels. Responsive row
  stacking, column widths, and data loading remain screen-specific.
- Use `role="alert"` only for urgent feedback; use a polite live region for routine
  asynchronous status. Banner classes do not create announcement behavior.
- `crm-focusable` gives links, interactive chips, or scroll regions the shared
  focus ring; it does not make static elements interactive or focusable.

## Page headings

The shell and feature intro/action rows repeat a heading/action arrangement.
Use a CSS pattern, without a new component or page-title service:

```html
<header class="crm-page-heading">
  <div class="crm-page-heading__copy">
    <h1 class="crm-page-heading__title">Page title</h1>
    <p class="crm-page-heading__description">Optional supporting copy.</p>
  </div>
  <div class="crm-actions"><!-- Existing role-aware actions --></div>
</header>
```

Choose the heading level appropriate to the page hierarchy. `crm-page` provides
an optional centred maximum width. No existing feature page adopts this yet.

## Shared components and migration boundaries

The five existing shared UI components consume tokens without changing their
inputs or outputs. Confirmation retains confirm-first initial focus, Escape and
backdrop cancellation, and busy guards. Focus wraps within its two enabled buttons;
the container holds focus while busy. Closing or destroying the dialog restores
the connected opener. IDs are unique per instance. This is the current single-modal
pattern, not a framework for stacked dialogs or arbitrary projected controls.

Later phases migrate shell/navigation, then feature screens. Remove superseded
local styling as each pattern is adopted; do not apply broad global overrides or
import the emitted patterns into every component. Authentication surfaces, shell
gradients/blur, feature-specific inline confirmations, and mobile navigation focus
management are intentionally deferred. Shared surface changes and the neutral
workspace background are the only immediate visual effects outside the dialog.

Focused dialog behavior specs accompany Phase 1. Do not run tests unless requested.
Validate implementation with `npm run build` and `git diff --check`.

## Shared editing drawer

`CrmDrawerComponent` extracts the Add Person modal layout for Add Person, Edit
Person, and Professional Profile. Render it conditionally while open and project
the feature form into it. Supply `title`, `description`, `busy`, and `dirty`;
handle `closed` by removing it. Feature Cancel buttons call `requestClose()`.
`closeBlocked` prevents dismissal while a nested identity confirmation is open.

The drawer owns native `dialog.showModal()` focus containment, initial title
focus, Escape/backdrop/close handling, scroll locking, unique accessible IDs,
and restoring the connected opener. Dirty closes use the existing confirmation
component. It is 36rem wide and becomes full-screen below the compact threshold.
Keep opener controls mounted behind the modal so focus can return after closing.
Forms retain their own API requests, validation, footer actions, and business state.

## Shared operation notifications

The CRM has one shared transient notification pattern: `ToastService` publishes
notifications and `ToastContainerComponent` renders them in the application
shell. Future modules, including Events V1, should use this infrastructure rather
than adding a second toast, snackbar, or ad-hoc notification system.

Use a toast for a short-lived, authoritative operation outcome, such as a
successful save, permission change, approval decision, cancellation, or request
submission. The message must use a concise, business-friendly title and explain
the result in plain language. A successful rejection, revocation, restriction,
or suspension is still a success outcome and therefore uses the success tone.
Pending governance proposals must say that approval is awaiting; they must not
be described as already applied. Never imply that removing a restriction alone
grants effective access.

Use the warning and error tones for operation-level warnings and failures. Do not
put raw API errors, credentials, tokens, personal information, request payloads,
or internal implementation details in a notification. Keep inline validation,
authorization-denied states, page-loading failures, pending indicators, durable
business warnings, and corrective modal errors in their persistent or contextual
location.

After a confirmed successful operation, close the relevant dialog, refresh the
authoritative affected state, and show exactly one outcome toast. Guard duplicate
submissions and keep the modal open with its entered reason when a corrective
failure is returned. A notification is announced through the shared live-region
behavior, has a dismiss control, uses the existing CRM semantic tokens, and
auto-dismisses after a short period; errors remain visible longer. The placement,
focus styling, contrast, responsive layout, and keyboard-accessible dismissal are
shared by the container and must not be reimplemented per feature.

Privacy Administration now uses this standard for confirmed permission changes,
role-default changes, proposal approvals, rejections, cancellations, and pending
approval submissions. Other screens that still use page-local feedback, including
Legal Holds and unrelated save flows, remain documented migration exceptions and
were not changed in this UI-polish stage.

Its four-tab presentation is componentized by ownership: the parent retains tab
navigation, shared governance state, API coordination, authorization refresh and
confirmation dialogs, while Staff Permissions, Role Defaults, and Governance
Requests/History own their templates and feature-specific styles. A small shared
Privacy Administration stylesheet contains common status, notice, and accessibility
patterns. This keeps each component within the existing stylesheet budget without
moving feature styles into global styles.

The filter drawer uses an optional `[drawerFooter]` projection for actions outside
the scrolling body. Existing drawers without projected footer content retain
their form-owned actions. `dialogId` optionally supplies an ID for an opener's
`aria-controls`; `--crm-drawer-width` can refine the desktop width (Filters uses
34rem). Filter drafts intentionally use `dirty=false`, so safe close discards
unapplied selections without the business-form discard confirmation.
