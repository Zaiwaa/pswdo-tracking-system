# V3 IMPORTANT — LGU REPORT CREATION

For an approved LGU account, use **Create / Current Report** in the left navigation. The system automatically selects the account's assigned LGU, current active incident, and open reporting cycle. Click **Start DROMIC Report**, add affected barangays, encode the DROMIC table, save draft, validate, and submit to PSWDO.

**No new Supabase migration is required when upgrading from V2 to V3.** Keep the same database and copy your existing `.env` into this folder.

---

# Pangasinan DROMIC Web-Based Disaster Reporting & Consolidation System

This package is the database-backed replacement for the earlier static demo.

## What is included

```
DROMIC-Production-MVP/
├─ src/
│  ├─ components/          reusable dashboard / DROMIC controls
│  ├─ data/                workbook-derived field catalog
│  ├─ lib/                 Supabase, validation and XLSX/PDF export
│  └─ pages/               LGU, PSWDO, SitRep, history, admin screens
├─ supabase/
│  ├─ migrations/001_schema.sql
│  └─ seed.sql
├─ reference/
│  ├─ DROMIC-reference-template.xlsx
│  └─ workbook-map.json
├─ ARCHITECTURE.md
├─ DROMIC-FIELD-MAPPING.md
├─ TESTING.md
├─ START-WINDOWS.bat
├─ .env.example
└─ package.json
```

## Important design decision

The uploaded workbook is authoritative for DROMIC terminology and structure. The application does **not** assume `CUM = previous CUM + NOW` for every field. CUM and NOW are stored separately; server validation prevents historical cumulative values from silently decreasing/resetting.

## Beginner setup

### 1. Install Node.js
Install the current Node.js LTS version.

### 2. Create a free Supabase project
Create a project and wait for the database to finish provisioning.

### 3. Create the database
In Supabase → SQL Editor:

1. Open `supabase/migrations/001_schema.sql` and run the whole file.
2. Open `supabase/seed.sql` and run it.

The seed imports the 47 LGU summary rows found in the uploaded Pangasinan workbook block. The application never hard-codes the LGU count.

**Barangay warning:** the uploaded workbook does not contain a complete reliable master barangay list for every LGU. Verify/complete the `barangays` table before official use.

### 4. Create the first administrator
Register normally in the website first. Then in Supabase SQL Editor run this once using your registered email:

```sql
select public.bootstrap_admin('YOUR_EMAIL@example.com');
```

Because the function is revoked from web/API roles, it is intended to be run from the database administration interface only.

### 5. Configure the frontend
Copy `.env.example` to `.env`:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Use the **publishable** browser key. Do not put a service-role/secret key in the frontend.

### 6. Start on Windows
Double-click `START-WINDOWS.bat`.

Or from a terminal:

```
npm install
npm run dev
```

Open `http://localhost:5173`.

## First operational setup

1. Sign in as administrator.
2. Approve LGU focal registrations and assign their exact LGU.
3. Verify/populate barangay master data.
4. Create an active Incident.
5. Create a reporting cycle in the database/admin extension (SitRep number + cutoff). The schema supports multiple cycles per incident.
6. LGUs create/open their reports, add affected barangays, encode, and submit.
7. PSWDO reviews and validates or returns reports.
8. Generate the SitRep. Only validated versions are snapshotted into it.
9. Finalize the SitRep so later LGU changes cannot silently alter it.
10. Export PDF/XLSX.

## Deployment

Build:

```
npm run build
```

This produces `dist/`. Deploy the Vite project to Cloudflare Pages and set the same two environment variables in the project settings.

Suggested build settings:

- Build command: `npm run build`
- Output directory: `dist`

## Security model

Security is enforced in PostgreSQL Row Level Security and workflow RPC functions, not only by hidden buttons:

- LGU users can create/edit only their assigned LGU's editable report.
- Submitted versions are immutable snapshots.
- PSWDO/admin performs validation and return/approval actions through server functions.
- Viewer access is read-only.
- SitRep inclusion references exact validated version IDs.
- Finalized SitReps keep those exact references.
- Audit logs record major workflow actions.

## Not yet claimed as final DSWD production certification

This is a deployable production-oriented MVP, but the following must be confirmed with the office before official rollout:

- exact field-specific cumulative semantics for every CUM/NOW pair,
- complete/official barangay master data,
- required government header/signatory wording,
- exact DSWD/PDRRMO distribution policy,
- exact cell-by-cell reproduction requirements for the official Excel workbook.

Those are operational rules, not UI details; guessing them would risk incorrect disaster figures.

## V4 upgrade — PSWDO / DSWD / PDRRMO registration

If upgrading an existing database, run `supabase/migrations/004_institutional_registration.sql` once.

Registration behavior:
- LGU Focal: self-registers, then PSWDO approves/assigns the LGU.
- PSWDO: self-registers, then a System Administrator authorizes the PSWDO role.
- DSWD/PDRRMO: self-registers as a read-only viewer and does not enter the LGU approval queue.
- System Administrator: never self-registers from the public form; bootstrap/assign this role administratively.
