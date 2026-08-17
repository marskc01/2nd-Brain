# KDN Brain

KDN Brain is Kaden Condie's single-owner **personal intelligence and opportunity engine**. It preserves an incoming source, understands it with validated AI output, connects it to personal context, challenges commercial claims, and recommends the smallest useful action.

## Architecture

```text
Instagram / manual / MCP → authenticated adapter → raw event + capture → durable job
 → intake analysis → embedding + entity graph → opportunity score → optional research → action
                                      ↘ Supabase Postgres + pgvector ↗
Next.js App Router dashboard ← owner-authenticated queries         Remote MCP clients
```

The Next.js application deploys to Vercel. Supabase provides Auth, Postgres, pgvector and optional Storage. OpenAI is behind typed provider interfaces. Webhooks save before processing and return without waiting for AI. Meta, research and Higgsfield are optional adapters, not startup dependencies.

## Local development

Requires Node 22+ and a Supabase project/local CLI.

```bash
npm install
cp .env.example .env.local
npm run setup
npm run doctor
npm run dev
```

Apply `supabase/migrations/202608170001_initial.sql` with `supabase db reset` locally or link a hosted project and run `supabase db push`. Create the one owner through Supabase Auth; public registration should remain disabled. The service role key is server-only.

## Configuration

`.env.example` documents every variable. Supabase and OpenAI enable the core live pipeline. Meta enables Instagram capture. `KDN_MCP_TOKEN` enables remote MCP. Research and Higgsfield are optional. Never expose secrets using `NEXT_PUBLIC_`.

## Testing

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:webhook # while dev server runs, with fixture-compatible Meta secret/owner
```

Fixtures cover a Reel and enumerate DM, URL, duplicate, unknown-sender, malformed and bad-signature cases. Captures remain stored if enrichment fails.

## Instagram and MCP

Follow [the official-documentation-based Instagram guide](docs/INSTAGRAM_SETUP.md). Full media is not guaranteed; URL-only state is explicit. See [MCP setup and safety](docs/MCP.md). Development-only Supabase MCP commands are in [the human checklist](SETUP_CHECKLIST.md).

## Deployment to Vercel

1. Import this repository into Vercel and set all production environment variables.
2. Apply Supabase migrations before traffic reaches the deployment.
3. Run `npm run readiness` with production variables.
4. Deploy, visit `/api/health`, then configure Meta callback as `https://YOUR_DOMAIN/api/webhooks/meta/instagram`.
5. Send a signed fixture before a live Reel. Inspect `raw_events`, `captures`, and `jobs`.

## Security and backups

RLS protects owner records; service credentials stay server-side. Meta POSTs require an HMAC signature, sender IDs are allow-listed, MCP requires a strong bearer token, external generation defaults to approval, and raw inputs/audit records are retained. Enable Supabase point-in-time recovery or scheduled backups appropriate to the plan and periodically export JSON/Markdown/CSV before relying on the system as long-term memory.

## Troubleshooting

- **Webhook 401:** wrong `META_APP_SECRET` or raw-body signature.
- **Webhook verifies but no capture:** owner IGSID mismatch; inspect quarantine events.
- **Capture saved but never analysed:** inspect `jobs` and OpenAI configuration.
- **Semantic search unavailable:** apply the pgvector migration; keyword retrieval still works.
- **Build is healthy but integrations show missing:** run `npm run doctor`; optional integrations do not block manual capture.

## Current boundary

The repository supplies the vertical-slice schema, adapters, secure ingestion, opportunity arithmetic, structured OpenAI provider, serious dashboard shell, MCP discovery/read/capture functions, fixtures, tests, and deployment documentation. A production worker/cron trigger must claim queued jobs and execute the staged provider workflow; until then captures are durably queued rather than falsely reported as analysed. Higgsfield remains an approval-gated connection architecture and never spends credits automatically.
