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
