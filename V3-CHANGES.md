# DROMIC Production V3 — LGU Reporting Workflow

## What changed
- Added dedicated **Create / Current Report** menu for LGU users.
- Added a guided report-launch screen tied to the active incident and open SitRep cycle.
- Fixed report creation to explicitly satisfy the database `created_by = auth.uid()` ownership rule.
- LGU identity is locked to the authenticated account.
- Added a five-step beginner workflow explaining how LGUs accomplish DROMIC.
- Added report progress/wizard indicator.
- Added explicit **Save Draft** action alongside auto-save.
- Kept the official spreadsheet-style DROMIC table as the default data-entry mode, with grouped headers and guided cards as an alternative.
- Improved focus states, sticky/scrollable table usability, and mobile layout.
- LGU top bar now identifies the interface as the LGU disaster reporting workspace rather than the provincial administrator interface.

## LGU workflow
Dashboard → Create / Current Report → Start DROMIC Report → Add Affected Barangays → Encode Official DROMIC Table → Validate → Save Draft / Submit → PSWDO Review.
