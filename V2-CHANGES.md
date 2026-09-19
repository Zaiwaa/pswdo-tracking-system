# DROMIC Production V2 — requested corrections

- **Online access**: Cloudflare Pages deployment guide and SPA routing are included. Localhost is development only.
- **Login workspaces**: LGU Focal, PSWDO, and DSWD/PDRRMO are visibly separated on the sign-in screen. This selector never grants access; the database role is authoritative.
- **LGU-only self-registration**: public registration is for LGU focal persons only. This prevents anyone from self-registering as PSWDO/DSWD/PDRRMO.
- **PSWDO-controlled approval**: PSWDO and System Administrator accounts can approve pending LGU focal registrations and assign the correct LGU through a server-side RPC.
- **DSWD/PDRRMO and PSWDO institutional accounts**: when a System Administrator assigns these roles, they are automatically authorized and do not enter the LGU approval queue.
- **DROMIC table**: LGU report entry now defaults to an Excel-style DROMIC table based on the uploaded workbook mapping, with grouped headers, sticky barangay names, NOW/CUM columns, validation highlights, and section tabs. Guided Cards remain available for mobile/simpler entry.
- **Red / blue / white design**: deep navy navigation, white content surfaces, restrained government red accents, tricolor details, and green validation/success states.
