# KDN Brain — how to use it

Updated 14 September 2026. This version adds a working manual-capture implementation to the earlier foundation. Live OpenAI, Supabase and Instagram operation still requires explicit application credentials. The demo is separate and uses browser-local example data.

## 1. Explore it now

From the saved **2nd Brain** project:

```sh
cd "/Users/kadencondie/Documents/ChatGPT/2nd Brain"
npm ci
npm run dev
```

Open <http://localhost:3000> and choose **Open demo**. No credentials are needed. The sample experiment and unavailable Reel illustrate the interface. Demo text captures become local references, without AI analysis or research. **Remove demo data** clears this browser's examples and local captures; **Settings → Reload demo examples** restores examples.

Demo mode does not receive DMs, call OpenAI, process uploads, or write to Supabase. Do not mistake the example experiment for an experiment that was actually run.

## 2. Connect the real application once

### Supabase

The intended project reference is `dgbrxgkktdqjymjmnrzr`. Access to that project has not been demonstrated. Use that project if it is yours and accessible; otherwise choose an explicit replacement.

1. Open the project dashboard and inspect existing tables/data. Back up any existing production database before applying schema changes.
2. Copy `.env.example` to `.env.local`. Fill the project URL, browser anon key and server service-role key. Keep the service-role key out of browser code and screenshots.
3. Apply `supabase/migrations/202609140001_initial.sql` **only if the initial schema is not already applied**. Then apply `202609140002_working_pipeline.sql`. These migrations create/add schema; they do not reset the database. Migration 002 also closes permissions left open by 001. Do not rerun 001 over existing tables.
4. In Supabase Authentication, create the single owner account with an email and password. Set `OWNER_USER_ID` in `.env.local` to its auth UUID. Disable public signups.
5. Run `npm run setup:owner`. This ensures the profile exists and preserves an existing profile.
6. Confirm the `kdn-media` Storage bucket exists and is private. Migration 002 creates it for fresh installations; if it already existed, verify its limits and privacy manually.

### OpenAI

Use an **application API key with billing enabled**. A Codex subscription, connected plugin, or browser login is not an API credential for this service.

Set `OPENAI_API_KEY` in `.env.local` and in the deployed worker environment. The models are centralised in `.env.example`/`src/lib/config.ts`. The timestamped audio adapter uses `whisper-1`; do not change that value without changing the adapter. Reasoning and sampled vision default to `gpt-4.1-mini`. Embeddings default to `text-embedding-3-small` at 1536 dimensions. Actual account access remains a live test.

Defaults reserve an estimated $0.50 per processing attempt, with $2 per capture and $5 per UTC day. Reservations are concurrency-safe but are **not reconciled invoices or a guarantee of exact provider spend**. Configure provider-side project controls too. Retried jobs can reserve more budget. A checkpoint avoids repeating successful stages.

### Start both processes

In the web terminal:

```sh
npm run doctor
npm run dev
```

In a second terminal, from the same project directory:

```sh
npm run worker
```

The worker reads `.env.local`, claims one capture at a time and needs FFmpeg/ffprobe on PATH. On this Mac those tools were found. For deployment, use the included worker Dockerfile.

Sign in at <http://localhost:3000>. **Settings** should show successful database queries and a recent worker heartbeat. “Configured, unverified” means credentials exist; it does not certify the provider connection.

## 3. Give Brain your context

Use **Projects & goals** to add or edit current work and desired outcomes. Archive obsolete context instead of treating it as current. In **Settings**, add your skills, interests, existing tools, markets, ambitions, available time, constraints and things you do not want.

No business, career or location facts from the original prompt were inserted as confirmed personal facts. Demo projects and examples stay separate from the database.

## 4. Make your first real capture

Start with text so you can verify the full application before involving Instagram.

1. Select **Quick capture**.
2. Paste this example in **Source text or transcript**: “Open a short property walkthrough on its most distinctive visual feature, then show the layout and close-up details.”
3. In **What would you like from this?**, enter “Write a 30-second script using this structure. Mark any invented property details as placeholders.”
4. Select **Save & process**.
5. Open the item in **Inbox**. Its private script appears under **Outputs** after the worker succeeds.
6. Check the coverage: text input should not say that video was analysed. Download the result as Markdown.

For a no-provider database test, use `/save` with source text. That stores a real searchable reference without calling OpenAI.

## 5. Test a video

The repository includes `tests/fixtures/media/owned-sample.mp4`, an original synthetic 10-second test clip. It shows a red square on the left, then a blue square on the right, with known speech. The manifest records its expected content.

Upload it in **Quick capture**, with “Make a short script using this visual contrast.” Check the output and timestamped evidence. Video processing samples at regular intervals plus detected scene changes, up to 12 frames per asset. It transcribes audio with segment timestamps and analyses sampled frames, including readable on-screen text. It is not exhaustive frame-by-frame viewing.

Supported uploads: MP4, MOV, WebM, JPEG and PNG. Limits: 25 MB per asset, 120 seconds per video, 4096 pixels per side and three uploads per capture. Browser upload goes directly to private Supabase Storage using a short-lived token for one path; large media does not pass through a Vercel function.

For the direct provider smoke test:

```sh
npm run test:provider
```

This command makes billable OpenAI calls, checks known content, and writes the resulting script/evidence into `work/provider-smoke/`. It is separate from the database/UI test. With no key it exits as **unverified**, without a paid call.

## 6. Tell it what you want

| Instruction | What the application produces |
| --- | --- |
| `/save` or “Just save this” | A reference; no unnecessary research or experiment |
| `/research` or “Check this claim” | A private assessment using current web research where available |
| `/compare` | A comparison artifact with research sources |
| `/experiment` or “Could this be a service?” | A small proposed experiment, including uncertainty and success criteria |
| `/script` | A private script draft |
| “Create a production checklist” | A checklist when selected by the model |
| `/project` | A private project note attached to the project explicitly selected in the form |
| No instruction | A bounded private workflow chosen from actual content and stored context |

One artifact is created per run. “Completed” means that artifact exists; it does not mean its proposed experiment ran, footage was edited, or content was published. Source claims remain claims until evidence supports them.

## 7. Use Instagram after connecting and testing Meta

The webhook endpoint is `/api/webhooks/meta`. The app requires `META_APP_SECRET`, `META_VERIFY_TOKEN`, `OWNER_USER_ID` and `OWNER_INSTAGRAM_ID`. The last value is the sending owner's **Instagram-scoped numeric ID**, not `@kdn_brain` and not the receiving account's ID.

Follow `docs/INSTAGRAM_FEASIBILITY.md`. Meta's API collection confirms professional-account messaging and warns that shares can supply only a URL. Receiving a Reel share does not prove a playable video is available.

Once live delivery is proven, send Reels to `@kdn_brain`. The signed event is durably stored and queues processing. Unknown senders are quarantined; message echoes do not queue work. Identical webhook retries are deduplicated; a deliberate second share with a new message ID remains a separate capture.

A separate follow-up DM is **not automatically attached** to a previous Reel. Each message is preserved independently. For reliable instructions or additional material, open the intended capture and use its own controls. Automatic DM replies are not enabled yet; results are in the dashboard.

## 8. When the Reel is unavailable

Open the **Needs content** item in Inbox. Under **Add content to this capture**, upload a recording/image or paste a transcript. Attachments resume the original capture. Matching output types are updated in place rather than duplicated.

If the upload finishes while a worker still holds the item, wait for that run to finish and click **Finish upload**. This prevents a worker from finalising stale inputs. If a project is required, link one on the item and then **Retry processing**.

A URL-only capture is never labelled as watched. If you only need the reference, `/save` preserves the link with that limitation.

## 9. Daily use

- **Today:** open useful completed outputs and address missing content; up to three next steps.
- **Inbox:** filter recent captures and inspect their evidence and coverage.
- **Actions:** see private work actually completed, linked to its artifact.
- **Projects & goals:** edit personal context and see project-linked captures.
- **Experiments:** read proposed test briefs. Results tracking is not yet implemented.
- **Ask Brain:** keyword search of stored records, returning the sources. Automated capture processing also tries semantic retrieval, falling back to keywords if embeddings fail. Ask Brain does not yet generate conversational answers.
- **Settings:** connection configuration, worker heartbeat, budget reservations, editable context, pause and record export.

Pause stops new claims; a job already executing may finish. Export downloads all owner-facing records, but original media bytes and raw webhook/worker logs are separate. The Inbox currently shows the latest 200 records.

## 10. Run without your laptop

Deploy Next.js on Vercel or a Node web host, Supabase for data/auth/storage, and the separate Node/FFmpeg worker on a persistent container host. Set explicit application credentials on each service. See `docs/DEPLOYMENT.md`.

**A local terminal or the demo is not a continuously deployed system. No deployment was performed in this session.**

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Sign in disabled | Add public Supabase URL/anon key and restart/rebuild the web app |
| Sign in rejected | Check the owner account's email/password and OWNER_USER_ID |
| Database setup error | Inspect the intended project and apply migrations in order; run setup:owner |
| No recent worker heartbeat | Start/restart the worker using the same Supabase environment |
| Missing OpenAI key | Add the application key, restart the worker, then Retry |
| Budget declined | Inspect reservations, pause status and limits; retry only after resolving the limit |
| Media cannot decode | Re-export to supported media within size/duration/dimension limits |
| Shared Reel has no video | Attach accessible owned/authorised content to that capture |
| Research has no sources | Treat the result as partial; no claim is marked verified merely because research ran |

## Still outside this version

Live connections are unverified. Automatic replies, external-action executors, paid generation, approval UI, standing-rule management, personal-memory chat, scheduled reviews, complete retention/deletion, opportunity scoring, MCP and Higgsfield remain unfinished. Their absence is displayed rather than hidden behind connection badges.
