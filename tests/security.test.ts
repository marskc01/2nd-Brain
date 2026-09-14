import { describe, it, expect, vi, afterEach } from "vitest";
import crypto from "node:crypto";
import { NextRequest } from "next/server";
import {
  verifyMetaSignature,
  publicIp,
  assertSafePublicUrl,
} from "../src/lib/security";
import { normalizeInstagram } from "../src/lib/instagram";
const dbMock = vi.hoisted(() => ({ rpc: vi.fn(), auth: { getUser: vi.fn() } }));
vi.mock("../src/lib/db", () => ({ adminDb: () => dbMock }));
vi.mock("@/lib/db", () => ({ adminDb: () => dbMock }));
import { owner } from "../src/lib/server/auth";
// Route uses an alias resolved by vitest.config.ts.
import { GET, POST } from "../src/app/api/webhooks/meta/route";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("security regression tests", () => {
  it("rejects correctly-sized nonhex signatures without throwing", () => {
    expect(
      verifyMetaSignature(
        Buffer.from("x"),
        "sha256=" + "z".repeat(64),
        "secret",
      ),
    ).toBe(false);
  });
  it("blocks private, link-local, mapped and alternate IP representations", async () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.2",
      "169.254.169.254",
      "100.64.0.1",
      "172.16.1.1",
      "192.168.1.1",
      "::1",
      "::ffff:127.0.0.1",
    ])
      expect(publicIp(ip)).toBe(false);
    expect(publicIp("1.1.1.1")).toBe(true);
    await expect(assertSafePublicUrl("https://2130706433/")).rejects.toThrow();
    await expect(
      assertSafePublicUrl("https://user:password@example.com/"),
    ).rejects.toThrow();
  });
  it("handles malformed arrays and preserves unknown attachments safely", () => {
    expect(normalizeInstagram({ entry: { bad: true } })).toEqual([]);
    expect(normalizeInstagram({ entry: [{ messaging: {} }] })).toEqual([]);
    const result = normalizeInstagram({
      entry: [
        {
          id: "i",
          messaging: [
            {
              sender: { id: "owner" },
              message: {
                mid: "m",
                attachments: [
                  null,
                  { type: "future", payload: { unknown: "preserved" } },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(result[0].attachments[1].payload.unknown).toBe("preserved");
  });
  it("requires a nonempty configured verify token", async () => {
    vi.stubEnv("META_VERIFY_TOKEN", "");
    expect(
      (
        await GET(
          new NextRequest(
            "http://localhost/api?hub.mode=subscribe&hub.verify_token=&hub.challenge=test",
          ),
        )
      ).status,
    ).toBe(403);
    vi.stubEnv("META_VERIFY_TOKEN", "test-secret");
    expect(
      await (
        await GET(
          new NextRequest(
            "http://localhost/api?hub.mode=subscribe&hub.verify_token=test-secret&hub.challenge=42",
          ),
        )
      ).text(),
    ).toBe("42");
  });
  it("does not acknowledge a signed webhook until durable ingestion succeeds", async () => {
    vi.stubEnv("META_APP_SECRET", "secret");
    vi.stubEnv("OWNER_USER_ID", "00000000-0000-4000-8000-000000000001");
    const body = JSON.stringify({ entry: [] });
    const signature =
      "sha256=" +
      crypto.createHmac("sha256", "secret").update(body).digest("hex");
    const request = () =>
      new NextRequest("http://localhost/api", {
        method: "POST",
        body,
        headers: { "x-hub-signature-256": signature },
      });
    dbMock.rpc.mockResolvedValueOnce({
      error: { message: "storage unavailable" },
    });
    expect((await POST(request())).status).toBe(503);
    dbMock.rpc.mockResolvedValueOnce({ error: null });
    expect((await POST(request())).status).toBe(200);
    expect(
      (
        await POST(
          new NextRequest("http://localhost/api", { method: "POST", body }),
        )
      ).status,
    ).toBe(401);
  });
  it("validates the bearer token and rejects a different Supabase user", async () => {
    for (const key of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ])
      vi.stubEnv(key, "test");
    vi.stubEnv("OWNER_USER_ID", "owner");
    await expect(owner(new Request("http://localhost"))).rejects.toMatchObject({
      status: 401,
    });
    dbMock.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "stranger" } },
      error: null,
    });
    await expect(
      owner(
        new Request("http://localhost", {
          headers: { authorization: "Bearer sample-token" },
        }),
      ),
    ).rejects.toMatchObject({ status: 403 });
    dbMock.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "owner" } },
      error: null,
    });
    expect(
      (
        await owner(
          new Request("http://localhost", {
            headers: { authorization: "Bearer sample-token" },
          }),
        )
      ).id,
    ).toBe("owner");
  });
});
