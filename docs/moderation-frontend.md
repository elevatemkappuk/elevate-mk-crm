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
