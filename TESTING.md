# Acceptance Test Checklist

## Authentication & authorization
- [ ] Unauthenticated user is redirected to login.
- [ ] Pending account cannot enter the system.
- [ ] Approved LGU user can view only its own report records.
- [ ] LGU A cannot select/update LGU B report through direct REST/API request.
- [ ] PSWDO can view all LGUs and submitted versions.
- [ ] Viewer cannot modify reports.

## Report lifecycle
- [ ] LGU can create one report per reporting cycle.
- [ ] Duplicate barangay cannot be added twice.
- [ ] Draft edits persist after refresh.
- [ ] Zero Report produces an explicit submitted zero snapshot.
- [ ] Submission creates immutable report version 1.
- [ ] Returned report becomes editable again.
- [ ] Resubmission creates version 2 rather than overwriting version 1.

## CUM/NOW
- [ ] NOW > CUM blocks submission/validation.
- [ ] Previous validated CUM = 120, current NOW = 0, current CUM = 0 is blocked.
- [ ] Previous validated CUM = 120, current NOW = 0, current CUM = 120 passes.
- [ ] CUM does not automatically equal previous CUM + NOW unless an approved field-specific rule is later configured.

## PSWDO
- [ ] Dashboard LGU denominator comes from `lgus` table.
- [ ] Return for correction requires a remark.
- [ ] Validate runs server-side validation again.
- [ ] Validation identity/time/version are recorded.

## SitRep
- [ ] Only VALIDATED versions are included.
- [ ] Only one version per LGU is included per SitRep.
- [ ] Finalize converts included versions/reports to INCLUDED_IN_SITREP.
- [ ] New later submissions cannot silently replace a finalized SitRep's referenced versions.
- [ ] PDF export is generated from structured data.
- [ ] XLSX export is generated from structured data.

## Responsive / performance
- [ ] Desktop 1366px: dashboard and tables usable.
- [ ] Tablet: sidebar collapses.
- [ ] Mobile 390px: data-entry fields become single-column; large tables remain scrollable.
- [ ] Slow-network failure leaves the existing database record intact and displays the error instead of pretending the save succeeded.
