import { normalizedMessageSchema, type NormalizedMessage } from "./domain";
type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
}
export function normalizeInstagram(body: unknown): NormalizedMessage[] {
  const out: NormalizedMessage[] = [];
  const root = record(body);
  for (const entry of Array.isArray(root.entry) ? root.entry : []) {
    const e = record(entry);
    for (const raw of Array.isArray(e.messaging) ? e.messaging : []) {
      const m = record(raw),
        msg = record(m.message),
        sender = record(m.sender);
      if (typeof msg.mid !== "string" || typeof sender.id !== "string")
        continue;
      const timestamp =
        typeof m.timestamp === "number"
          ? m.timestamp
          : typeof e.time === "number"
            ? e.time
            : Date.now();
      if (!Number.isFinite(timestamp) || Math.abs(timestamp) > 8640000000000000)
        continue;
      const attachments = (
        Array.isArray(msg.attachments) ? msg.attachments : []
      ).map((a) => {
        const item = record(a),
          payload = record(item.payload);
        const url =
          typeof payload.url === "string" && /^https:\/\//.test(payload.url)
            ? payload.url
            : undefined;
        return {
          type: typeof item.type === "string" ? item.type : "unknown",
          url,
          payload,
        };
      });
      const parsed = normalizedMessageSchema.safeParse({
        eventId: `${e.id ?? "instagram"}:${msg.mid}`,
        senderId: sender.id,
        messageId: msg.mid,
        sentAt: new Date(timestamp).toISOString(),
        text: typeof msg.text === "string" ? msg.text : undefined,
        isEcho: msg.is_echo === true,
        attachments,
        raw: record(raw),
      });
      if (parsed.success) out.push(parsed.data);
    }
  }
  return out;
}
export function acceptOwnerMessage(
  message: NormalizedMessage,
  ownerId: string,
) {
  if (message.isEcho) return { accepted: false as const, reason: "echo" };
  if (!ownerId || message.senderId !== ownerId)
    return { accepted: false as const, reason: "unknown_sender" };
  return { accepted: true as const };
}
