# Deploy KDN Brain

Live setup progress on 2026-09-14: the existing Supabase project was restored, inspected (initially no public tables, auth users or storage buckets), and migrations 202609140001 and 202609140002 were applied together through the SQL Editor in one transaction. Verification found 23 tables, all with RLS, zero anon table grants, zero worker functions executable by anon/authenticated, and a private kdn-media bucket. **Do not rerun those two migrations on this project.** Versions 001/002 are recorded in supabase_migrations.schema_migrations with their exact SQL source. Live length and MD5 checks matched both local files. The tracking-table structure was checked against Supabase CLI source commit 407ea2786f7c63c187e30d390ce5213c5745e44c. Use migration list before future db push operations; never reset the remote database.

# KDN Brain connection status — 14 September 2026

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

## Services

1. **Supabase:** existing PostgreSQL/Auth/private Storage project. Inspect it first. Apply migration 001 only if not already applied; then apply 002 and 003 if not recorded. Never reset it. Create one owner auth user, disable signups and run `npm run setup:owner` with that user's UUID.
2. **Web:** Next.js on Vercel or a persistent Node host. Use Node 22 or newer, `npm ci`, `npm run build`, `npm run start`. Configure public Supabase URL/anon key at build time; server service-role key, OWNER_USER_ID and Meta secret/verify token at runtime. Server keys must not have NEXT_PUBLIC prefixes.
3. **Worker:** deploy `Dockerfile.worker` on a persistent container host. It is not a scheduled Vercel function. It requires the Supabase project URL/service-role key, owner ID, OpenAI key, model configuration, budgets and optional Meta media hosts. Use the same database as the web service. Configure restart-on-failure, sufficient temporary storage, a non-root user and at least 512 MB memory (1 GB recommended for video decoding).

Media uploads go directly from the authenticated browser to a private bucket using an exact-path signed upload token. The server verifies stored metadata, then transactionally attaches the asset and queues a new revision. FFmpeg runs in the worker on downloaded bytes, never within the webhook request.

## Container

```sh
docker build -f Dockerfile.worker -t kdn-brain-worker .
docker run --env-file .env.local --restart unless-stopped --name kdn-brain-worker kdn-brain-worker
```

Use a hosting secret manager in production rather than copying a plaintext env file into the image. `.dockerignore` excludes secrets, local work and git metadata. The current deployment uses the owner-funded OpenAI API balance and Railway trial credit; no paid Railway subscription was purchased.

## Release checks

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run doctor
npm run test:provider
```

`doctor` and `test:provider` intentionally fail when required credentials are absent. The latter makes paid provider calls. Browser tests use a local production server and isolated browser profiles: `npx playwright install chromium`, then `npm run test:e2e`.

- Confirm only OWNER_USER_ID can call `/api/brain` and `/api/export` after signing in. API bearer tokens are validated through Supabase Auth on every request.
- Confirm the private bucket and migration 002 grants. An existing bucket is not silently reconfigured.
- Verify Settings shows a recent worker heartbeat, then submit a real manual text capture and sample video. Confirm results and timestamps.
- Verify unknown senders, bad signatures and echo events do not process. Verify Meta retries and follow-up uploads do not create duplicate outputs.
- Test restart during a job, budget exhaustion and manual retry. Leases have a 180-second expiry, renew every 30 seconds, and attempts are bounded. Worker loops do not overlap.
- Watch dead-letter/blocked jobs. Settings offers capture retry; logs contain IDs/error categories rather than captured content or credentials.
- Establish backup and retention/deletion procedures before using this with sensitive long-term data. Owner-facing deletion/retention automation remains unfinished.

## Operating limits and remaining risks

Repository defaults are $0.50 per attempt, $2/capture and $5/day. The current live worker overrides those totals to $1/capture and $1/UTC-day; Vercel displays matching values. A database lock serialises reservations per owner. Reservations remain recorded even when a provider attempt fails, because its billing outcome may be uncertain. Actual OpenAI usage reconciliation is not implemented; estimates are not precise cost guarantees. Model overrides require reviewing the configured reservation and provider spend controls.

There is no external-action executor or automatic notification sender. Consequently no outreach, publishing, purchases or generation can occur through this version. Do not deploy claims that these integrations are enabled.

Source observations and provider-derived results are untrusted. Only typed private workflows are executed. No arbitrary code, SQL or shell is exposed to the model. Raw content is not logged. Temporary media files are cleaned up after success/failure; container hard termination relies on ephemeral storage cleanup.

MCP, complete reviews/opportunity scoring, production OAuth onboarding, notifications, approval UX, retention/deletion and billing reconciliation still need implementation and acceptance tests. The provided code is a substantial manual pipeline, not completion of the entire original specification.

## Final fallback and budget check

The separate synthetic fallback capture 1207d5a5-d80c-4ccc-8ef7-57e9623887a0 first reached Needs content / URL_ONLY, then accepted a transcript and queued revision 2 on the same item. Query embedding completed, but the first attempt failed before a recorded understanding. The automatic retry was blocked by the US$1 daily reservation limit. No artifact was created for this fixture; live fallback-to-output completion remains unverified. The already completed owned-video script is unaffected. No limit was increased and no reservation was removed. The failed attempt's exact underlying cause was not available in the safe worker logs. Stored semantic retrieval was checked separately with its existing embedding and returned the sample-video record successfully, without a new provider call.

Migration 202609140003_retry_budget preserves attempt numbers across manual retries so an old paid reservation cannot be reused. A real SQL regression test verifies denial at the daily limit and a separate reservation after a simulated day reset. The production migration changes only this function and preserves captures, artifacts, checkpoints and reservations. All 42 automated tests, lint, typecheck and production build pass.
