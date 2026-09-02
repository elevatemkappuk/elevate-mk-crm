# Historical Data Imports - Business & Founder Guide

Last updated: 2026-09-02

Scope: current V1 Historical Import behavior for Elevate MK leadership and operations staff. This is a plain-language companion to the [Backend Technical Guide](../../elevate-mk-api/docs/historical-imports-backend.md) and [Frontend Technical Guide](historical-imports-frontend.md).

## Why Historical Imports Exist

Elevate MK already has valuable relationship history in Membership Forms and Eventbrite workbooks. Historical Imports brings that information into the CRM carefully. A spreadsheet row is useful evidence, not automatic proof that it belongs to a particular Person already in the CRM.

## The Core Principle

The CRM is building one relationship with each Person. It must avoid creating duplicate People, accidentally merging different people, overwriting good CRM information, or treating an Eventbrite buyer as a Member without evidence.

When the evidence is clear, the system can reuse an existing Person. When it is uncertain, staff review it. When the evidence conflicts, the system does not silently merge records.

## Membership Form Imports

Membership Form data represents a Membership source. A new person from a valid Membership Form can become an active Member. An existing Person can be linked to the submitted Membership information without replacing their existing nonblank CRM details. Existing active Memberships remain active; a previous/former Membership is not silently restarted.

Professional information is added cautiously when it is missing. Invalid source rows are excluded rather than forced into the CRM. Possible duplicate People are sent for staff review before anything is added.

## Eventbrite Imports

For historical Eventbrite data, the business rule is simple: if someone is the Buyer for an Eventbrite order, Elevate MK records that Person as **Registered** for that Event.

Buying multiple tickets does not create multiple People or multiple registrations for the buyer. The CRM does not assume who any unnamed guests are, and it does not claim that the buyer attended the Event.

Eventbrite buyers do not automatically become Members. Existing Members remain Members, Contacts can participate in Events, and one Person can participate in many Events. Repeated orders for the same Person and Event do not duplicate that relationship.

Example: Alex buys three tickets. The CRM records that Alex is registered for the Event. It does not invent Alex plus two unnamed attendees.

## Duplicate Protection And Staff Review

The system uses strong contact evidence such as matching email address or mobile number, not just a matching name.

```text
Upload -> system checks -> obvious matches
  -> staff review for uncertainty -> preview -> Add to CRM
  -> read-only historical import record
```

- The same email often indicates an existing Person.
- Uncertain evidence is shown to staff for a same-person or different-person decision.
- Conflicting contact details are not silently merged.
- Staff can explicitly confirm that records describe different people when appropriate.

## What The System Protects

- Existing CRM details are not casually overwritten.
- Eventbrite cannot create or alter Membership.
- Invalid rows can be excluded safely.
- Completed imports are traceable historical records.
- Only authorized CRM administrators can add records to the CRM.
- A completed import becomes read-only instead of being applied again.

## Provider Independence

Eventbrite is a source, not a permanent rule built into Elevate MK's core relationship model.

```text
Today:  Eventbrite -> Elevate MK CRM
Future: another ticket provider -> Elevate MK CRM
        Elevate MK Community -> Elevate MK CRM

Core relationship: Person -> Event participation
```

This means Elevate MK can change or add ticketing providers without changing the basic meaning of a Person's Event participation.

## Practical Examples

| Situation | V1 result |
| --- | --- |
| Existing Member appears in a Membership Form | Existing Person and active Membership are reused safely. |
| New valid Membership Form person | A new Person and Membership can be added. |
| Existing Person buys an Eventbrite ticket | The Person is recorded as registered for that Event; Membership does not change. |
| New Eventbrite buyer | A new Person may be added and recorded as registered; no Membership is created. |
| Same buyer purchases for several Events | One Person can receive a registration for each Event. |

## What V1 Does Not Claim

- An Eventbrite registration does not prove attendance.
- Ticket quantity does not identify unnamed guests.
- Genuinely ambiguous identities are not resolved automatically.
- Historical Import is not live Eventbrite synchronization.

## Founder Summary

Historical Imports lets Elevate MK preserve valuable history while protecting the quality of its growing CRM. It records Membership and Event relationships according to what each source actually proves, keeps staff in control of uncertain identities, and avoids locking the organisation into Eventbrite or any other provider.
