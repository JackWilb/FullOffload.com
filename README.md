# Full Offload

See which models hit full offload on your hardware. Full Offload (fulloffload.com) collects real tokens-per-second measurements for local LLMs: people submit their device, the exact command they ran (llama.cpp, Ollama, vLLM, MLX, LM Studio or anything else) and the generation and prompt-processing speeds it printed. Visitors pick their GPU or Mac and see the median speeds for every runtime, model, quant and device count reported on it, with the commands behind every number. It is a static React app on GitHub Pages that talks directly to one Supabase project; validation, rate limiting and device matching live in Postgres.

## Local setup

You need Node.js (version in `.nvmrc`), pnpm (version in `package.json`'s `packageManager`, for example via `corepack enable`) and Docker.

```sh
pnpm install
pnpm db:start                 # local Supabase stack in Docker
cp web/.env.example web/.env  # local-stack URL and anon key
pnpm db:reset                 # apply migrations and seed curated devices
pnpm dev                      # http://localhost:5173
```

## Scripts

All scripts run from the repo root.

| Script                           | What it does                                                     |
| -------------------------------- | ---------------------------------------------------------------- |
| `pnpm dev`                       | Start the Vite dev server                                        |
| `pnpm db:start` / `pnpm db:stop` | Start or stop the local Supabase stack                           |
| `pnpm db:reset`                  | Reset the local database, apply all migrations and run the seed  |
| `pnpm db:types`                  | Regenerate `web/src/lib/database.types.ts` from the local schema |
| `pnpm test`                      | Vitest (parser fixtures, device-name normalization)              |
| `pnpm test:db`                   | SQL and RLS tests with pgTAP (`supabase test db`)                |
| `pnpm test:e2e`                  | Playwright smoke test at phone width                             |
| `pnpm lint`                      | ESLint and Prettier check                                        |
| `pnpm typecheck`                 | TypeScript                                                       |
| `pnpm format`                    | Prettier write                                                   |
| `pnpm build`                     | Production build to `web/dist`                                   |
| `pnpm check`                     | Lint, typecheck, unit tests and build in one command             |

## License

MIT. See `LICENSE`.
