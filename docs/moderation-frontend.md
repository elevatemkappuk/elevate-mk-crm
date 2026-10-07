# Community moderation workspace

The CRM Community moderation workspace is available at `/moderation` to
`CRM_ADMIN` and `CRM_MANAGER` staff only. `CRM_VIEWER` does not see the
navigation item and is denied direct route access.

The workspace reviews the backend-authoritative open-report queue. Staff can
open a report, inspect the bounded reporter and target projection, dismiss a
report, remove a post or reply, and restore content only when the backend
reports `MODERATOR_REMOVED`. Actions use the Community moderation API; the CRM
does not infer lifecycle state or expose moderation information through People
screens.

The queue is newest-open-first. A report contains its reason, bounded details,
created/resolved timestamps, safe reporter identity, target state/content and,
for replies, parent-post context. Reporter identity is confined to this
moderation workspace and is never part of ordinary People or member-facing
Feed projections.

Dismissal resolves the report without changing content. Removing active content
sets the target to `MODERATOR_REMOVED`, resolves all other open reports for the
same target and keeps the content/history stored. Restore is available only for
moderator-removed content; `AUTHOR_DELETED` content cannot be restored.

The CRM currently exposes the open queue and individual report actions. A
separate browsable history of resolved reports is intentionally deferred.
