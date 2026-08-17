# MCP

The intended endpoint is `/mcp`, authenticated with `Authorization: Bearer $KDN_MCP_TOKEN`. The database and domain functions are deliberately narrow; unrestricted SQL is never exposed. Read tools cover search/fetch, memory, goals, projects, opportunities, actions and relationships. Write tools cover captures, actions, experiments, links and archive. Destructive operations require client approval and all calls must be audited. Remote OAuth is a later replacement for the V1 bearer-token boundary.

The Supabase Codex MCP server is a development tool, not an application runtime dependency. This environment did not contain the `codex` CLI; run the commands in `SETUP_CHECKLIST.md` from a Codex installation.
