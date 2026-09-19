# DROMIC V6 Preview

## New operational modules
- Emergency LGU Assistance workspace for PSWDO/Admin with attributable audit trail.
- Relief inventory and LGU release tracking for Family Food Packs, sleeping kits, water filters, family tents, hygiene kits and configurable items.
- Family Food Pack distribution reporting by incident, LGU and barangay.
- Official login/registration footer with PSWDO, Province of Pangasinan, DSWD context and Developed by ZNBC.
- Damaged houses remain captured in the DROMIC core fields (totally and partially damaged) and are intended to consolidate into Annex D.
- Uploaded Mapandan DROMIC workbook added as the V6 source-of-truth reference for final export mapping.

## Database
Run migrations in order through `010_v6_operations.sql`.

## Security
Emergency assistance never silently impersonates an LGU. The provincial operator remains the authenticated user and actions are written to the audit trail.
