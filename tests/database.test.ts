import { beforeAll, afterAll, describe, it, expect } from "vitest";
import crypto from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { database, ownerId } from "./db-harness";
let db: PGlite;
beforeAll(async () => {
  db = await database();
}, 60000);
afterAll(async () => {
  await db?.close();
});
async function capture(note = "/save", text = "A useful reference") {
  const result = await db.query<{ id: string }>(
    "select capture_manual($1,$2,'',$3,$4) as id",
    [ownerId, crypto.randomUUID(), note, text],
  );
  return result.rows[0].id;
}
async function claim() {
  return (
    await db.query<{ id: string; capture_id: string; attempt: number }>(
      "select * from claim_jobs('test-worker',1,180)",
    )
  ).rows[0];
}
describe("real PostgreSQL-compatible migrations and transactional workflow", () => {
  it("applies both migrations and blocks browser execution of privileged RPCs", async () => {
    const result = await db.query<{ allowed: boolean }>(
      "select has_function_privilege('anon','public.claim_jobs(text,integer,integer)','execute') as allowed",
    );
    expect(result.rows[0].allowed).toBe(false);
    const tables = await db.query<{ relname: string; relrowsecurity: boolean }>(
      "select relname,relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r'",
    );
    expect(tables.rows.every((t) => t.relrowsecurity)).toBe(true);
  });
  it("accepts a whole batch atomically and deduplicates webhook retries but preserves deliberate new shares", async () => {
    const message = {
      eventId: "owner:m1",
      messageId: "m1",
      senderId: "owner",
      disposition: "accepted",
      text: "Research this",
      raw: { message: { mid: "m1" } },
      attachments: [],
    };
    const call = (key: string, m: object) =>
      db.query("select ingest_meta_batch($1,$2,$3,$4)", [
        ownerId,
        key,
        "{}",
        JSON.stringify([m]),
      ]);
    await call("b1", message);
    await call("b1", message);
    await call("b2", { ...message, eventId: "owner:m2", messageId: "m2" });
    const count = await db.query<{ count: number }>(
      "select count(*)::int count from captures where source_kind='instagram_dm'",
    );
    expect(count.rows[0].count).toBe(2);
    await db.exec("update jobs set status='completed'");
  });
  it("quarantine and echo events do not queue processing", async () => {
    await db.query("select ingest_meta_batch($1,$2,$3,$4)", [
      ownerId,
      "q",
      "{}",
      JSON.stringify([
        { eventId: "q1", disposition: "quarantined", raw: {} },
        { eventId: "echo1", disposition: "ignored_echo", raw: {} },
      ]),
    ]);
    expect(
      (
        await db.query<{ count: number }>(
          "select count(*)::int count from captures where raw_event_id in(select id from raw_events where disposition in('quarantined','ignored_echo'))",
        )
      ).rows[0].count,
    ).toBe(0);
  });
  it("manual capture plus job is atomic and repeated request IDs are idempotent", async () => {
    const request = crypto.randomUUID();
    const params = [ownerId, request, "https://example.com", "/save", ""];
    const first = await db.query<{ id: string }>(
      "select capture_manual($1,$2,$3,$4,$5) id",
      params,
    );
    const second = await db.query<{ id: string }>(
      "select capture_manual($1,$2,$3,$4,$5) id",
      params,
    );
    expect(first.rows[0].id).toBe(second.rows[0].id);
    expect(
      (
        await db.query<{ count: number }>(
          "select count(*)::int count from jobs where capture_id=$1",
          [first.rows[0].id],
        )
      ).rows[0].count,
    ).toBe(1);
    await db.exec("update jobs set status='completed'");
  });
  it("an invalid owner cannot durably ingest or acknowledge a batch", async () => {
    await expect(
      db.query("select ingest_meta_batch($1,$2,$3,$4)", [
        crypto.randomUUID(),
        "bad",
        "{}",
        "[]",
      ]),
    ).rejects.toThrow("Owner profile missing");
    expect(
      (
        await db.query<{ count: number }>(
          "select count(*)::int count from raw_events where event_id='batch:bad'",
        )
      ).rows[0].count,
    ).toBe(0);
  });
  it("reserves budget atomically, limits concurrent jobs, and charges retries separately", async () => {
    await capture();
    const a = await claim();
    await capture();
    const b = await claim();
    const results = await Promise.all(
      [a, b].map((j) =>
        db.query<{ ok: boolean }>("select reserve_budget($1,$2,0.5,0.5,1) ok", [
          j.id,
          "test-worker",
        ]),
      ),
    );
    expect(results.map((r) => r.rows[0].ok).sort()).toEqual([false, true]);
    const winner = results[0].rows[0].ok ? a : b;
    await db.query("update jobs set attempt=attempt+1 where id=$1", [
      winner.id,
    ]);
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select reserve_budget($1,$2,0.5,0.5,1) ok",
          [winner.id, "test-worker"],
        )
      ).rows[0].ok,
    ).toBe(false);
    await db.exec("update jobs set status='completed'");
  });
  it("prevents expired workers from completing a reclaimed job", async () => {
    await capture();
    const j = await claim();
    await db.query(
      "update jobs set lease_expires_at=now()-interval '1 minute' where id=$1",
      [j.id],
    );
    await expect(
      db.query("select complete_capture($1,$2,$3)", [
        j.id,
        "test-worker",
        "{}",
      ]),
    ).rejects.toThrow("Lease lost");
    const reclaimed = await db.query<{ id: string; attempt: number }>(
      "select * from claim_jobs('replacement',1,180)",
    );
    expect(reclaimed.rows[0].id).toBe(j.id);
    expect(reclaimed.rows[0].attempt).toBe(2);
    await db.exec("update jobs set status='completed'");
  });
  it("URL-only completion remains truthful and does not manufacture an artifact", async () => {
    const id = await capture("Research this", "");
    const j = await claim();
    await db.query("select complete_capture($1,$2,$3)", [
      j.id,
      "test-worker",
      JSON.stringify({
        state: "needs_content",
        contentState: "URL_ONLY",
        coverage: { video: "unavailable" },
        summary: "Upload content",
        artifact: null,
      }),
    ]);
    expect(
      (
        await db.query<{ content_state: string }>(
          "select content_state from captures where id=$1",
          [id],
        )
      ).rows[0].content_state,
    ).toBe("URL_ONLY");
    expect(
      (
        await db.query<{ count: number }>(
          "select count(*)::int count from artifacts where capture_id=$1",
          [id],
        )
      ).rows[0].count,
    ).toBe(0);
  });
  it("resume updates the same private artifact instead of duplicating it", async () => {
    const id = await capture();
    let j = await claim();
    const result = {
      state: "completed",
      contentState: "METADATA_ONLY",
      coverage: { video: "unavailable" },
      summary: "Reference created",
      actionType: "save_reference",
      artifact: {
        title: "Reference",
        kind: "reference",
        content: "Version one",
      },
    };
    await db.query("select complete_capture($1,$2,$3)", [
      j.id,
      "test-worker",
      JSON.stringify(result),
    ]);
    const submission = crypto.randomUUID();
    await db.query("select resume_capture($1,$2,$3,$4)", [
      ownerId,
      id,
      submission,
      "Added context",
    ]);
    await db.query("select resume_capture($1,$2,$3,$4)", [
      ownerId,
      id,
      submission,
      "Added context",
    ]);
    j = await claim();
    result.artifact.content = "Version two";
    await db.query("select complete_capture($1,$2,$3)", [
      j.id,
      "test-worker",
      JSON.stringify(result),
    ]);
    const artifacts = await db.query<{ content: string }>(
      "select content from artifacts where capture_id=$1",
      [id],
    );
    expect(artifacts.rows).toEqual([{ content: "Version two" }]);
    expect(
      (
        await db.query<{ revision: number }>(
          "select revision from captures where id=$1",
          [id],
        )
      ).rows[0].revision,
    ).toBe(2);
  });
  it("pause prevents new worker claims", async () => {
    await capture();
    await db.query(
      "update owner_profiles set automation_paused=true where id=$1",
      [ownerId],
    );
    expect(
      (await db.query("select * from claim_jobs('paused',1,180)")).rows,
    ).toHaveLength(0);
    await db.query(
      "update owner_profiles set automation_paused=false where id=$1",
      [ownerId],
    );
    await db.exec("update jobs set status='completed'");
  });
  it("upload reservation validates ownership and limits to three assets", async () => {
    const id = await capture();
    for (let i = 0; i < 3; i++)
      await db.query("select prepare_media_asset($1,$2,$3,$4,$5)", [
        ownerId,
        id,
        crypto.randomUUID(),
        "video/mp4",
        1024,
      ]);
    await expect(
      db.query("select prepare_media_asset($1,$2,$3,$4,$5)", [
        ownerId,
        id,
        crypto.randomUUID(),
        "video/mp4",
        1024,
      ]),
    ).rejects.toThrow("Maximum three");
    await expect(
      db.query("select prepare_media_asset($1,$2,$3,$4,$5)", [
        crypto.randomUUID(),
        id,
        crypto.randomUUID(),
        "video/mp4",
        1024,
      ]),
    ).rejects.toThrow("Capture missing");
    await db.exec("update jobs set status='completed'");
  });
  it("owner RLS denies another authenticated user reads", async () => {
    await db.exec(
      "grant usage on schema auth,public to authenticated;grant execute on function auth.uid to authenticated;set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',false)",
    );
    try {
      expect((await db.query("select * from captures")).rows).toHaveLength(0);
    } finally {
      await db.exec("reset role");
    }
  });
});
