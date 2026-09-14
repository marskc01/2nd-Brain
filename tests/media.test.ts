import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { sampleMedia } from "../src/lib/media";
import { limits } from "../src/lib/config";
describe("actual local video extraction (no model calls)", () => {
  it("extracts audio and timestamped visual frames from the original sample", async () => {
    const sample = await sampleMedia(
      await readFile("tests/fixtures/media/owned-sample.mp4"),
    );
    try {
      expect(sample.hasAudio).toBe(true);
      expect(sample.hasVideo).toBe(true);
      expect(sample.duration).toBeCloseTo(10, 0);
      expect(sample.frames.length).toBeGreaterThanOrEqual(2);
      expect(sample.frames.length).toBeLessThanOrEqual(limits.frames);
      expect(sample.frames.some((f) => f.atMs >= 5000)).toBe(true);
      expect(sample.frames[0].dataUrl).toMatch(/^data:image\/jpeg;base64,/);
      expect((await readFile(sample.audioPath!)).length).toBeGreaterThan(1000);
    } finally {
      await sample.cleanup();
    }
  }, 60000);
  it("rejects corrupt content", async () => {
    await expect(sampleMedia(Buffer.from("not a video"))).rejects.toThrow();
  });
  it("rejects oversized files before decoding", async () => {
    await expect(sampleMedia(Buffer.alloc(limits.bytes + 1))).rejects.toThrow(
      "25 MB",
    );
  });
});
