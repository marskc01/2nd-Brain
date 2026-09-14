# Verification and implementation status

Checked 14 September 2026. Source is deployed from marskc01/2nd-Brain main. The local project retains its original untracked workspace; GitHub PRs record the deployed changes.

## Passed

- `npm run lint` — application, scripts and tests.
- `npm run typecheck` — strict application TypeScript check.
- `npm test` — **42 tests across eight files**.
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

## Live acceptance on 14 September 2026

## Verified live

- Production: https://2nd-brain-phi.vercel.app/ — owner sign-in, private uploads, authenticated data and visible outputs.
- Supabase dgbrxgkktdqjymjmnrzr: restored, migrations 001/002 recorded, 23 public tables with RLS, private kdn-media bucket, owner-only access and public registration disabled. Do not reset or rerun these migrations.
- Meta app Published, @kdn_brain connected, account subscription On. Raw-body signing validation and durable ingestion are enabled. The Instagram-specific signing secret is used for this Instagram Login setup.
- Fresh @kadencondie share at 21:23:19 Perth was accepted automatically with HTTP 200, without manual quarantine release. Capture 6c571683-ae78-4e00-a999-90cc293c69a9 completed its worker job at 21:23:59 as Needs content / URL_ONLY.
- The real ig_reel payload supplied a permalink and reel_video_id, without playable media or caption. A deliberate repeat share created a distinct capture; webhook retries remain deduplicated.
- Railway kdn-brain-worker is Online, built from main with Dockerfile.worker and FFmpeg. GitHub installation access was verified as only marskc01/2nd-Brain. One persistent replica, no public domain, sleep off, restart on failure.
- Dedicated OpenAI KDN Brain project/service-account key and the existing Supabase service-role key were stored as server-only Railway secrets under the owner's explicit approval.
- Owned synthetic 10-second video uploaded through the live dashboard completed at 21:24:29. Whisper returned the known speech, sampled vision identified the red square at 0ms and blue square at 5000ms. A script artifact and one completed action are visible on the same capture.
- [Video test output](https://2nd-brain-phi.vercel.app/?item=200823b0-ca9d-4ee5-88d6-9ec63c42a26c#inbox). [Real automatically captured Reel](https://2nd-brain-phi.vercel.app/?item=6c571683-ae78-4e00-a999-90cc293c69a9#inbox).
- Dashboard read recovery fix merged as PR #6 / bae770c. Vercel and Railway reported successful production deployments. Reads retry transient failures once with bounded deadlines, loading errors clear after recovery, and polling does not overlap. Vercel functions now run in Seoul near Supabase. Safe diagnostic logs omit private error text.
- Validation: 42 automated tests, lint, typecheck and production build pass. Four desktop/mobile browser tests passed in the earlier UI pass.

## Limits and remaining verification

- Instagram media retrieval is unverified; the tested shared Reel cannot be watched from its delivered permalink. Use its authenticated upload/transcript fallback. Actual uploaded-video processing is verified separately.
- Automatic replies remain off. Separate follow-up DMs are not auto-associated with a prior Reel. Broader account eligibility/review and live direct-media attachment retrieval/expiry remain unverified.
- Operating settings: US$1/day, US$1/capture, estimated US$0.50 reservation/paid attempt. Costs are not reconciled to actual usage. OpenAI automatic reload is off. Railway trial is US$5 or 30 days; no paid plan was purchased.
- Live web research, production multi-worker interruption/load tests, notification delivery, external executors, approval UX, full memory chat, scoring/reviews, MCP, retention/deletion and Higgsfield remain outside the verified implementation.

## Remaining original scope

- OAuth connection onboarding; live account diagnostics UI; automatic acknowledgements/completion DMs and delivery reconciliation.
- Approval screens, standing-rule management and enabled external action executors. Existing policy helpers gate dangerous action types, but no external tool actually executes.
- Full entity/relationship graph, hybrid conversational Ask Brain, claim/source normalisation into all original research tables, opportunity scores/history and experiment result tracking.
- Weekly reviews, clustering, MCP tools, Higgsfield integration, retention policy enforcement and owner-facing deletion.
- Actual provider-usage/cost reconciliation. Reservations are estimated safeguards.
- Full unbounded source/media export; current export contains owner-facing records and explicitly excludes raw media bytes/webhook/worker logs.
- Live notification-failure test (no sender enabled); production multi-worker load testing.

These are visible limitations, not capabilities hidden behind a connected badge. KDN Brain v0.2 is a substantial continuation and a testable manual pipeline; it does not satisfy every criterion in the original full-system request yet.

## Final fallback and budget check

The separate synthetic fallback capture 1207d5a5-d80c-4ccc-8ef7-57e9623887a0 first reached Needs content / URL_ONLY, then accepted a transcript and queued revision 2 on the same item. Query embedding completed, but the first attempt failed before a recorded understanding. The automatic retry was blocked by the US$1 daily reservation limit. No artifact was created for this fixture; live fallback-to-output completion remains unverified. The already completed owned-video script is unaffected. No limit was increased and no reservation was removed. The failed attempt's exact underlying cause was not available in the safe worker logs. Stored semantic retrieval was checked separately with its existing embedding and returned the sample-video record successfully, without a new provider call.

Migration 202609140003_retry_budget preserves attempt numbers across manual retries so an old paid reservation cannot be reused. A real SQL regression test verifies denial at the daily limit and a separate reservation after a simulated day reset. The production migration changes only this function and preserves captures, artifacts, checkpoints and reservations. All 42 automated tests, lint, typecheck and production build pass.
