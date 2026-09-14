import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { readFile } from "node:fs/promises";
import crypto from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { database, ownerId } from "./db-harness";
import type { MediaSample } from "../src/lib/media";
const mock = vi.hoisted(() => ({
  db: null as unknown,
  analyseMedia: vi.fn(),
  understand: vi.fn(),
  createArtifact: vi.fn(),
  embed: vi.fn(),
}));
vi.mock("../src/lib/db", () => ({ adminDb: () => mock.db }));
vi.mock("../src/lib/intelligence", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  analyseMedia: mock.analyseMedia,
  understand: mock.understand,
  createArtifact: mock.createArtifact,
  embed: mock.embed,
}));
import { processCapture, type Job } from "../src/lib/pipeline";
let sql: PGlite;
// Test transport only: real SQL migrations/RPCs, real media bytes and FFmpeg; AI is explicitly simulated.
class Selection {
  fields = "*";
  filters: [string, unknown][] = [];
  one = false;
  constructor(private table: string) {}
  select(fields: string) {
    this.fields = fields;
    return this;
  }
  eq(key: string, value: unknown) {
    this.filters.push([key, value]);
    return this;
  }
  single() {
    this.one = true;
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  async then(resolve: (value: unknown) => unknown) {
    try {
      const where = this.filters
        .map(([k], i) => `${k}=$${i + 1}`)
        .join(" and ");
      const result = await sql.query(
        `select ${this.fields} from ${this.table}${where ? " where " + where : ""}`,
        this.filters.map(([, v]) => v),
      );
      return resolve({
        data: this.one ? result.rows[0] : result.rows,
        error: null,
      });
    } catch (error) {
      return resolve({ data: null, error });
    }
  }
}
beforeAll(async () => {
  sql = await database();
  const bytes = await readFile("tests/fixtures/media/owned-sample.mp4");
  mock.db = {
    from: (table: string) => new Selection(table),
    rpc: async (name: string, args: Record<string, unknown>) => {
      try {
        const entries = Object.entries(args),
          query = `select ${name === "search_knowledge" ? "* from " : ""}${name}(${entries.map(([key], i) => `${key} => $${i + 1}`).join(",")}) result`;
        const result = await sql.query<{ result: unknown }>(
          query,
          entries.map(([, v]) =>
            typeof v === "object" && v !== null ? JSON.stringify(v) : v,
          ),
        );
        return {
          data:
            name === "search_knowledge" ? result.rows : result.rows[0]?.result,
          error: null,
        };
      } catch (error) {
        return { data: null, error };
      }
    },
    storage: {
      from: () => ({
        download: async () => ({ data: new Blob([bytes]), error: null }),
      }),
    },
  };
  process.env.OPENAI_API_KEY = "test-only-placeholder";
}, 60000);
afterAll(async () => {
  await sql?.close();
  delete process.env.OPENAI_API_KEY;
});
async function newCapture(text: string, note: string) {
  return (
    await sql.query<{ id: string }>(
      "select capture_manual($1,$2,'',$3,$4) id",
      [ownerId, crypto.randomUUID(), note, text],
    )
  ).rows[0].id;
}
async function job() {
  return (
    await sql.query<Job>("select * from claim_jobs('pipeline-test',1,180)")
  ).rows[0];
}
describe("vertical slice with simulated AI and real media/database", () => {
  it("video → extracted audio/frames → typed evidence → script → visible persisted execution", async () => {
    const id = await newCapture("", "/script");
    await sql.query(
      "insert into media_assets(capture_id,storage_path,status) values($1,'test-owned.mp4','ready')",
      [id],
    );
    mock.analyseMedia.mockImplementation(
      async (sample: MediaSample, sourceId: string) => {
        expect(sample.hasAudio).toBe(true);
        expect(sample.frames.length).toBeGreaterThan(1);
        return [
          {
            kind: "source_claim",
            text: "Compare opening shots before choosing an edit.",
            sourceId,
            atMs: 5000,
          },
          {
            kind: "observation",
            text: "Red then blue squares, white background.",
            sourceId,
            atMs: 0,
          },
        ];
      },
    );
    mock.embed.mockResolvedValue(
      Array.from({ length: 1536 }, (_, i) => (i === 0 ? 1 : 0)),
    );
    mock.understand.mockImplementation(async (evidence) => ({
      title: "Compare two opening shots",
      summary: "A synthetic video for testing.",
      category: "creative_reference",
      inferredIntent: "Requested script",
      workflow: "script",
      reason: "Explicit owner instruction",
      evidence,
      uncertainties: ["Simulated provider output"],
      entities: [],
    }));
    mock.createArtifact.mockResolvedValue({
      title: "A contrast script",
      kind: "script",
      content:
        "0–5s: Show the red square. Voice: Start with one visual idea.\n5–10s: Cut to the blue square. Voice: Try another opening and compare.",
    });
    const j = await job();
    await processCapture(j, "pipeline-test");
    const result = await sql.query<{ state: string; content_state: string }>(
      "select state,content_state from captures where id=$1",
      [id],
    );
    expect(result.rows[0]).toEqual({
      state: "completed",
      content_state: "MEDIA_ANALYSED",
    });
    expect(
      (await sql.query("select * from artifacts where capture_id=$1", [id]))
        .rows,
    ).toHaveLength(1);
    expect(
      (await sql.query("select * from observations where capture_id=$1", [id]))
        .rows,
    ).toHaveLength(2);
    expect(
      (
        await sql.query<{ status: string }>(
          "select status from actions where capture_id=$1",
          [id],
        )
      ).rows[0].status,
    ).toBe("completed");
    expect(
      (
        await sql.query<{ count: number }>(
          "select count(*)::int count from knowledge_chunks where embedding is not null",
        )
      ).rows[0].count,
    ).toBe(1);
  }, 60000);
  it("URL-only capture creates no invented perception or work", async () => {
    const id = await newCapture("", "/research");
    const calls = mock.analyseMedia.mock.calls.length;
    const j = await job();
    await processCapture(j, "pipeline-test");
    expect(mock.analyseMedia.mock.calls.length).toBe(calls);
    expect(
      (
        await sql.query<{ state: string }>(
          "select state from captures where id=$1",
          [id],
        )
      ).rows[0].state,
    ).toBe("needs_content");
    expect(
      (await sql.query("select * from artifacts where capture_id=$1", [id]))
        .rows,
    ).toHaveLength(0);
  });
  it("saves an Instagram caption as source evidence without claiming video analysis", async () => {
    const id = await newCapture("", "/save");
    await sql.query(
      "update captures set source_kind='instagram_dm', input_data=$2 where id=$1",
      [
        id,
        JSON.stringify({
          attachments: [
            { type: "ig_post", payload: { title: "A caption-only reference" } },
          ],
        }),
      ],
    );
    const calls = mock.analyseMedia.mock.calls.length;
    await processCapture(await job(), "pipeline-test");
    const result = await sql.query<{
      content_state: string;
      coverage: { caption: string; video: string };
    }>("select content_state,coverage from captures where id=$1", [id]);
    expect(result.rows[0].content_state).toBe("METADATA_ONLY");
    expect(result.rows[0].coverage.caption).toBe("available");
    expect(result.rows[0].coverage.video).toBe("unavailable");
    expect(mock.analyseMedia.mock.calls.length).toBe(calls);
    const output = await sql.query<{ content: string }>(
      "select content from artifacts where capture_id=$1",
      [id],
    );
    expect(output.rows[0].content).toContain("A caption-only reference");
  });
  it("marks a live-shaped Reel permalink as needing content without calling media analysis", async () => {
    const id = await newCapture("", "");
    await sql.query(
      "update captures set source_kind='instagram_dm', input_data=$2 where id=$1",
      [
        id,
        JSON.stringify({
          attachments: [
            {
              type: "ig_reel",
              url: "https://www.instagram.com/reel/fixture/",
              payload: { reel_video_id: "fixture" },
            },
          ],
        }),
      ],
    );
    const calls = mock.analyseMedia.mock.calls.length;
    await processCapture(await job(), "pipeline-test");
    const result = (
      await sql.query<{ state: string; content_state: string }>(
        "select state,content_state from captures where id=$1",
        [id],
      )
    ).rows[0];
    expect(result).toMatchObject({
      state: "needs_content",
      content_state: "URL_ONLY",
    });
    expect(mock.analyseMedia.mock.calls.length).toBe(calls);
    expect(
      (await sql.query("select * from artifacts where capture_id=$1", [id]))
        .rows,
    ).toHaveLength(0);
  });
  it("retry reuses completed media/understanding checkpoints, without duplicate artifacts", async () => {
    const id = await newCapture("A practical source text.", "/script");
    mock.createArtifact.mockRejectedValueOnce(
      new Error("Temporary provider failure"),
    );
    let j = await job();
    await expect(processCapture(j, "pipeline-test")).rejects.toThrow(
      "Temporary",
    );
    const understandingCalls = mock.understand.mock.calls.length;
    await sql.query(
      "select fail_job($1,'pipeline-test','Transient failure',false)",
      [j.id],
    );
    await sql.query("update jobs set run_after=now() where id=$1", [j.id]);
    j = await job();
    await processCapture(j, "pipeline-test");
    expect(mock.understand.mock.calls.length).toBe(understandingCalls);
    expect(
      (await sql.query("select * from artifacts where capture_id=$1", [id]))
        .rows,
    ).toHaveLength(1);
  });
});
