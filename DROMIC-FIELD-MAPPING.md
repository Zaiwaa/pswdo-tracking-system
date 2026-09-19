# DROMIC Workbook Field Mapping

Authoritative reference: `reference/DROMIC-reference-template.xlsx` uploaded by the user.
Machine-readable header extraction: `reference/workbook-map.json`.

## Workbook structure found

The workbook contains 12 sheets:

1. INFORMATION
2. Checker Sheet
3. REGION I
4. FO 1 SUMMARY
5. (VIEW)Checker Sheet
6. Annex A_Affected
7. Annex B_Displaced Inside
8. Annex B.1_Sex and Disaggregate
9. Annex C_Displaced Outside
10. Annex D_Damaged Houses
11. Annex E_Cost of Assistance
12. CCCM&IDP

The main `REGION I` sheet contains 206 used columns through column `GX` and is the clearest source for the combined provincial reporting structure.

## Main REGION I mapping

| Excel columns | Official category | Application representation | Type / behavior | Validation / consolidation |
|---|---|---|---|---|
| A:B | REGION / PROVINCE / MUNICIPALITY | `lgus`, report ownership | Master data | Never user-edit another LGU |
| C | Number of Barangays | master/report summary | Integer | Derived where possible |
| D:E | LISTAHAN 3 (2023): Poor Families / Poor Individuals | reference/master fields | Integer | Not currently editable in MVP |
| F | PSA2024 | reference/master field | Integer | Not currently editable in MVP |
| G | No. of Pantawid Beneficiaries | reference/master field | Integer | Not currently editable in MVP |
| H:L | NUMBER OF AFFECTED | Barangay values: families, persons, 4Ps families | Integer | Non-negative; families > persons is warning |
| M:N | Number of Evacuation Centers | `evacuation_centers_cum/now` | CUM/NOW pair | NOW <= CUM; CUM may not decrease from previous validated period |
| O:P | Latitude / Longitude | EC metadata | Text | Optional; coordinate format can be hardened later |
| Q:R | Name / Address of Evacuation Center | EC metadata | Text | Optional / context dependent |
| S:T | Origin of IDPs: Brgy Name / Brgy Count | EC metadata | Text + integer | Count non-negative |
| U:X | NUMBER OF DISPLACED — INSIDE ECs | Families CUM/NOW; Persons CUM/NOW | CUM/NOW | NOW <= CUM; CUM carry-forward guard |
| Y:AB | NUMBER OF DISPLACED — OUTSIDE ECs | Families CUM/NOW; Persons CUM/NOW | CUM/NOW | NOW <= CUM; CUM carry-forward guard |
| AC:AF | TOTAL DISPLACED | Computed inside + outside | Computed | Backend/exporter derived, not manually trusted |
| AG:AH | NON IDPs | Families / Persons | Integer | Non-negative |
| AI:BN | Sex & Age Distribution of IDPs Inside ECs | Age band × male/female × CUM/NOW | CUM/NOW | NOW <= CUM; CUM carry-forward guard |
| BO:BR | Pregnant / Lactating Mothers | CUM/NOW | CUM/NOW | Same cumulative guard |
| BS:CP | Child-headed, single-headed, solo parent, PWD, IP, 4Ps beneficiaries | Male/female CUM/NOW | CUM/NOW | Same cumulative guard |
| CQ:DT | Evacuation Center Facilities | facility counts, some CUM/NOW | Mixed | Non-negative; exact semantics preserved by field catalog |
| DU:EB | Tents Deployed in Evacuation Centers | Family / Modular / Child / Women friendly tents CUM/NOW | CUM/NOW | Same cumulative guard |
| EC:EE | No. of Damaged Houses | Total / Totally / Partially | Integer | Total is computed from totally + partially in application |
| EF:GW | Total Cost of Assistance | DSWD food/NFI/financial + Province/LGU/NGO/Others | Quantity, unit cost, amount | Cost is computed for quantity × unit-cost rows; totals consolidated |
| GX | Remarks | `remarks` | Text | Preserved in report snapshot |

## Critical cumulative rule implemented

The workbook shows many CUM/NOW pairs, but it does **not by itself prove that every CUM value must equal previous CUM + NOW**. The application therefore uses the conservative rule requested by the user:

- Separate NOW and CUM.
- Carry previous validated CUM forward as the baseline.
- Block CUM values lower than the previous validated CUM.
- Block NOW > CUM where that pair is defined.
- Never reset historical CUM merely because NOW becomes zero.
- Do **not** blindly add NOW into CUM for every field.

### Flagged for operational confirmation

Before declaring the cumulative engine legally/operationally final, PSWDO/DSWD should confirm which CUM fields are:

1. unique cumulative occurrence counts,
2. cumulative service/deployment counts,
3. current inventory/status values that happen to be presented with CUM/NOW,
4. manually validated cumulative figures.

The code intentionally avoids inventing these distinctions.

## Damaged houses

The application computes:

`Total Damaged Houses = Totally Damaged + Partially Damaged`

This is a structural subtotal, not an assumed historical cumulative rule.

## Total displaced

The application computes, separately for NOW and CUM:

- Total displaced families = inside EC families + outside EC families
- Total displaced persons = inside EC persons + outside EC persons

These are direct structural totals reflected by the workbook grouping.

## Barangay master-data warning

The uploaded workbook's Pangasinan provincial block contains 47 LGU summary rows. It does **not contain a complete reliable barangay master list for every LGU**; some LGU blocks have barangay names populated while others are blank. Therefore:

- `seed.sql` seeds all 47 LGU rows found in the workbook.
- Any barangay names found in the template are imported only as starter data.
- The System Administrator must complete/verify the barangay master list before official deployment.
- The application derives the LGU count from `lgus`, never from a hard-coded number.
