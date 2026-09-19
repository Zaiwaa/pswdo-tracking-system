# DROMIC Production V5 — Usability & Submission Reliability

## What changed

- Simplified login portal wording so users can distinguish LGU, PSWDO, and DSWD/PDRRMO access.
- Added required contact number during registration.
- Added **My Profile** for all user roles with full name, office/position, email, and contact number.
- LGU submission is blocked until contact details are complete.
- Added prominent red LGU validation warning and stronger red field highlighting.
- LGU report submission now performs server validation before the final submit RPC.
- Submit button shows an active submitting state and explicit success/failure feedback.
- Normal LGU report submissions notify all approved PSWDO/Admin users.
- **Zero Reports now also notify PSWDO/Admin**, fixing a gap in V4.
- Notifications update in real time, display an unread count in the navigation, open their linked report, and can be marked read.

## IMPORTANT DATABASE STEP

Existing V4 databases must run:

`supabase/migrations/005_usability_notifications_contacts.sql`

in the Supabase SQL Editor after migrations 001-004.

This migration adds `profiles.contact_number`, the profile update RPC, and updated submission notification functions.

## Existing users

Existing accounts will have a blank contact number after the migration. Each user should sign in and open **My Profile** to add a contact number. LGU users cannot submit a report or Zero Report until both email and contact number are present.

## Local install

Because `node_modules` is platform-specific, install dependencies on the target computer:

```bash
npm install
npm run dev
```

For production verification:

```bash
npm run build
```

## V5.2 — PSWDO submission notifications
- Every approved PSWDO account receives its own unread notification when an LGU submits a report.
- Resubmissions are explicitly labeled as resubmissions.
- Zero / No Affected Population reports also notify PSWDO.
- Notification links open the submitted report directly for review.
- Added a 10-second notification refresh fallback in addition to Supabase Realtime, so unread badges still refresh when Realtime publication is not enabled for the notifications table.

## V5.3 — PSWDO table review + automatic consolidation
- PSWDO review now opens as a spreadsheet-style DROMIC table patterned after the official summary layout.
- One-click Show barangays / Hide barangays control switches between detailed barangay rows and LGU totals.
- Validate action is renamed to “Validate & add to PSWDO report”.
- Validation automatically creates the current DRAFT SitRep if needed and upserts the exact validated LGU version into it.
- Consolidated PSWDO report shows OVERALL TOTAL, every validated LGU total, and optional barangay detail.
- Finalized SitReps remain immutable for audit integrity.
- Requires migration: `supabase/migrations/008_pswdo_auto_consolidation.sql`.
