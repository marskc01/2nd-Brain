import { describe, it, expect } from "vitest";
import { instagramContent, normalizeInstagram } from "../src/lib/instagram";

// Fixture derived from Meta's published post-share transition schema.
// Fake IDs/URLs; this is not a captured live Instagram webhook.
const payload = {
  ig_post_media_id: "fixture-post-id",
  title: "A creator's unverified claim",
  url: "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=fixture",
};
describe("documented Instagram post-share content", () => {
  it("deduplicates transitional share and ig_post attachments", () => {
    const [message] = normalizeInstagram({
      object: "instagram",
      entry: [
        {
          id: "receiver",
          messaging: [
            {
              sender: { id: "owner" },
              timestamp: 1761287294014,
              message: {
                mid: "fixture-message",
                attachments: [
                  { type: "share", payload },
                  { type: "ig_post", payload },
                ],
              },
            },
          ],
        },
      ],
    });
    const content = instagramContent(message.attachments);
    expect(content.candidates).toHaveLength(1);
    expect(content.captions).toEqual([payload.title]);
    expect(message.attachments).toHaveLength(2); // raw provenance preserved
  });
  it("accepts ig_post without legacy share and preserves caption-only evidence", () => {
    const content = instagramContent([
      { type: "ig_post", payload: { title: "Caption without media" } },
      { type: "ig_post", url: payload.url, payload },
      {
        type: "future",
        url: "https://example.com/unknown",
        payload: { title: "Ignored" },
      },
    ]);
    expect(content.candidates).toHaveLength(1);
    expect(content.captions).toEqual(["Caption without media", payload.title]);
  });
  it("bounds retrieval attempts and does not equate a share URL with analysed video", () => {
    const content = instagramContent(
      Array.from({ length: 8 }, (_, i) => ({
        type: "ig_post",
        url: `https://www.instagram.com/reel/fixture${i}/`,
        payload: {},
      })),
    );
    expect(content.candidates).toHaveLength(3);
    expect(content.captions).toEqual([]);
    expect(content.candidates[0].attachment.type).toBe("ig_post");
  });
});
