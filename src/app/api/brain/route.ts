import { z } from "zod";
import { owner, checked, failure, json, HttpError } from "@/lib/server/auth";
import { limits } from "@/lib/config";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const uuid = z.string().uuid();
const commands = z.discriminatedUnion("command", [
  z.object({
    command: z.literal("capture"),
    requestId: uuid,
    url: z.string().max(2000).default(""),
    note: z.string().max(4000).default(""),
    text: z.string().max(limits.text).default(""),
    projectId: uuid.nullable().default(null),
  }),
  z.object({
    command: z.literal("resume"),
    captureId: uuid,
    requestId: uuid,
    text: z.string().min(1).max(limits.text),
  }),
  z.object({ command: z.literal("retry"), captureId: uuid }),
  z.object({
    command: z.literal("prepare_upload"),
    captureId: uuid,
    requestId: uuid,
    mime: z.enum([
      "video/mp4",
      "video/quicktime",
      "video/webm",
      "image/jpeg",
      "image/png",
    ]),
    bytes: z.number().int().min(1).max(limits.bytes),
  }),
  z.object({
    command: z.literal("finish_upload"),
    captureId: uuid,
    assetId: uuid,
    requestId: uuid,
  }),
  z.object({ command: z.literal("asset_url"), assetId: uuid }),
  z.object({
    command: z.literal("profile"),
    displayName: z.string().min(1).max(100),
    context: z.string().max(8000),
    paused: z.boolean(),
  }),
  z.object({
    command: z.literal("context"),
    kind: z.enum(["goal", "project"]),
    title: z.string().min(1).max(150),
    description: z.string().max(4000),
    id: uuid.optional(),
    status: z.enum(["active", "archived"]).default("active"),
  }),
  z.object({
    command: z.literal("project_link"),
    captureId: uuid,
    projectId: uuid,
  }),
  z.object({ command: z.literal("search"), query: z.string().min(1).max(500) }),
]);
export async function GET(request: Request) {
  try {
    const { db, id } = await owner(request);
    const results = await Promise.all([
      db
        .from("captures")
        .select("*")
        .eq("owner_id", id)
        .order("updated_at", { ascending: false })
        .limit(200),
      db
        .from("actions")
        .select("*")
        .eq("owner_id", id)
        .order("created_at", { ascending: false })
        .limit(200),
      db
        .from("artifacts")
        .select("*")
        .eq("owner_id", id)
        .order("created_at", { ascending: false })
        .limit(200),
      db.from("goals").select("*").eq("owner_id", id),
      db.from("projects").select("*").eq("owner_id", id),
      db.from("owner_profiles").select("*").eq("id", id).maybeSingle(),
      db
        .from("worker_heartbeats")
        .select("last_seen")
        .order("last_seen", { ascending: false })
        .limit(1),
      db
        .from("budget_reservations")
        .select("amount_usd,created_at,usage_note")
        .eq("owner_id", id)
        .gte(
          "created_at",
          new Date().toISOString().slice(0, 10) + "T00:00:00Z",
        ),
    ]);
    const [
      captures,
      actions,
      artifacts,
      goals,
      projects,
      profile,
      heartbeat,
      budget,
    ] = results.map(checked);
    if (!profile)
      throw new HttpError(
        503,
        "Owner profile missing. Run npm run setup:owner.",
      );
    return Response.json(
      {
        captures,
        actions,
        artifacts,
        goals,
        projects,
        profile,
        heartbeat,
        budget,
        configuration: {
          openai: process.env.OPENAI_API_KEY
            ? "configured_unverified"
            : "missing",
          instagram:
            process.env.META_APP_SECRET && process.env.OWNER_INSTAGRAM_ID
              ? "configured_unverified"
              : "missing",
          notifications: "not_enabled",
          dailyBudget: process.env.DAILY_BUDGET_USD || "5",
          captureBudget: process.env.CAPTURE_BUDGET_USD || "2",
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    const { db, id } = await owner(request);
    const parsed = commands.safeParse(await json(request));
    if (!parsed.success)
      throw new HttpError(
        400,
        parsed.error.issues[0]?.message || "Invalid input",
      );
    const input = parsed.data;
    async function capture(captureId: string) {
      const result = checked(
        await db
          .from("captures")
          .select("*")
          .eq("id", captureId)
          .eq("owner_id", id)
          .maybeSingle(),
      );
      if (!result) throw new HttpError(404, "Capture not found.");
      return result;
    }
    switch (input.command) {
      case "capture": {
        if (input.url) {
          try {
            const u = new URL(input.url);
            if (
              !["http:", "https:"].includes(u.protocol) ||
              u.username ||
              u.password
            )
              throw new Error();
          } catch {
            throw new HttpError(400, "Use a valid HTTP or HTTPS source URL.");
          }
        }
        if (!input.text.trim() && !input.url.trim() && !input.note.trim())
          throw new HttpError(
            400,
            "Add source text, a URL, or an instruction for your upload.",
          );
        const captureId = checked(
          await db.rpc("capture_manual", {
            p_owner: id,
            p_request: input.requestId,
            p_url: input.url,
            p_note: input.note,
            p_text: input.text,
            p_project: input.projectId,
          }),
        );
        return Response.json({ captureId });
      }
      case "resume": {
        await capture(input.captureId);
        checked(
          await db.rpc("resume_capture", {
            p_owner: id,
            p_capture: input.captureId,
            p_submission: input.requestId,
            p_text: input.text,
          }),
        );
        return Response.json({ ok: true });
      }
      case "retry": {
        checked(
          await db.rpc("retry_capture", {
            p_owner: id,
            p_capture: input.captureId,
          }),
        );
        return Response.json({ ok: true });
      }
      case "prepare_upload": {
        await capture(input.captureId);
        const asset = checked(
          await db.rpc("prepare_media_asset", {
            p_owner: id,
            p_capture: input.captureId,
            p_request: input.requestId,
            p_mime: input.mime,
            p_bytes: input.bytes,
          }),
        );
        const signed = checked(
          await db.storage
            .from("kdn-media")
            .createSignedUploadUrl(asset.storage_path),
        );
        return Response.json({
          assetId: asset.id,
          path: asset.storage_path,
          token: signed!.token,
        });
      }
      case "finish_upload": {
        await capture(input.captureId);
        const asset = checked(
          await db
            .from("media_assets")
            .select("*")
            .eq("id", input.assetId)
            .eq("capture_id", input.captureId)
            .single(),
        );
        if (asset.status === "ready") return Response.json({ ok: true });
        const { data, error } = await db.storage
          .from("kdn-media")
          .info(asset.storage_path);
        if (error || !data)
          throw new HttpError(
            400,
            "Upload not found in storage. Retry the upload.",
          );
        const bytes = Number(data.size);
        if (!bytes || bytes > limits.bytes || bytes !== Number(asset.bytes))
          throw new HttpError(
            400,
            "Uploaded file size does not match the declared file.",
          );
        const result = await db.rpc("resume_capture", {
          p_owner: id,
          p_capture: input.captureId,
          p_submission: input.requestId,
          p_asset: input.assetId,
        });
        if (result.error)
          throw new HttpError(
            409,
            "Processing is active. Wait for it to finish, then click Finish upload again.",
          );
        return Response.json({ ok: true });
      }
      case "asset_url": {
        const asset = checked(
          await db
            .from("media_assets")
            .select("*,captures!inner(owner_id)")
            .eq("id", input.assetId)
            .eq("captures.owner_id", id)
            .single(),
        );
        const signed = checked(
          await db.storage
            .from("kdn-media")
            .createSignedUrl(asset.storage_path, 60),
        );
        return Response.json({ url: signed!.signedUrl });
      }
      case "profile": {
        checked(
          await db
            .from("owner_profiles")
            .update({
              display_name: input.displayName,
              context: { notes: input.context },
              automation_paused: input.paused,
            })
            .eq("id", id),
        );
        return Response.json({ ok: true });
      }
      case "context": {
        const table = input.kind === "goal" ? "goals" : "projects";
        const data = {
          owner_id: id,
          title: input.title,
          description: input.description,
          status: input.status,
        };
        checked(
          input.id
            ? await db
                .from(table)
                .update(data)
                .eq("id", input.id)
                .eq("owner_id", id)
            : await db.from(table).insert(data),
        );
        return Response.json({ ok: true });
      }
      case "project_link": {
        await capture(input.captureId);
        const project = checked(
          await db
            .from("projects")
            .select("id")
            .eq("id", input.projectId)
            .eq("owner_id", id)
            .maybeSingle(),
        );
        if (!project) throw new HttpError(404, "Project not found");
        checked(
          await db.rpc("link_capture_project", {
            p_owner: id,
            p_capture: input.captureId,
            p_project: project.id,
          }),
        );
        return Response.json({ ok: true });
      }
      case "search": {
        const records = checked(
          await db.rpc("search_knowledge", {
            p_owner: id,
            p_query: input.query,
          }),
        );
        return Response.json({
          records,
          mode: "keyword",
          answer: records.length
            ? "These stored records match your question. Open a source to read the evidence."
            : "No stored evidence matched. Try a specific subject, tool, or project name.",
        });
      }
    }
  } catch (error) {
    return failure(error);
  }
}
