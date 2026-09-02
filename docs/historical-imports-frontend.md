# Historical Imports - Frontend Technical Guide

Last updated: 2026-09-02

Scope: implemented V1 Angular Staff CRM Historical Imports workspace. Backend behavior is documented in the [Historical Imports - Backend Technical Guide](../../elevate-mk-api/docs/historical-imports-backend.md); operational meaning is in the [Historical Data Imports - Business & Founder Guide](historical-imports-business-guide.md).

## Workspace Purpose

Historical Imports lets CRM_ADMIN staff upload supported workbooks, inspect identity decisions, resolve uncertain People, and run the backend-authoritative Add to CRM action. The UI never decides identity or writes CRM domain data directly.

## Routes And Shared Architecture

All routes are inside the authenticated Staff CRM shell and use the administration guard:

| Route | Component | Purpose |
| --- | --- | --- |
| `/imports` | `HistoricalImportsPageComponent` | Batch list and upload entry point. |
| `/imports/:id` | `ImportBatchPageComponent` | Batch lifecycle, resolution preview, analysis, Add to CRM, result state. |
| `/imports/:id/review/:recordId` | `ImportReviewPageComponent` | One uncertain identity decision. |

`ImportReconciliationService`, import types, batch-status labels, resolution/evidence labels, `StateMessageComponent`, and `ConfirmationDialogComponent` are shared. Membership Form and Eventbrite are source choices in the same upload component and use the same batch, preview, reconciliation, confirmation, import, and imported/read-only patterns.

## Source Workflows

### Membership Form

```text
Upload -> identity analysis/review -> resolve conflicts
  -> Ready to add to CRM -> Add to CRM -> Imported/read-only
```

Membership Form upload starts the existing backend staging/analysis flow. The batch page shows review links when required and enables Add to CRM only when backend status is `READY_FOR_IMPORT` and the current user is CRM_ADMIN.

### Eventbrite

```text
Upload -> STAGED -> Analyze buyers -> review if required
  -> Identity review complete / Ready to add to CRM
  -> Add to CRM -> Imported/read-only
```

Eventbrite analysis is explicit because upload is staging only. A `STAGED` Eventbrite batch shows `Analyze buyers`. After analysis and any reconciliation, the same Add to CRM action appears for `READY_FOR_IMPORT` CRM_ADMIN users.

## Resolution Preview And Reconciliation

The batch detail preview has Source, Contact, Decision, and Destination columns. It shows automatic matches, new-Person decisions, pending review, and invalid rows as `Excluded`. Backend-provided allowlisted validation messages appear below `Invalid`. After import, actual resolved People are shown as destinations and the section becomes `Import results` with historical wording.

The review page displays source data, candidate cards, match/conflict evidence, candidate Person links, and `Same person` / `Different person` actions. Strong email collision decisions require the reusable confirmation dialog. A stale or otherwise safe backend conflict is displayed to staff; the backend remains authoritative.

## Add To CRM

The shared `importBatch()` service posts no invented request body to `POST /api/v1/imports/{batch_id}/import/`. The batch page supplies one-click/loading protection, the reusable accessible confirmation dialog, and a 409 handler that refreshes batch state.

- Membership Form confirmation describes People, Membership, and professional information.
- Eventbrite confirmation describes buyers, Events, and event registrations, and explicitly says Membership is not created or changed.
- On success, the returned batch replaces local state, records and review data are refreshed, and `IMPORTED` becomes read-only.

Only backend authorization is authoritative. CRM_ADMIN visibility is a convenience layer, not a substitute for the endpoint permission check.

## Success Presentation

The shared success panel always shows `Added to CRM`, success copy, `Processed`, `People created`, and `People matched`.

Membership Form additionally retains its existing Membership-created and skipped metrics. Eventbrite deliberately does not show Event, EventParticipation, or skipped metrics in this banner. The complete backend Eventbrite result fields remain in `AuthoritativeImportResult` and component state for detailed reporting or future UI; the UI does not recalculate them from preview rows.

## Errors, Testing, And Extension

Upload, loading, review, analysis, and import failures use safe backend detail where available, otherwise controlled staff-facing messages. HTTP 401/403/400 upload states have source-aware messages. Validation text comes from the safe API representation rather than raw workbook data.

Focused Vitest specs cover the upload component, import service, batch page, review page, source-gated actions, confirmation, one-click protection, 409 refresh, preview wording, and success presentation. Tests are maintained with the feature; this guide does not claim a particular execution run.

For a future source, add its source option and upload call only when backend staging exists, retain the shared batch and reconciliation DTOs, use lifecycle-driven actions, and extend source-specific confirmation/success copy rather than duplicating routes or a parallel import workspace.
