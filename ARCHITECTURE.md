# System Architecture

## Phase 1 — Requirements analysis

Target workflow:

PSWDO creates incident and reporting cycle → LGU logs in → creates/opens its own cycle report → adds affected barangays → enters official DROMIC values → browser provides immediate field feedback → server validates again → immutable submitted version is created → PSWDO reviews → validates or returns for correction → validated versions are snapshotted into the SitRep → SitRep is finalized and locked → structured PDF/XLSX exports are generated → audit/distribution records remain available.

Ambiguous DROMIC cumulative semantics are explicitly documented in `DROMIC-FIELD-MAPPING.md` and are not silently guessed.

## Phase 2 — Practical stack

- Frontend: React + Vite
- Backend/API: Supabase Data API + PostgreSQL RPC functions
- Database: PostgreSQL on Supabase
- Authentication: Supabase Auth
- Authorization: PostgreSQL Row Level Security + security-definer workflow functions
- Hosting: Cloudflare Pages for the Vite build
- PDF: jsPDF + jspdf-autotable from structured data
- Excel: SheetJS from structured data
- Email/distribution: initially secure in-system distribution records; email notification integration can be added without changing the data model

This keeps the deployment small and maintainable while placing the critical validation, ownership, versioning, and consolidation rules in PostgreSQL instead of trusting browser code.

## Phase 3 — Database design

Normalized entities implemented:

`profiles → lgus → barangays`

`incidents → reporting_cycles → reports → barangay_reports`

`reports → report_versions → report_version_barangays`

`report_versions → sitrep_reports → sitreps`

Supporting entities: `remarks`, `notifications`, `audit_logs`, `distribution_logs`.

DROMIC values are stored as structured JSONB per barangay snapshot so the workbook's very wide schema can evolve without destructive table migrations, while ownership/version relationships stay normalized.

## Phase 4 — User flow

### LGU

Dashboard → open active cycle → add affected barangays → enter essential/full DROMIC fields → save continuously to database → submit → immutable version → receive validated/returned notification → correct returned working copy → resubmit.

### PSWDO

Provincial dashboard → see every configured LGU/status → review latest submitted version → server validation → validate or return with precise remark → create SitRep from reporting cycle → include latest validated version exactly once per LGU → finalize/lock → export/distribute.

## Phase 5 — Validation

Implemented in browser for fast feedback and again in PostgreSQL before validation/approval:

- negative numeric values blocked,
- NOW > CUM blocked for paired fields,
- CUM lower than the previous validated CUM blocked,
- cumulative reset to zero is consequently blocked when previous CUM > 0,
- affected families > affected persons generates a warning,
- duplicate barangay per report is prevented by a database unique constraint,
- duplicate LGU inclusion per SitRep is prevented by unique constraints,
- only validated versions can be selected by SitRep generation.

Rules not provable from the workbook are flagged instead of fabricated.

## Phase 6 — UI structure

- Login / registration
- Pending account approval
- LGU dashboard
- DROMIC report editor with affected-barangay search and collapsible full categories
- Provincial submission dashboard
- PSWDO submitted-version review
- SitRep cycle / consolidation screen
- Report history
- Notifications
- Administrator accounts/incidents

## Phase 7 — Project structure

See `README.md`.
