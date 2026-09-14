# KDN Brain

An owner-only application that turns captured source text and accessible media into useful private outputs. Version 0.2 continues the original foundation with an implemented manual workflow, provider adapters, transactional worker, authenticated dashboard and usage guide.

**Status:** local application and automated tests pass. No cloud deployment, live Supabase connection, actual OpenAI perception, or live Instagram DM/reply was verified. The original full specification is not yet complete. No existing remote database was modified.

## Start here

- **Detailed walkthrough:** [docs/USAGE.md](docs/USAGE.md)
- **Instagram support and uncertainties:** [docs/INSTAGRAM_FEASIBILITY.md](docs/INSTAGRAM_FEASIBILITY.md)
- **Deploy web + worker:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- **Verification and remaining work:** [docs/VERIFICATION.md](docs/VERIFICATION.md)

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`, then **Open demo**. Demo data is labelled, local to the browser and removable. AI, media uploads and Instagram do not run in demo mode.

For the real service, configure `.env.local` from `.env.example`, inspect the intended Supabase project `dgbrxgkktdqjymjmnrzr`, apply migrations 001 (if not already applied) and 002 in order, create the sole auth user, set OWNER_USER_ID, and run:

```sh
npm run setup:owner
npm run doctor
npm run dev
# A separate terminal or persistent deployed container:
npm run worker
```

Add an OpenAI application API key for paid analysis. A text capture with `/save` is the no-provider reference path. All API requests require a valid Supabase bearer token for the configured owner. Browser table writes and privileged RPC execution are revoked; server policy mediates mutations.

## Implemented

- Owner login, capture form, signed direct-to-private-storage upload, item evidence/coverage, Markdown downloads, retry/resume, project/goal editing, context/pause settings, record export and health.
- Raw-body Meta HMAC verification, bounded request body, atomic envelope/message/capture/job ingestion, sender allow-list, echo filtering and deduplication.
- Persistent worker: non-overlapping loop, renewable leases, bounded attempts/backoff, checkpoints, dead-letter/blocked jobs and guarded atomic completion.
- Real FFmpeg decoding, bounded audio extraction and regular/scene-change frame sampling. OpenAI SDK adapters for timestamped Whisper transcription, structured vision/understanding/artifacts, capped web search and 1536-dimension embeddings.
- Typed private routing to references, assessments, comparisons, scripts, briefs, checklists, experiment proposals and selected project notes. Executed private actions point to actual artifacts; external effects have no executor.
- pgvector retrieval plus keyword fallback, explicit source evidence with timestamps, stored observations and project associations. Ask Brain currently returns keyword-matched records, not a generated personal-memory answer.
- Atomic estimated budget reservations per processing attempt. Daily reset is UTC; costs are not reconciled to invoices.
- No automatic arbitrary-Reel download claim. Shared/unknown URLs retain missing-content status; owner uploads resume the same capture. Source URLs are not scraped.

## Architecture

```mermaid
flowchart LR
  Owner[Owner sign in] --> UI[Next.js dashboard]
  UI --> API[Owner-validated API]
  UI --> Upload[Exact-path signed upload]
  Upload --> Storage[(Private Supabase Storage)]
  IG[Instagram DM] --> HMAC[Raw-body HMAC check]
  HMAC --> TX[Atomic envelope + capture + job]
  API --> TX
  TX --> PG[(Supabase PostgreSQL)]
  PG --> Worker[Persistent leased Node worker]
  Storage --> Worker
  Worker --> Media[FFmpeg audio + sampled frames]
  Media --> OpenAI[Transcription + vision + structured reasoning]
  OpenAI --> Memory[Context + pgvector / keyword retrieval]
  Memory --> Policy[Typed private workflow + budget gate]
  Policy --> Output[Artifact + evidence + execution record]
  Output --> PG
  PG --> UI
```

The web app can run on Vercel; media processing belongs in the separate Node/FFmpeg container. Your laptop need not remain open **after those services are deployed**.

## Tests

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm test` runs fixture/security tests, real PGlite PostgreSQL-compatible migrations/transactions, actual FFmpeg extraction and a vertical slice with explicitly simulated AI. It is not a live Supabase or Instagram test.

`npm run test:provider` makes actual OpenAI calls using the included original sample video and saves a private script/evidence result. Missing credentials produce an unverified exit code. `npm run sample:video` regenerates the synthetic fixture on macOS using FFmpeg and `say`; the committed video works for tests on Linux too.

## Genuine human connection steps

1. Provide authorised access/application credentials for the intended Supabase project and create the single owner auth account. Inspect existing data before applying migrations; never reset it.
2. Supply an OpenAI application key and billing access. Review operating limits.
3. Choose and authorise web/worker hosting, set production secrets and verify the manual workflow.
4. Authorise the Meta professional-account/app configuration, required permissions/review and subscription; send actual test messages from the allowed owner.

## Limits

The app is not the complete original 22-section system. OAuth onboarding UI, automated replies, live external tools, paid generation, approval/standing-rule UI, complete retention/deletion, conversational Ask Brain, review/cluster detection, opportunity scoring, full entity graph and authenticated MCP are not implemented. The unused initial-schema tables are not proof those features work. Prototype ideas are not scored as verified demand.

Migrations preserve existing data but 002 deliberately revokes direct browser mutations and closes privileged-function access. Review migration effects before applying to an existing shared project. Worker reservations are estimates and do not implement hard provider billing reconciliation. See the verification matrix for precise test boundaries.
