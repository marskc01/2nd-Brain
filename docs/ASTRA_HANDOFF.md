# KDN Brain + Astra

Checked 14 September 2026.

## Available now

Open any capture and use **Continue in Astra**. Enter the result you want, choose whether to include saved personal context, review the brief, then **Copy Astra brief** or **Download Astra brief**. Paste it into an Astra conversation and attach the original video if its actual contents are needed.

The brief includes the selected capture's source text, recorded visual/speech evidence and timestamps, coverage, explicit owner instruction, inferred intent, research sources, existing outputs and execution records. Optional context includes active goals, owner notes and the linked project. It asks Astra to complete useful work and report real outputs, while separating source claims from evidence and preserving external-action permissions.

The brief is composed locally from existing records. It makes no new model request, starts no agent, changes no capture state and does not consume KDN Brain's API reservation budget. It includes no private media URLs or credentials. Review it before sharing; source text and personal context may be private. This is a text handoff, not an automatic connection between KDN Brain and Codex, and it does not write Astra results back to KDN Brain.

When content is missing, the brief says so and asks for video/screenshots/transcript. It does not pretend that an Instagram permalink was watched. Uploaded video was successfully analysed in a previous live test; arbitrary Instagram Reel media retrieval remains unverified. A new agent model cannot remove that source-access limitation.

## Three different limits

1. **KDN Brain's own operating limit:** currently US$1/day and US$0.50 reserved per paid attempt. These are conservative application reservations, not measured provider invoices. This rule can stop work before that amount was actually billed.
2. **OpenAI Platform billing:** the deployed worker and future Agents API sessions use the application's API credentials and API billing. A saved agent is configuration, not free inference.
3. **Your Astra conversation:** using Codex/ChatGPT Work while signed in with ChatGPT consumes the applicable plan allowance. API-key sign-in uses API billing instead. Moving a prompt between surfaces does not eliminate usage.

[Authentication and billing](https://learn.chatgpt.com/docs/auth), [Codex/Work shared usage](https://learn.chatgpt.com/docs/pricing), [Agents API prerequisites](https://developers.openai.com/api/docs/guides/agents-api/quickstart).

## Recommended next stage — not yet implemented

Keep Instagram ingestion, Supabase memory and Railway media processing. Add a decision step that chooses between saving a reference, completing routine private work, requesting missing content, or escalating a substantial task. Every processed capture should have an Astra handoff even when escalation cannot run automatically.

For advanced automatic execution, use one Agents API executor with gpt-6-astra and an OpenAI-hosted sandbox. Give it narrowly scoped tools to read selected KDN context, research public sources, create files and return artifacts. Keep job/session/turn IDs and reconcile results before retries. Store artifacts back against the original capture. Approval remains necessary for external communications, publishing, purchases and destructive operations. The existing OpenAI SDK version (7.15.x) supports the documented API namespace, but this project's Agents API/model/sandbox access has not been live-tested.

Before enabling that executor, replace blanket reservation estimates with stage-specific bounds and reconciliation using returned token/tool usage, while retaining conservative reservations for uncertain failures. Measure a small set of real captures: media coverage, output usefulness, failures, latency and actual cost. Keep the approved operating limit until the owner chooses another limit. Add specialist agents only if evaluation shows that the additional calls improve results.

The current documentation supports durable hosted sessions, tools, files, web search and continuing tasks; these are capabilities to integrate, not proof that KDN Brain has them already. No Agents API session or new paid test was started for the handoff feature.

[Agents API capabilities](https://developers.openai.com/api/docs/guides/agents-api/overview), [Hosted quickstart](https://developers.openai.com/api/docs/guides/agents-api/quickstart), [Recorded agent usage](https://developers.openai.com/api/docs/guides/agents-api/observability).
