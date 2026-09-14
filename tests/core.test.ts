import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifyMetaSignature } from "../src/lib/security";
import { normalizeInstagram, acceptOwnerMessage } from "../src/lib/instagram";
import { contentState } from "../src/lib/domain";
import { evaluateAction, approvalStillValid } from "../src/lib/policy";
import { routeIntent } from "../src/lib/workflow";
import fixture from "./fixtures/instagram-shared-post.json";
describe("Meta ingestion", () => {
  it("verifies the raw request and rejects invalid signatures", () => {
    const b = Buffer.from("raw body"),
      s = "secret",
      h = "sha256=" + crypto.createHmac("sha256", s).update(b).digest("hex");
    expect(verifyMetaSignature(b, h, s)).toBe(true);
    expect(verifyMetaSignature(Buffer.from("changed"), h, s)).toBe(false);
    expect(verifyMetaSignature(b, "sha256=bad", s)).toBe(false);
  });
  it("parses documented envelope defensively", () => {
    const [m] = normalizeInstagram(fixture);
    expect(m.messageId).toBe("m_fixture_1");
    expect(m.attachments[0].type).toBe("share");
    expect(m.attachments[0].url).toBeUndefined();
  });
  it("filters echoes and quarantines unknown senders", () => {
    const [m] = normalizeInstagram(fixture);
    expect(acceptOwnerMessage(m, "owner_ig_id").accepted).toBe(true);
    expect(acceptOwnerMessage(m, "other")).toEqual({
      accepted: false,
      reason: "unknown_sender",
    });
    expect(acceptOwnerMessage({ ...m, isEcho: true }, "owner_ig_id")).toEqual({
      accepted: false,
      reason: "echo",
    });
  });
  it("ignores malformed messaging records", () =>
    expect(
      normalizeInstagram({ entry: [{ messaging: [{ message: {} }] }] }),
    ).toEqual([]));
});
describe("truthful content state", () => {
  it("never calls URL or metadata watched", () => {
    expect(
      contentState({
        video: "unavailable",
        audio: "unknown",
        transcription: "not_attempted",
        visuals: "not_attempted",
        onScreenText: "not_attempted",
        caption: "unavailable",
        ownerNote: "available",
      }),
    ).toBe("METADATA_ONLY");
    expect(
      contentState({
        video: "available",
        audio: "available",
        transcription: "complete",
        visuals: "sampled",
        onScreenText: "sampled",
        caption: "available",
        ownerNote: "available",
      }),
    ).toBe("MEDIA_ANALYSED");
  });
});
describe("routing and policy", () => {
  const action = {
    type: "create_experiment" as const,
    intendedResult: "A bounded test",
    inputs: { metric: "leads" },
    estimatedCostUsd: 0,
    evidenceIds: [],
  };
  it("honours explicit intent", () =>
    expect(routeIntent("/save just inspiration")).toBe("save_reference"));
  it("allows internal work but gates external operations", () => {
    expect(
      evaluateAction(action, {
        captureId: "c",
        captureRemainingUsd: 1,
        dailyRemainingUsd: 5,
      }).decision,
    ).toBe("execute");
    expect(
      evaluateAction(
        { ...action, type: "publish" },
        { captureId: "c", captureRemainingUsd: 1, dailyRemainingUsd: 5 },
      ).decision,
    ).toBe("approval_required");
  });
  it("enforces budget and invalidates materially changed approvals", () => {
    expect(
      evaluateAction(
        { ...action, estimatedCostUsd: 2 },
        { captureId: "c", captureRemainingUsd: 1, dailyRemainingUsd: 5 },
      ).decision,
    ).toBe("denied");
    expect(approvalStillValid("wrong", action)).toBe(false);
  });
});
