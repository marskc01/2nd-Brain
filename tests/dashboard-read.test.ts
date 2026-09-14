import { describe, it, expect, vi, afterEach } from "vitest";
import { readView } from "../src/lib/server/read-view";

afterEach(() => vi.restoreAllMocks());
describe("dashboard reads", () => {
  it("recovers once from a transient read error and returns the real data", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        status: 0,
        error: { message: "fetch failed with PRIVATE CONTENT" },
      })
      .mockResolvedValueOnce({
        data: [{ id: "capture" }],
        status: 200,
        error: null,
      });
    expect(await readView("captures", query)).toEqual([{ id: "capture" }]);
    expect(query).toHaveBeenCalledTimes(2);
    expect(log.mock.calls.flat().join()).not.toContain("PRIVATE CONTENT");
  });
  it("does not retry permission or schema failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const query = vi
      .fn()
      .mockResolvedValue({
        data: null,
        status: 403,
        error: { code: "42501", message: "private" },
      });
    await expect(readView("captures", query)).rejects.toMatchObject({
      status: 503,
    });
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("bounds repeated failures and never returns empty success", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const query = vi
      .fn()
      .mockResolvedValue({
        data: null,
        status: 503,
        error: { message: "unavailable" },
      });
    await expect(readView("captures", query)).rejects.toMatchObject({
      status: 503,
    });
    expect(query).toHaveBeenCalledTimes(2);
  });
});
