# V4 — Institutional Account Registration

## What changed

- Login page now provides a visible account-creation link for all three workspaces.
- LGU Focal registration remains pending until PSWDO verifies and approves the LGU assignment.
- PSWDO staff can register their own account request; access remains pending until a System Administrator authorizes the PSWDO role.
- DSWD/PDRRMO personnel can create a read-only viewer account and select their agency. Per the current requested workflow, these viewer accounts do not enter the LGU approval queue.
- Public signup metadata can never create a System Administrator account.
- Pending-account screen now distinguishes PSWDO authorization from LGU approval.

## Required database upgrade

Run `supabase/migrations/004_institutional_registration.sql` once in Supabase SQL Editor after the earlier migrations.

## Security note

For a production government deployment, DSWD/PDRRMO self-registration should eventually be restricted using an invitation code, approved email domain, or administrator-issued invitation. V4 follows the current business rule that those read-only accounts do not require PSWDO LGU approval.
