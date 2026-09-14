import { adminDb } from "./db";
import { models, positiveEnv, promptVersion, limits } from "./config";
import { checked } from "./server/auth";
import {
  analyseMedia,
  understand,
  research,
  createArtifact,
  type Evidence,
  type Understanding,
  type Context,
  type Research,
  type Artifact,
  embed,
} from "./intelligence";
import { sampleMedia } from "./media";
import { fetchMediaAsset } from "./security";
import { instagramContent, type InstagramAttachment } from "./instagram";
import { routeIntent } from "./workflow";
import { evaluateAction } from "./policy";
import type { Coverage, ActionProposal } from "./domain";
export type Job = {
  id: string;
  capture_id: string;
  revision: number;
  attempt: number;
  max_attempts: number;
};
type Capture = {
  id: string;
  owner_id: string;
  title: string;
  owner_note: string | null;
  source_url: string | null;
  source_kind: string;
  project_id: string | null;
  input_data: { text?: string; attachments?: InstagramAttachment[] };
};
export class Blocked extends Error {}
export function emptyCoverage(note?: string | null): Coverage {
  return {
    video: "unavailable",
    audio: "unavailable",
    transcription: "not_attempted",
    visuals: "not_attempted",
    onScreenText: "not_attempted",
    caption: "unavailable",
    ownerNote: note ? "available" : "unavailable",
  };
}
export function selectWorkflow(note: string, inferred: string) {
  const explicit = routeIntent(note);
  return explicit === "understand_connect" ? inferred : explicit;
}
export function actionForWorkflow(workflow: string): ActionProposal["type"] {
  return (
    (
      {
        save_reference: "save_reference",
        research: "research",
        comparison: "create_brief",
        experiment: "create_experiment",
        script: "create_script",
        checklist: "create_checklist",
        brief: "create_brief",
        update_project: "update_project",
        understand_connect: "create_brief",
      } as const
    )[workflow as "brief"] ?? "create_brief"
  );
}
export function referenceArtifact(
  capture: { title: string; source_url: string | null },
  evidence: Evidence[],
): Artifact {
  return {
    title: capture.title === "New capture" ? "Saved reference" : capture.title,
    kind: "reference",
    content: [
      capture.source_url ? `Source: ${capture.source_url}` : "",
      ...evidence.map((e) => e.text),
      "Saved as a reference. Source claims have not been independently verified.",
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}
export async function processCapture(job: Job, worker: string) {
  const db = adminDb();
  const capture = checked(
    await db.from("captures").select("*").eq("id", job.capture_id).single(),
  ) as Capture;
  const context: Context = {
    goals: [],
    projects: [],
    profile: null,
    related: [],
  };
  const profile = checked(
    await db
      .from("owner_profiles")
      .select(
        "context,location,available_time,constraints,do_not_want,automation_paused",
      )
      .eq("id", capture.owner_id)
      .single(),
  );
  if (!profile) throw new Blocked("Owner profile missing. Run setup:owner.");
  if (profile.automation_paused)
    throw new Blocked("Automation is paused in Settings.");
  const existing = checked(
    await db.from("workflow_steps").select("stage,output").eq("job_id", job.id),
  );
  const cache = new Map((existing || []).map((s) => [s.stage, s.output]));
  async function stage<T>(name: string, fn: () => Promise<T>): Promise<T> {
    if (cache.has(name)) return cache.get(name) as T;
    if (
      !checked(await db.rpc("renew_job", { p_job: job.id, p_worker: worker }))
    )
      throw new Error("Lease lost");
    const output = await fn();
    checked(
      await db.rpc("checkpoint_job", {
        p_job: job.id,
        p_worker: worker,
        p_stage: name,
        p_output: output,
        p_prompt: promptVersion,
        p_models: models(),
      }),
    );
    return output;
  }
  const note = capture.owner_note || "";
  const directText = (capture.input_data.text || "").slice(0, limits.text);
  const assets =
    checked(
      await db
        .from("media_assets")
        .select("*")
        .eq("capture_id", capture.id)
        .eq("status", "ready")
        .order("created_at"),
    ) || [];
  const acquisitionNotes: string[] = [];
  const shared = instagramContent(
    capture.source_kind === "instagram_dm"
      ? capture.input_data.attachments || []
      : [],
  );
  // Fetch only from explicitly configured hosts; HTML, redirects and unsafe
  // destinations are rejected. FFmpeg validates bytes before analysis.
  if (!assets.length && capture.source_kind === "instagram_dm") {
    const attachments = capture.input_data.attachments || [];
    for (const { index, attachment } of shared.candidates) {
      try {
        const acquired = await stage(`acquire_${index}`, async () => {
          const { buffer, contentType } = await fetchMediaAsset(
            attachment.url!,
            limits.bytes,
            (process.env.META_MEDIA_HOSTS || "").split(",").filter(Boolean),
          );
          const path = `${capture.owner_id}/${capture.id}/meta-${index}`;
          const { error } = await db.storage
            .from("kdn-media")
            .upload(path, buffer, {
              upsert: true,
              contentType,
            });
          if (error) throw new Error("Private media upload failed");
          return checked(
            await db
              .from("media_assets")
              .insert({
                capture_id: capture.id,
                storage_path: path,
                bytes: buffer.length,
                status: "ready",
                provenance: {
                  provider: "instagram",
                  attachmentIndex: index,
                  attachmentType: attachment.type,
                  retrievedAt: new Date().toISOString(),
                },
              })
              .select("*")
              .single(),
          );
        });
        assets.push(acquired);
      } catch {
        acquisitionNotes.push(
          "An Instagram media attachment could not be retrieved. It may be expired, redirected, or from a host not yet approved. Upload content to resume.",
        );
      }
    }
    if (
      attachments.some(
        (a) =>
          !["video", "image", "share", "ig_post", "ig_reel"].includes(a.type),
      )
    )
      acquisitionNotes.push(
        "Unknown attachments were preserved but have not been treated as playable media.",
      );
  }
  const coverage = emptyCoverage(note);
  if (shared.captions.length) coverage.caption = "available";
  const evidence: Evidence[] = directText
    ? [
        {
          kind: "source_claim",
          text: directText,
          sourceId: capture.id,
          atMs: null,
        },
      ]
    : [];
  evidence.push(
    ...shared.captions.map((text): Evidence => ({
      kind: "source_claim",
      text: `Instagram caption: ${text}`,
      sourceId: capture.id,
      atMs: null,
    })),
  );
  if (!assets.length && !evidence.length) {
    const save = routeIntent(note) === "save_reference";
    const url =
      capture.source_url ||
      capture.input_data.attachments?.find((a) => a.url)?.url ||
      note.match(/https:\/\/\S+/)?.[0] ||
      null;
    return checked(
      await db.rpc("complete_capture", {
        p_job: job.id,
        p_worker: worker,
        p_result: {
          title: save ? "Saved link" : "Content needed",
          state: save ? "completed" : "needs_content",
          contentState: url ? "URL_ONLY" : "NEEDS_CONTENT",
          coverage,
          understanding: null,
          summary: save
            ? "Saved the available link as a reference. Media was not analysed."
            : "No video, transcript, or source text was available. Add content to this item to resume. Separate follow-up DMs are not automatically assigned to a previous Reel.",
          actionType: save ? "save_reference" : null,
          artifact: save
            ? referenceArtifact({ ...capture, source_url: url }, [])
            : null,
        },
      }),
    );
  }
  const needsProvider =
    assets.length > 0 || routeIntent(note) !== "save_reference";
  if (needsProvider) {
    if (!process.env.OPENAI_API_KEY)
      throw new Blocked(
        "OpenAI API key is missing. Add it to the worker environment, restart the worker, then Retry this item.",
      );
    const budget = checked(
      await db.rpc("reserve_budget", {
        p_job: job.id,
        p_worker: worker,
        p_amount: positiveEnv("ATTEMPT_RESERVATION_USD", 0.5),
        p_daily: positiveEnv("DAILY_BUDGET_USD", 5),
        p_capture: positiveEnv("CAPTURE_BUDGET_USD", 2),
      }),
    );
    if (!budget)
      throw new Blocked(
        "Budget reservation declined or automation paused. Review Settings before retrying.",
      );
  }
  for (const asset of assets.slice(0, 3)) {
    const analysis = await stage(`media_${asset.id}`, async () => {
      const { data, error } = await db.storage
        .from("kdn-media")
        .download(asset.storage_path);
      if (error || !data) throw new Error("Stored media unavailable");
      const sample = await sampleMedia(Buffer.from(await data.arrayBuffer()));
      try {
        return {
          evidence: await analyseMedia(sample, asset.id),
          hasVideo: sample.hasVideo,
          hasAudio: sample.hasAudio,
          duration: sample.duration,
          frames: sample.frames.map((f) => f.atMs),
        };
      } finally {
        await sample.cleanup();
      }
    });
    evidence.push(...analysis.evidence);
    if (analysis.hasVideo) coverage.video = "available";
    if (analysis.hasAudio) {
      coverage.audio = "available";
      coverage.transcription = "complete";
    }
    coverage.visuals = "sampled";
    coverage.onScreenText = "sampled";
  }
  const state =
    coverage.video === "available" && coverage.visuals === "sampled"
      ? "MEDIA_ANALYSED"
      : coverage.visuals === "sampled"
        ? "PARTIAL_CONTENT"
        : "METADATA_ONLY";
  context.profile = {
    ...profile,
    context: JSON.stringify(profile.context || {}).slice(0, 4000),
  };
  context.goals =
    checked(
      await db
        .from("goals")
        .select("id,title,description")
        .eq("owner_id", capture.owner_id)
        .eq("status", "active")
        .limit(8),
    ) || [];
  context.projects =
    checked(
      await db
        .from("projects")
        .select("id,title,description")
        .eq("owner_id", capture.owner_id)
        .eq("status", "active")
        .limit(8),
    ) || [];
  const query = (
    directText ||
    evidence.map((e) => e.text).join(" ") ||
    note
  ).slice(0, 3000);
  const queryEmbedding = needsProvider
    ? await stage("query_embedding", () => embed(query).catch(() => null))
    : null;
  context.related = (
    checked(
      await db.rpc("search_knowledge", {
        p_owner: capture.owner_id,
        p_query: query.slice(0, 1000),
        p_embedding: queryEmbedding ? JSON.stringify(queryEmbedding) : null,
      }),
    ) || []
  )
    .filter((r: { capture_id: string }) => r.capture_id !== capture.id)
    .slice(0, 3)
    .map((r: { id: string; title: string; body: string }) => ({
      ...r,
      body: r.body.slice(0, 1500),
    }));
  context.goals = context.goals.map((r) => ({
    ...(r as object),
    description: String((r as { description: string }).description || "").slice(
      0,
      500,
    ),
  }));
  context.projects = context.projects
    .filter(
      (r) =>
        !capture.project_id || (r as { id: string }).id === capture.project_id,
    )
    .map((r) => ({
      ...(r as object),
      description: String(
        (r as { description: string }).description || "",
      ).slice(0, 500),
    }));
  const understanding: Understanding =
    routeIntent(note) === "save_reference"
      ? {
          title: directText.slice(0, 65) || "Media reference",
          summary: "Saved for reference without a separate assessment.",
          category: "other",
          inferredIntent: "No inference; owner requested save only.",
          workflow: "save_reference",
          reason: "Owner requested save only.",
          evidence,
          uncertainties: acquisitionNotes,
          entities: [],
        }
      : await stage("understand", () =>
          understand(evidence, note, context, {
            ...coverage,
            limitations: [
              "Frames are sampled; visual coverage is not exhaustive.",
              ...acquisitionNotes,
            ],
          }),
        );
  const workflow = selectWorkflow(note, understanding.workflow);
  if (workflow === "update_project" && !capture.project_id)
    throw new Blocked(
      "Choose the destination project on this item before retrying.",
    );
  let findings: Research | null = null;
  if (["research", "comparison", "experiment"].includes(workflow))
    findings = await stage("research", () => research(understanding));
  const artifact = await stage("artifact", async () =>
    workflow === "save_reference"
      ? referenceArtifact({ ...capture, title: understanding.title }, evidence)
      : createArtifact(understanding, workflow, context, findings),
  );
  const embedding = needsProvider
    ? await stage("artifact_embedding", () =>
        embed(artifact.title + " " + artifact.content.slice(0, 3000)).catch(
          () => null,
        ),
      )
    : null;
  const type = actionForWorkflow(workflow);
  const decision = evaluateAction(
    {
      type,
      intendedResult: artifact.title,
      inputs: { revision: job.revision },
      estimatedCostUsd: 0,
      evidenceIds: [],
    },
    { captureId: capture.id, captureRemainingUsd: 1, dailyRemainingUsd: 1 },
  );
  if (decision.decision !== "execute")
    throw new Blocked(
      "Action requires approval. No external action was executed.",
    );
  const limited =
    Boolean(findings && (!findings.searched || !findings.sources.length)) ||
    acquisitionNotes.length > 0;
  const summary = `Created ${artifact.kind}: ${artifact.title}. ${coverage.visuals === "sampled" ? "Analysed sampled visual frames; coverage is not exhaustive." : "Used supplied text; video was not analysed."}${findings?.searched && findings.sources.length ? " Research completed with source links." : findings ? " Research returned insufficient source evidence." : ""}`;
  checked(
    await db.rpc("complete_capture", {
      p_job: job.id,
      p_worker: worker,
      p_result: {
        title: understanding.title,
        state: limited ? "partially_completed" : "completed",
        contentState: state,
        coverage,
        understanding: {
          ...understanding,
          research: findings,
          limitations: acquisitionNotes,
        },
        summary,
        actionType: type,
        artifact,
        embedding,
      },
    }),
  );
}
