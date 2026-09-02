# People Domain: Staff Business Guide

Last updated: 2026-09-02

## What a Person Is

A **Person** is Elevate MK's core CRM record for an individual. A Person may be a Contact, an active Member, or a Former Member. A Person can exist without a login account, without a membership, and without a professional profile.

This guide explains current staff-facing behavior. For technical implementation details, see the [CRM implementation guide](people-domain-frontend.md) and [backend guide](../../elevate-mk-api/docs/people-domain-backend.md).

## People You Can See

The CRM People area contains BUSINESS records only. TECHNICAL records are for system/administrative use and are deliberately not shown or searchable in the CRM People domain.

An archived Business Person remains part of the historical CRM record and can be found with the Archived or All record-state directory filter. It can be opened for review, but normal updates and related changes are unavailable until it is restored.

## One Person, Many Relationships

For example, Ama may first attend an Elevate MK event, later become a Member, and later receive access to an Elevate MK application. The CRM goal remains one Ama record with related history:

```text
Ama
|- Event participation
|- Membership
`- User account, if she needs to sign in
```

Those are relationships with the same person, not reasons to create separate Ama records.

## Contact, Member, and Former Member

The relationship shown in the CRM is based on the current Membership record:

- **Contact**: no Membership record exists.
- **Active Member**: the Person has an active Membership.
- **Former Member**: a Membership exists and has ended.

Staff can create a Contact, create a new Active Member, make an eligible Contact a Member, or end an active Membership when their role permits. Ending membership preserves history; it does not remove the Person. A Former Membership remains an important historical fact and does not automatically become active again.

Membership source describes the business origin of the Membership, such as a staff action, website form, or Membership Form. It is not a statement of the Person's identity or current permission.

## Person Information

The Person record owns first name, last name, primary email, mobile, location, age range, gender, archive status, and CRM timestamps. Names are not duplicated onto the authentication User record.

The optional Professional Profile stores current professional information separately: job title, company, industry, career stage, and LinkedIn URL. Skills, Interests, and Tags are independent classifications assigned to a Person. These classifications should be used consistently and are not replacements for narrative notes.

Skills describe abilities or areas of capability. Interests describe areas a person is interested in. Tags are flexible operational labels used to organise CRM work. Each is maintained as a shared list so staff do not create inconsistent variations of the same classification.

## Create, Review, and Duplicate Safety

When creating a Contact or Member, staff should enter the best available contact information. The CRM checks normalized email and mobile evidence against existing BUSINESS People. A similar name alone does not identify someone.

If the system finds a possible identity collision, stop and review the candidate record(s). Staff may only proceed with an explicit reviewed override when the screen and backend allow it. Do not create a duplicate merely because a source row or form uses a different spelling of a name. The system rechecks the evidence before saving, so an outdated review cannot be reused without another decision.

## Archive and Restore

Archive is the normal way to retire a Person from active operational work. It does not delete the record or erase related Membership, Professional Profile, classification, note, or audit history. Restore returns the Person to the active CRM record set without changing those relationships.

Use archive for lifecycle management, not to conceal duplicate records or bypass identity review. Review potential duplicates through the supported resolution process instead.

## Notes and Audit History

Internal Notes are for staff context. They are not public profile data. Notes can be archived and restored rather than hard-deleted, preserving the operational record.

The Person Audit History records significant supported CRM changes, such as Person lifecycle, membership, profile, taxonomy, note, and import-related actions. It is a record of what the system changed, not a place for sensitive free-text content. Viewer access intentionally excludes Internal Note audit events.

## Roles and Access

CRM roles govern operational access:

- **CRM Admin** and **CRM Manager** can perform current People management workflows.
- **CRM Viewer** can read People information but cannot perform normal People changes; Internal Notes are not available to this role.

Django Admin access (`is_staff` or `is_superuser`) is separate technical administration access. It does not itself grant Staff CRM People permissions.

## Historical Imports

Historical Imports is a separate, controlled administrative workflow. It reconciles source records before any authoritative CRM changes and retains batch/row provenance after import. Imports may result in new or matched People, but staff should not use normal People editing to recreate import decisions.

For staff procedure and terminology, see the [Historical Imports business guide](historical-imports-business-guide.md). Eventbrite import work can create/reuse People and event participations but does not create Memberships merely because a buyer attended an event. Membership Form imports can establish Memberships under their own rules.

## Good Practice

- Search before creating a record, especially when email or mobile is known.
- Use the correct existing Person when a match is confirmed.
- Keep contact and professional information in their respective sections.
- Use classifications and Tags consistently; use Internal Notes for contextual staff information.
- Archive rather than delete.
- Treat imported records and their resolution history as controlled provenance, not ordinary manual data entry.
