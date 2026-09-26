# Full Offload

See which models hit full offload on your hardware. Full Offload ([fulloffload.com](https://fulloffload.com)) collects real tokens-per-second measurements for local LLMs: people submit their device, the exact command they ran (llama.cpp, Ollama, vLLM, MLX, LM Studio or anything else) and the generation and prompt-processing speeds it printed. Visitors pick their GPU or Mac and see the median speeds for every runtime, model, quant and device count reported on it, with the commands behind every number. It is a static React app on GitHub Pages that talks directly to one Supabase project; validation, rate limiting and device matching live in Postgres, guarded by row-level security.

The design and scope live in [`docs/architecture.md`](docs/architecture.md). Agents start with [`CLAUDE.md`](CLAUDE.md).

## Local setup

You need Node.js (version in `.nvmrc`), pnpm (the version in `package.json`'s `packageManager`, for example through `corepack enable`) and Docker.

```sh
pnpm install
pnpm db:start                 # local Supabase stack in Docker (first run pulls images)
cp web/.env.example web/.env  # local-stack URL and anon key
pnpm db:reset                 # apply migrations and seed the curated devices
pnpm dev                      # http://localhost:5173
```

Sign in locally with an email link: the local stack catches every email at http://127.0.0.1:54324. Supabase Studio for the local database is at http://127.0.0.1:54323.

## Scripts

All scripts run from the repo root.

| Script                           | What it does                                                       |
| -------------------------------- | ------------------------------------------------------------------ |
| `pnpm dev`                       | Start the Vite dev server                                          |
| `pnpm db:start` / `pnpm db:stop` | Start or stop the local Supabase stack                             |
| `pnpm db:reset`                  | Reset the local database, apply all migrations and run the seed    |
| `pnpm db:types`                  | Regenerate `web/src/lib/database.types.ts` from the local schema   |
| `pnpm test`                      | Vitest: parser fixtures, device-name normalization, result sorting |
| `pnpm test:db`                   | SQL and RLS tests with pgTAP (`supabase test db`)                  |
| `pnpm test:e2e`                  | Playwright smoke test at phone width (needs the local stack)       |
| `pnpm lint`                      | ESLint and a Prettier check                                        |
| `pnpm typecheck`                 | TypeScript                                                         |
| `pnpm format`                    | Prettier write                                                     |
| `pnpm build`                     | Production build to `web/dist`                                     |
| `pnpm check`                     | Lint, typecheck, unit tests and build in one command               |

Two scripts run outside pnpm:

- `node supabase/scripts/api-audit.mjs [--signup]` checks over HTTP, with only the anon key, that reads work and raw writes and cross-user edits are rejected (`--signup` creates two throwaway users, so use it only locally).
- `psql "$DATABASE_URL" -f supabase/scripts/merge_devices.sql` lists likely duplicate devices; see the header of that file for previewing and applying merges.

## How deploys work

- **CI** (`.github/workflows/ci.yml`) runs on every push and pull request: lint, typecheck, unit tests, the local Supabase stack with `db:reset`, pgTAP, the security advisors, the API audit, a stale-types check, the Playwright smoke test and a production build.
- **Deploy** (`.github/workflows/deploy.yml`) runs after CI passes on `main`: `supabase db push` for new migrations, an upsert of the curated devices from `supabase/seed.sql`, then a build published to GitHub Pages. Each part skips itself with a notice until its secrets or variables exist. You can also run it by hand from the Actions tab.
- **Keepalive** (`.github/workflows/keepalive.yml`) reads one row from the production API on Tuesdays and Fridays so the free-tier project never pauses. Run it by hand from the Actions tab to test it.

## Production setup

These are the one-time manual steps. Nothing in the repo needs to change for them; each one unlocks part of the deploy. Values below use the production project ref `wvmjqlrxubletsbpswur` (the ID in the Supabase dashboard URL).

### 1. Link the Supabase project and confirm the Data API settings

1. From the repo root, run `pnpm supabase login`, then `pnpm supabase link --project-ref wvmjqlrxubletsbpswur` and enter the database password. (Forgot it? Reset it under **Project Settings → Database**.) Linking lets you run `pnpm supabase migration list` and `pnpm supabase db advisors --linked` locally. Deploys don't need it: CI links on its own.
2. In the dashboard, open **Project Settings → Data API** (under **Integrations → Data API** in some dashboard versions) and confirm:
   - The Data API is enabled and the exposed schemas include `public`.
   - **Automatically expose new tables and functions** is off. Every table and view gets its grants explicitly in its migration.
   - **Enable automatic RLS** is on.

   A read-only check on September 26, 2026 found all three already true (no default grants to `anon` and `authenticated`, and the `ensure_rls` event trigger present).

3. Never change the schema in the dashboard. Migrations reach prod only through the Deploy workflow.

### 2. Supabase Auth URLs

**Authentication → URL Configuration**:

- **Site URL**: `https://fulloffload.com`
- **Redirect URLs**: `https://fulloffload.com/**`, `http://localhost:5173/**` and `http://127.0.0.1:5173/**`

Sign-in returns to `https://fulloffload.com/#/auth/callback` (PKCE flow), which the first pattern covers.

### 3. GitHub sign-in

1. On GitHub, go to **Settings → Developer settings → OAuth Apps → New OAuth App**:
   - **Application name**: `Full Offload`
   - **Homepage URL**: `https://fulloffload.com`
   - **Authorization callback URL**: `https://wvmjqlrxubletsbpswur.supabase.co/auth/v1/callback`
2. Register it, then **Generate a new client secret**.
3. In Supabase, go to **Authentication → Sign In / Providers → GitHub**, turn it on, paste the **Client ID** and **Client Secret**, and save.

For GitHub sign-in on the local stack, create a second OAuth app with the callback `http://127.0.0.1:54321/auth/v1/callback` and follow the comment above `[auth.external.github]` in `supabase/config.toml`.

### 4. Google sign-in

In the [Google Cloud console](https://console.cloud.google.com/), create (or pick) a project, then in **Google Auth Platform**:

1. **Branding**: app name `Full Offload`, your support email, app home page `https://fulloffload.com`, privacy policy `https://fulloffload.com/#/privacy`, and `fulloffload.com` under **Authorized domains**. If Google asks for the callback's domain too, also add `supabase.co`.
2. **Audience**: **External**, then **Publish app** so it is in production (with only the basic scopes below, no verification is needed).
3. **Data Access**: add the scopes `openid`, `.../auth/userinfo.email` and `.../auth/userinfo.profile`.
4. **Clients → Create client → Web application**:
   - **Authorized JavaScript origins**: `https://fulloffload.com` (add `http://localhost:5173` only while testing locally)
   - **Authorized redirect URIs**: `https://wvmjqlrxubletsbpswur.supabase.co/auth/v1/callback`
5. In Supabase, go to **Authentication → Sign In / Providers → Google**, turn it on, paste the **Client ID** and **Client Secret**, and save.

### 5. Resend for magic-link email

1. In [Resend](https://resend.com), add the domain `fulloffload.com` and add the DNS records it shows (DKIM, SPF and the MX for its sending subdomain) at Hover (step 8). Wait for **Verified**.
2. Create an API key with **Sending access** for `fulloffload.com`.
3. In Supabase, go to **Authentication → Emails → SMTP Settings**, turn on **Enable custom SMTP**, and enter:
   - **Sender email**: `no-reply@fulloffload.com`
   - **Sender name**: `Full Offload`
   - **Host**: `smtp.resend.com`
   - **Port**: `465`
   - **Username**: `resend`
   - **Password**: the Resend API key
4. Under **Authentication → Rate Limits**, raise **emails sent per hour** from the default 30 to what you expect on launch day (for example 200).

### 6. GitHub Actions secrets and variables

In the repo, go to **Settings → Secrets and variables → Actions**.

**Secrets** (tab **Secrets**):

| Name                    | Value                                                                      |
| ----------------------- | -------------------------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN` | A personal access token from https://supabase.com/dashboard/account/tokens |
| `SUPABASE_PROJECT_REF`  | `wvmjqlrxubletsbpswur`                                                     |
| `SUPABASE_DB_PASSWORD`  | The database password (**Project Settings → Database**)                    |

**Variables** (tab **Variables**):

| Name                     | Value                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | `https://wvmjqlrxubletsbpswur.supabase.co`                                                                     |
| `VITE_SUPABASE_ANON_KEY` | The publishable key (`sb_publishable_…`) from **Project Settings → API Keys**. The legacy anon key also works. |

The URL and key are public by design: they ship in the site's JavaScript, and row-level security is what protects the data.

### 7. GitHub Pages and the custom domain

1. In the repo, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**.
2. Under **Custom domain**, enter `fulloffload.com` and save. (`web/public/CNAME` carries the same value.)
3. Recommended: verify the domain for your account under **GitHub Settings → Pages → Add a domain**, which prevents takeovers.
4. After DNS (step 8) resolves and GitHub has issued the certificate, tick **Enforce HTTPS**.
5. Run the **Deploy** workflow from the Actions tab (or push to `main`), then run **Keepalive** once to confirm it can reach the API.

### 8. DNS at Hover

In Hover, open **Domains → fulloffload.com → DNS**. Delete Hover's default parking records for `@`, `www` and `*`, then add:

| Type  | Hostname | Value                 |
| ----- | -------- | --------------------- |
| A     | `@`      | `185.199.108.153`     |
| A     | `@`      | `185.199.109.153`     |
| A     | `@`      | `185.199.110.153`     |
| A     | `@`      | `185.199.111.153`     |
| AAAA  | `@`      | `2606:50c0:8000::153` |
| AAAA  | `@`      | `2606:50c0:8001::153` |
| AAAA  | `@`      | `2606:50c0:8002::153` |
| AAAA  | `@`      | `2606:50c0:8003::153` |
| CNAME | `www`    | `jackwilb.github.io`  |

Also add the records Resend lists in step 5, and the TXT record from GitHub's domain verification in step 7 if you did it. GitHub Pages redirects `www.fulloffload.com` to the apex.

### 9. Before launch

- Set up `privacy@fulloffload.com` (for example, email forwarding at Hover), or change `CONTACT_EMAIL` in `web/src/routes/Privacy.tsx`.
- Replace the placeholder `web/public/og-image.png` (1200×630).
- Submit your own runs through the site.
- Audit prod: `node supabase/scripts/api-audit.mjs https://wvmjqlrxubletsbpswur.supabase.co <publishable key>` (anon checks only) and `pnpm supabase db advisors --linked`.

## License

MIT. See [`LICENSE`](LICENSE).
