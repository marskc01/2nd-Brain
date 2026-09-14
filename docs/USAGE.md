# KDN Brain — daily use

Updated 14 September 2026. The live web app, owner authentication, Instagram capture and cloud worker are connected. An owned sample video completed real OpenAI speech/visual analysis and produced a visible script. Instagram sharing works without copying a URL; the tested Reel supplied only a link, so its video still needs additional content.

## Send a Reel

1. From **@kadencondie**, open a Reel in Instagram.
2. Tap the paper-plane **Share** button, choose **@kdn_brain**, and send it.
3. Open [KDN Brain](https://2nd-brain-phi.vercel.app/) and sign in with your owner account, **kadencondie@icloud.com**, using the password you created.
4. Open **Inbox** and select the capture. The worker processes queued items automatically; your laptop can be closed.
5. Read the status, content coverage and any **Outputs**. **Actions → Completed** means the private output was actually created.

[Your automatically captured Reel](https://2nd-brain-phi.vercel.app/?item=6c571683-ae78-4e00-a999-90cc293c69a9#inbox) is ready in Inbox. It currently says **Needs content / URL only** because Meta delivered the permalink without video bytes or a caption. That is a real capture, not a watched Reel.

No DM acknowledgement or completion reply is enabled. Read results in the dashboard. Separate follow-up DMs are not automatically assigned to a previous Reel. For a reliable instruction alongside uploaded content, use Quick capture; for extra material on an existing Reel, use that item's form.

## Supply missing content

1. Open the intended **Needs content** item.
2. Find **Add content to this capture**.
3. Select **Additional media** for an accessible video, screen recording or screenshots, or paste the actual transcript in **Additional transcript**.
4. Click **Attach & resume**. It queues the same capture again; keep that item open to see its result.

Use content you are authorised to upload. Supported files: MP4, MOV, WebM, JPEG and PNG; at most 25 MB each, 120 seconds per video, 4096 pixels per side and three assets per capture. If Instagram offers a permitted download, you can use it; otherwise a suitable authorised recording or transcript is the fallback. A URL alone is not enough for the application to watch a Reel.

If a job already holds the capture during upload, wait for that job and use **Finish upload** when offered. Matching output types are updated in place. Do not create a second Quick capture just to add the missing video.

## Continue deeper work in Astra

Open a capture → **Continue in Astra** → describe the result you want → review the brief → **Copy Astra brief**. Paste it into Astra or download the Markdown brief. It includes stored source evidence, timestamps, prior outputs and optional personal context, without another KDN Brain model call. If the Reel has no accessible content, the brief asks for it instead of claiming it was watched. Running the prompt uses the destination conversation’s allowance or API billing. See [Astra handoff and the advanced-agent path](ASTRA_HANDOFF.md).

## Tell Brain what you want

For manual captures, choose **Quick capture**, add actual source text or a file, then fill **What would you like from this?**. You can use ordinary language or these shortcuts:

| Instruction | Expected private work |
| --- | --- |
| `/save` — just keep this reference | Searchable reference, without unnecessary research |
| `/script` — use this structure | Script draft based on accessible evidence |
| `/compare` — compare these tools | Comparison with available research |
| `/research` — check the claim | Assessment with sources and uncertainty |
| `/experiment` — could this work for me? | Proposed test, assumptions and success criteria |
| `/project` plus a selected project | Relevant private project note |

Research adapters are implemented, but a live research acceptance test has not been run. “Completed” does not mean a proposed experiment was carried out or anything was published. This version usually produces one private artifact per run, not a bundle of automatically executed external operations.

[Open the completed sample-video script](https://2nd-brain-phi.vercel.app/?item=200823b0-ca9d-4ee5-88d6-9ec63c42a26c#inbox). Expand **Evidence and uncertainty** to see observations and timestamps, and use **Download Markdown** to save the output. It is clearly labelled as a synthetic provider test, separate from your Instagram Reels. Visual analysis uses selected frames, not exhaustive viewing.

## Add your context

In **Projects & goals**, add current projects and goals. In **Settings**, write your skills, interests, existing tools, markets, time, constraints and things you do not want. The worker uses this context when deciding what work is useful. Example business ideas from the original prompt were not inserted as facts about you.

## Where things live

- **Today:** recent completed outputs and up to three next steps.
- **Inbox:** captures, coverage, evidence, missing-content forms and outputs.
- **Actions:** private work and its real completion status.
- **Projects & goals:** editable context and project-linked items.
- **Experiments:** proposed briefs; experiment results tracking remains unfinished.
- **Ask Brain:** search stored records with source links. Conversational memory answers remain unfinished.
- **Settings:** worker heartbeat, budget reservations, automation pause, context and record export.

**Pause automation** stops new jobs; a current job may finish. Export contains owner-facing records, not original media bytes or raw operational logs. Inbox currently displays the latest 200 captures.

## Costs and availability

The Railway worker is deployed with one persistent replica on the existing **US$5 / 30-day trial**. It runs independently of Codex and your laptop while the hosting account remains active. Continuing after the trial may require a paid hosting plan; none was purchased by the assistant.

OpenAI uses your separately funded API account, with automatic credit reload off at setup. The worker enforces **US$1 per UTC day**, **US$1 per capture**, and an estimated **US$0.50 reservation per paid attempt**. UTC midnight is 8am Perth time. Reservations are conservative estimates, not reconciled invoices or an exact provider-spend guarantee. Today’s setup tests have used the full US$1 reservation allowance; new paid work can be retried after the next reset at 8am Perth. These reservations are not actual OpenAI charges. Failed or retried paid attempts may consume additional reservations.

## If something stalls

| What you see | What to do |
| --- | --- |
| Needs content / URL only | Add actual media or a transcript to that item |
| Loading error | Use Retry loading; automatic refresh also retries without deleting captures |
| No recent worker heartbeat | Check the Railway service and trial/credit status |
| Budget reservation declined | Review Settings, pause state and daily reset; do not repeatedly retry |
| Failed media processing | Check file type, size and duration, then use Retry |
| Sign-in rejected | Use the owner email/password; Supabase dashboard login is a separate login |

Automatic DMs, outreach, publishing, purchases, paid image/video generation, Higgsfield, MCP, approval screens, complete reviews/scoring and retention/deletion automation are not enabled. No action in this version can perform those external operations.
