# PSWDO Document Tracking System — Standalone Web Version

This package is the standalone replacement for the Google Apps Script build.

## Architecture

- Frontend: existing PSWDO dashboard/document tracking UI
- Backend: Node.js + Express
- Database: PostgreSQL
- Authentication: bcrypt password hashing + JWT sessions
- Chat / notifications: PostgreSQL + Socket.IO real-time events
- Deployment: Render (recommended), Railway, or any Docker/Node host

Google Apps Script and Google Sheets are **not required** by this build.

## Included upgrade features

- Create account
- Login / logout
- Position / designation on each user account
- Edit profile name and position
- Pending account approval workflow
- Administrator user-management page
- Activate / disable accounts
- User / Administrator roles
- Administrator password reset
- Server-side authorization
- Team chat
- Real-time chat refresh with Socket.IO
- Persistent notifications
- Mark one / all notifications as read
- Document-added / updated / deleted notifications
- Existing document tracking dashboard and routing UI
- PostgreSQL document storage and routing history
- Responsive web layout
- Permanent QR code for every document
- Printable QR label for attachment to physical documents
- Public mobile tracking page with latest safe document status
- Logged-in QR scan actions: Receive, Forward, Update Status
- QR actions update routing history and generate notifications
- Audit log storage for document and QR actions

## First administrator

The first administrator is created automatically from environment variables:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_NAME`
- `ADMIN_POSITION`

Use a strong password and change the defaults before deployment.

## Local development

1. Install Node.js 20+ and PostgreSQL.
2. Copy `.env.example` to `.env`.
3. Set `DATABASE_URL`, `JWT_SECRET`, and administrator variables.
4. Run:

```bash
npm install
npm start
```

Open:

```text
http://localhost:3000
```

## Recommended production deployment: Render

### 1. Put this folder in a Git repository

Create a private GitHub/GitLab/Bitbucket repository and push this project.

### 2. Create a Render Blueprint

This repository already includes `render.yaml`.

In Render:

1. New > Blueprint
2. Connect the repository
3. Render reads `render.yaml`
4. Enter secret values when prompted:
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
5. Deploy

The Blueprint creates:

- Node web service
- PostgreSQL database
- `DATABASE_URL` connection wiring
- generated `JWT_SECRET`
- health check at `/api/health`

### 3. First login

After deployment, open the Render URL and log in using the administrator credentials configured in environment variables.

Newly registered accounts start as `Pending`. Open **User Administration** to approve them.

### 4. Custom domain

Add your own domain/subdomain in the Render web-service settings after the site is working, for example:

```text
tracking.your-office-domain.gov.ph
```

Configure the DNS records exactly as shown by your host.

## Railway deployment

The same project can be deployed to Railway:

1. Create a new Railway project.
2. Add PostgreSQL.
3. Deploy this Node repository.
4. Set `DATABASE_URL` to the PostgreSQL connection variable.
5. Add `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `ADMIN_POSITION`.
6. Generate a public domain for the Node service.

## Security notes

- Registration does not grant access immediately; administrator approval is required.
- Protected RPC endpoints require a valid JWT and an active account.
- Administrator operations are checked on the server.
- Passwords are stored using bcrypt hashes, not plaintext.
- Use HTTPS in production.
- Do not commit `.env` or real credentials to Git.

## Current file/image behavior

Remark images are stored as data URLs inside PostgreSQL JSON data. This avoids relying on a host's temporary local filesystem. For a very large deployment, move document/image uploads to object storage such as S3-compatible storage.

## Existing Google Sheets data

This package does not contain the live spreadsheet database from the Apps Script deployment, so existing spreadsheet rows are not automatically migrated. Export the current `Documents` and `RoutingHistory` sheets to CSV before retiring the old system. They can then be imported into PostgreSQL with a migration script.

## Important production recommendation

Before province-wide rollout, add:

- automated database backups
- audit log for every admin/document action
- stricter per-role permissions if multiple office roles need different privileges
- rate limiting / login brute-force protection
- password-change flow for users after admin reset
- object storage for large attachments
- staging environment before production releases


## QR document tracking

Every document receives a random `public_token`. In **Document Tracking**, click the QR-code action beside a record to open its printable label. The QR opens `/track/<token>` and always reads the latest PostgreSQL data.

Public scanners see only safe tracking information: reference number, subject, type, program/unit, current holder/status, dates, and routing timeline. Internal attachments, user account details, private remarks, and confidential fields are not exposed.

If the scanner is already logged in on the same device/browser, the tracking page also shows staff actions: **Receive Document**, **Forward Document**, and **Update Status**. These actions append routing history, update the current status, notify other active users, and write an audit entry.

Existing databases are migrated automatically at startup: old documents receive QR public tokens without recreating the records.

## Correcting mistaken routing/history entries
Administrators can remove a mistakenly entered document routing/history event from the Document Details view. Select **Delete mistaken entry**, provide a required reason, and confirm the action. The visible operational history and current document status are recalculated immediately. The removed entry, administrator identity, deletion reason, and timestamp remain preserved in the immutable Audit Log under `ROUTING_HISTORY_DELETED` for accountability.

### Correcting mistaken remarks
Administrators can also remove an individual mistaken document remark from the Document Details view. A deletion reason is required. The remark is removed from the operational document view, while the deleted content, administrator identity, reason, and timestamp remain permanently recorded in the Audit Log under `DOCUMENT_REMARK_DELETED`.

## Controlled history and remarks correction

Mistaken routing-history entries and document remarks cannot be deleted directly. Any logged-in user can select **Request removal**, enter a required reason, and submit the request. Active Administrators receive an in-app notification and can review the request under **User Administration → Deletion / Removal Requests**.

An Administrator can **Approve** or **Reject** the request and optionally add a review note. Approval removes the mistaken value from the operational document view and recalculates routing/current status when necessary. Rejection leaves the document unchanged. The requester receives a notification of the decision.

For accountability, the database permanently preserves the deletion request, original value snapshot, requester, reason, administrator decision, reviewer, review note, and timestamps. The audit log records both the request and the final approval/rejection, so correction actions cannot silently erase evidence of what was changed.


## Upgrade V2
- Glassmorphism login/register UI
- One-to-one direct messaging
- Clickable notifications with concern deep-links
- Quick Approve button for pending accounts
- Fixed QR generator variable bug
- Better desktop table wrapping and mobile cards
- Added Feeding program/unit
- Added To Payment and Reimbursement document types
- Simplified references: `PSWDO-YYYY-0001`


## Upgrade V3
- Search accounts by name or position for private one-to-one chat
- Notification action text shortened to `Open`
- Added `Claimed Cheque` routing/status option
- Users can add custom checklist items that save with each document
- Users can enter a custom Document Type when the built-in choices do not apply
