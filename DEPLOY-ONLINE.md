# Put DROMIC Online (Cloudflare Pages)

`http://localhost:5173` is a development address available only on the computer running Vite. It is not a public website.
For province-wide access, deploy the Vite frontend to a public HTTPS host while keeping Supabase as the database/auth backend.

## Recommended: Cloudflare Pages + Supabase

1. Test locally and run `npm run build`.
2. Create a private GitHub repository such as `pangasinan-dromic`.
3. Push this project. Do **not** upload `.env`.
4. In Cloudflare Dashboard: **Workers & Pages → Create → Pages → Connect to Git**.
5. Select the repository.
6. Build command: `npm run build`
7. Build output directory: `dist`
8. Add Cloudflare environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
9. Deploy.
10. Cloudflare gives a public HTTPS address such as `https://pangasinan-dromic.pages.dev`.
11. In Supabase Authentication URL configuration, set the Site URL to the Cloudflare URL and add it to allowed redirect URLs.
12. Test using a phone on mobile data and a computer outside the office network.

`public/_redirects` is included so React routes such as `/history`, `/approvals`, and `/sitrep` resolve correctly on Cloudflare Pages.

## Security
The browser uses only the Supabase publishable key. Row Level Security and server-side RPCs remain responsible for LGU-level isolation. Never put a Supabase service-role/secret key in `.env` or Cloudflare frontend variables.
