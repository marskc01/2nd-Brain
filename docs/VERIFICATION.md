# Verification and implementation status

Checked 14 September 2026. The local checkout is the saved `2nd Brain` project. It arrived with untracked foundation files and no configured Git remote; no claim is made that a remote PR or the earlier reported commit was updated. Source changes were made in that existing project, with a local foundation snapshot under ignored `work/`.

## Passed

- `npm run lint` — application, scripts and tests.
- `npm run typecheck` — strict application TypeScript check.
- `npm test` — **32 tests across five files**.
- `npm run build` — optimised Next.js production build.
- `npm run test:e2e` — **four browser tests**, desktop and mobile layouts.
- `npm audit --omit=dev` — no reported production vulnerabilities at verification time.
- Desktop and mobile rendered screenshots were visually inspected. Navigation, demo capture, artifact download, context entry and removal worked; viewport overflow was checked.

## What those tests establish

| Area | Actual test | Boundary |
| --- | --- | --- |
| Signatures/verification | Correct/incorrect raw-body HMAC, nonhex signature, nonempty verify token | Synthetic requests, no Meta call |
| Ingestion | Whole batch, duplicate retry, new message ID, unknown sender/echo, failed durability | Real SQL via PGlite, synthetic envelopes |
| Auth/data | Bearer validation/owner rejection and database RLS rejection of another user | Auth provider response simulated; PostgreSQL RLS actually executed |
| Jobs | Leases, expiry recovery, stale completion rejection, pause, retry checkpoints | Local PostgreSQL-compatible engine; no live worker fleet |
| Budgets | Two attempted reservations, one admitted under the daily limit; retry charged separately | Real SQL and Promise concurrency; PGlite serialises its database connection, not a production multi-connection load test |
| Resume/idempotency | Same request/submission deduplicated; matching output updated in place | Real SQL, no live upload service |
| Media | Original 10-second MP4 decoded by installed FFmpeg, audio extracted, frames/timestamps sampled; corrupt and oversized bytes rejected | Real local decoding, no AI perception claim |
| Vertical slice | Sample media → FFmpeg → simulated typed AI evidence/script → real SQL artifact/action/observation/embedding persistence | AI provider and storage transport simulated |
| Truthfulness | URL-only/missing content does not call perception or create invented outputs | Fixture tests |
| UI | Owner setup gate, private API rejection, demo navigation, capture, download, context, removal, mobile layout | Local production server, isolated test browsers |

## Deliberately unverified

- **Live OpenAI:** `npm run test:provider` exited with `OPENAI_API_KEY is missing`, without making a call. Actual speech recognition, visual interpretation, structured provider outputs, research citations and account model access remain unverified.
- **Live Supabase:** no application URL/key/owner credentials were configured in the process or checkout. `npm run doctor` correctly reported these as missing. No remote schema was inspected or migrated.
- **Instagram:** no professional-account credentials, live shared Reel, direct attachment, expiry timing, permission/review or notification test. Meta's official Postman collection was consulted; the full current webhook-reference page could not be fetched.
- **Deployment:** Dockerfile and deployment instructions are supplied. Docker was not installed in this environment, so the worker image was not built here. No web/worker service was deployed, and no app can yet run continuously while the laptop is closed.

## Implemented but awaiting live acceptance

Owner-authenticated manual capture, private signed upload/finalisation, real provider adapters, pipeline inference/routing/research, pgvector retrieval, worker execution and dashboard result presentation have code and local tests. To certify them end-to-end against real services, configure application credentials and follow the manual text/video test before connecting Instagram.

## Remaining original scope

- OAuth connection onboarding; live account diagnostics UI; automatic acknowledgements/completion DMs and delivery reconciliation.
- Approval screens, standing-rule management and enabled external action executors. Existing policy helpers gate dangerous action types, but no external tool actually executes.
- Full entity/relationship graph, hybrid conversational Ask Brain, claim/source normalisation into all original research tables, opportunity scores/history and experiment result tracking.
- Weekly reviews, clustering, MCP tools, Higgsfield integration, retention policy enforcement and owner-facing deletion.
- Actual provider-usage/cost reconciliation. Reservations are estimated safeguards.
- Full unbounded source/media export; current export contains owner-facing records and explicitly excludes raw media bytes/webhook/worker logs.
- Live notification-failure test (no sender enabled); production multi-worker load testing and hosted container smoke test.

These are visible limitations, not capabilities hidden behind a connected badge. KDN Brain v0.2 is a substantial continuation and a testable manual pipeline; it does not satisfy every criterion in the original full-system request yet.
