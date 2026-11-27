# Elevate MK CRM agent guidance

Read [`docs/ui-foundation.md`](docs/ui-foundation.md) before implementing or
refining CRM workflows. It is the authoritative source for shared buttons,
semantic action colours, tables, confirmation dialogs, status badges,
accessibility, loading guards, toast feedback and historical presentation.

Reuse the existing shared components, CSS classes and `--crm-` design tokens.
Do not create feature-local colour systems or duplicate dialog/toast patterns.
Preserve backend authorization, privacy boundaries, API contracts, keyboard
accessibility, responsive behavior and the separate TypeScript, HTML,
CSS/SCSS and component-test file convention. Larger visual inconsistencies,
business-rule changes or architecture changes require separate authorization.
