# Human-only setup checklist
- [ ] Create Supabase project and run `supabase/migrations`.
- [ ] Add Supabase credentials to Vercel/local environment.
- [ ] Add OpenAI API key and confirm configured models are available to the account.
- [ ] Convert @kdn_brain to Professional if Meta currently requires it.
- [ ] Create/configure Meta developer app, authorise @kdn_brain and paste webhook URL.
- [ ] Add Meta credentials and owner IGSID; send a test Reel.
- [ ] Generate a strong MCP bearer token.
- [ ] Deploy to Vercel and run `npm run readiness` with production environment loaded.
- [ ] In a Codex CLI environment: `codex mcp add supabase --url "https://mcp.supabase.com/mcp?project_ref=dgbrxgkktdqjymjmnrzr&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching"`, then `codex mcp login supabase` and verify with `/mcp`.
