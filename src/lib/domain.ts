import { z } from "zod";

export const coverageSchema = z.object({
  video: z.enum(["available", "partial", "unavailable", "unknown"]),
  audio: z.enum(["available", "partial", "unavailable", "unknown"]),
  transcription: z.enum([
    "complete",
    "partial",
    "unavailable",
    "not_attempted",
  ]),
  visuals: z.enum(["sampled", "partial", "unavailable", "not_attempted"]),
  onScreenText: z.enum(["sampled", "partial", "unavailable", "not_attempted"]),
  caption: z.enum(["available", "unavailable", "unknown"]),
  ownerNote: z.enum(["available", "unavailable"]),
});
export type Coverage = z.infer<typeof coverageSchema>;
export type ContentState =
  | "MEDIA_ANALYSED"
  | "PARTIAL_CONTENT"
  | "METADATA_ONLY"
  | "URL_ONLY"
  | "NEEDS_CONTENT"
  | "UNAVAILABLE";

export const normalizedMessageSchema = z.object({
  eventId: z.string().min(1),
  senderId: z.string().min(1),
  messageId: z.string().min(1),
  sentAt: z.string(),
  text: z.string().optional(),
  isEcho: z.boolean().default(false),
  attachments: z
    .array(
      z.object({
        type: z.string(),
        url: z.string().url().optional(),
        payload: z.record(z.unknown()).default({}),
      }),
    )
    .default([]),
  raw: z.record(z.unknown()),
});
export type NormalizedMessage = z.infer<typeof normalizedMessageSchema>;

export const actionProposalSchema = z.object({
  type: z.enum([
    "save_reference",
    "research",
    "create_brief",
    "create_script",
    "create_checklist",
    "create_experiment",
    "update_project",
    "draft_outreach",
    "send_message",
    "publish",
    "purchase",
    "paid_generation",
    "external_change",
    "delete",
  ]),
  intendedResult: z.string().min(1),
  inputs: z.record(z.unknown()).default({}),
  projectId: z.string().uuid().optional(),
  estimatedCostUsd: z.number().nonnegative().default(0),
  evidenceIds: z.array(z.string().uuid()).default([]),
});
export type ActionProposal = z.infer<typeof actionProposalSchema>;

export function contentState(c: Coverage): ContentState {
  if (
    c.video === "available" &&
    (c.transcription === "complete" || c.audio === "unavailable") &&
    c.visuals === "sampled"
  )
    return "MEDIA_ANALYSED";
  if (
    c.video === "partial" ||
    c.transcription === "complete" ||
    c.transcription === "partial" ||
    c.visuals === "sampled" ||
    c.visuals === "partial"
  )
    return "PARTIAL_CONTENT";
  if (c.caption === "available" || c.ownerNote === "available")
    return "METADATA_ONLY";
  return "NEEDS_CONTENT";
}
