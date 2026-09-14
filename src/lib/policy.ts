import crypto from "node:crypto";
import { actionProposalSchema, type ActionProposal } from "./domain";
const automatic = new Set([
  "save_reference",
  "research",
  "create_brief",
  "create_script",
  "create_checklist",
  "create_experiment",
  "update_project",
  "draft_outreach",
]);
export type Decision = {
  decision: "execute" | "approval_required" | "denied";
  reason: string;
  idempotencyKey: string;
};
export function evaluateAction(
  raw: ActionProposal,
  ctx: {
    captureId: string;
    captureRemainingUsd: number;
    dailyRemainingUsd: number;
    standingRule?: {
      actionType: string;
      maxCostUsd: number;
      expiresAt: string;
      destination?: string;
      tool?: string;
    };
  },
): Decision {
  const a = actionProposalSchema.parse(raw);
  const key = crypto
    .createHash("sha256")
    .update(JSON.stringify([ctx.captureId, a.type, a.inputs, a.intendedResult]))
    .digest("hex");
  if (
    a.estimatedCostUsd > ctx.captureRemainingUsd ||
    a.estimatedCostUsd > ctx.dailyRemainingUsd
  )
    return {
      decision: "denied",
      reason: "Budget limit exceeded",
      idempotencyKey: key,
    };
  if (automatic.has(a.type))
    return {
      decision: "execute",
      reason: "Private internal action allowed by default",
      idempotencyKey: key,
    };
  const r = ctx.standingRule;
  if (
    r &&
    r.actionType === a.type &&
    Boolean(r.destination) &&
    Boolean(r.tool) &&
    r.destination === a.inputs.destination &&
    r.tool === a.inputs.tool &&
    r.maxCostUsd >= a.estimatedCostUsd &&
    Date.parse(r.expiresAt) > Date.now()
  )
    return {
      decision: "execute",
      reason: "Applicable standing rule",
      idempotencyKey: key,
    };
  return {
    decision: "approval_required",
    reason: "External, paid, or destructive operation",
    idempotencyKey: key,
  };
}
export function approvalStillValid(
  approvedFingerprint: string,
  action: ActionProposal,
) {
  return (
    approvedFingerprint ===
    crypto
      .createHash("sha256")
      .update(JSON.stringify(actionProposalSchema.parse(action)))
      .digest("hex")
  );
}
