# Deploy KDN Brain

Live setup progress on 2026-09-14: the existing Supabase project was restored, inspected (initially no public tables, auth users or storage buckets), and migrations 202609140001 and 202609140002 were applied together through the SQL Editor in one transaction. Verification found 23 tables, all with RLS, zero anon table grants, zero worker functions executable by anon/authenticated, and a private kdn-media bucket. **Do not rerun those two migrations on this project.** Both versions are recorded in supabase_migrations.schema_migrations with their exact SQL source. Live length and MD5 checks matched both local files. The tracking-table structure was checked against Supabase CLI source commit 407ea2786f7c63c187e30d390ce5213c5745e44c. Use migration list before future db push operations; never reset the remote database.

The existing Vercel project marskc01s-projects/2nd-brain had Framework Preset Other, causing its preview to fail looking for a public output directory. It is now saved as Next.js with automatic output defaults. The v0.2 preview built and deployed successfully at https://2nd-brain-9688tvnu2-marskc01s-projects.vercel.app/ from commit 9657d5c. Its setup-required screen was inspected. The existing Supabase variables are configured for Production only, and NEXT_PUBLIC_SUPABASE_URL was verified against the intended project. Owner login, owner UUID configuration, production release, persistent worker, OpenAI/Meta credentials and live provider tests still require completion. The old production URL returned 404 during inspection.

## Services

1. **Supabase:** existing PostgreSQL/Auth/private Storage project. Inspect it first. Apply migration 001 only if not already applied; then apply 002. Never reset it. Create one owner auth user, disable signups and run `npm run setup:owner` with that user's UUID.
2. **Web:** Next.js on Vercel or a persistent Node host. Use Node 22 or newer, `npm ci`, `npm run build`, `npm run start`. Configure public Supabase URL/anon key at build time; server service-role key, OWNER_USER_ID and Meta secret/verify token at runtime. Server keys must not have NEXT_PUBLIC prefixes.
3. **Worker:** deploy `Dockerfile.worker` on a persistent container host. It is not a scheduled Vercel function. It requires the Supabase project URL/service-role key, owner ID, OpenAI key, model configuration, budgets and optional Meta media hosts. Use the same database as the web service. Configure restart-on-failure, sufficient temporary storage, a non-root user and at least 512 MB memory (1 GB recommended for video decoding).

Media uploads go directly from the authenticated browser to a private bucket using an exact-path signed upload token. The server verifies stored metadata, then transactionally attaches the asset and queues a new revision. FFmpeg runs in the worker on downloaded bytes, never within the webhook request.

## Container

```sh
docker build -f Dockerfile.worker -t kdn-brain-worker .
docker run --env-file .env.local --restart unless-stopped --name kdn-brain-worker kdn-brain-worker
```

Use a hosting secret manager in production rather than copying a plaintext env file into the image. `.dockerignore` excludes secrets, local work and git metadata. Hosting charges require your own account and service selection; none were incurred by this build.

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

Default $0.50 reservation per attempt; $2 capture total and $5 UTC-day total. A database lock serialises reservations per owner. Reservations remain recorded even when a provider attempt fails, because its billing outcome may be uncertain. Actual OpenAI usage reconciliation is not implemented; estimates are not precise cost guarantees. Model overrides require reviewing the configured reservation and provider spend controls.

There is no external-action executor or automatic notification sender. Consequently no outreach, publishing, purchases or generation can occur through this version. Do not deploy claims that these integrations are enabled.

Source observations and provider-derived results are untrusted. Only typed private workflows are executed. No arbitrary code, SQL or shell is exposed to the model. Raw content is not logged. Temporary media files are cleaned up after success/failure; container hard termination relies on ephemeral storage cleanup.

MCP, complete reviews/opportunity scoring, production OAuth onboarding, notifications, approval UX, retention/deletion and billing reconciliation still need implementation and acceptance tests. The provided code is a substantial manual pipeline, not completion of the entire original specification.
