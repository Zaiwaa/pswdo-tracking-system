ROLE / LGU APPROVAL FIX
=======================
1. In Supabase > SQL Editor, open:
   supabase/migrations/002_admin_profile_management.sql
2. Copy all SQL and click Run.
3. Replace your local project with this RoleFixed package (or copy the src/pages/Admin.jsx file).
4. Copy your existing .env into this folder.
5. Close the old START-WINDOWS command window.
6. Run START-WINDOWS.bat again.
7. Administration > User approvals now uses Role + LGU + Approved + Save changes.

Rules:
- LGU User + Approved requires an assigned LGU.
- PSWDO / Viewer / Admin do not require an LGU and their LGU assignment is cleared.
- An administrator cannot accidentally demote their own account.
