import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { verifyMetaSignature } from "@/lib/security";
import { normalizeInstagram, acceptOwnerMessage } from "@/lib/instagram";
import { adminDb } from "@/lib/db";
export const runtime = "nodejs";
export async function GET(r: NextRequest) {
  const q = r.nextUrl.searchParams;
  const token = process.env.META_VERIFY_TOKEN;
  if (
    token &&
    q.get("hub.mode") === "subscribe" &&
    q.get("hub.verify_token") === token &&
    q.get("hub.challenge")
  )
    return new NextResponse(q.get("hub.challenge"));
  return new NextResponse("Forbidden", { status: 403 });
}
export async function POST(r: NextRequest) {
  if (Number(r.headers.get("content-length") || 0) > 1048576)
    return new NextResponse("Too large", { status: 413 });
  const reader = r.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 1048576) {
        await reader.cancel();
        return new NextResponse("Too large", { status: 413 });
      }
      chunks.push(value);
    }
  }
  const raw = Buffer.concat(chunks);
  if (
    !verifyMetaSignature(
      raw,
      r.headers.get("x-hub-signature-256"),
      process.env.META_APP_SECRET || "",
    )
  )
    return new NextResponse("Invalid signature", { status: 401 });
  let body: unknown;
  try {
    body = JSON.parse(raw.toString());
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }
  try {
    if (!process.env.OWNER_USER_ID) throw new Error("Missing owner");
    const messages = normalizeInstagram(body).map((m) => {
      const verdict = acceptOwnerMessage(
        m,
        process.env.OWNER_INSTAGRAM_ID || "",
      );
      return {
        ...m,
        disposition: verdict.accepted
          ? "accepted"
          : verdict.reason === "echo"
            ? "ignored_echo"
            : "quarantined",
      };
    });
    const { error } = await adminDb().rpc("ingest_meta_batch", {
      p_owner: process.env.OWNER_USER_ID,
      p_batch_key: crypto.createHash("sha256").update(raw).digest("hex"),
      p_payload: body,
      p_messages: messages,
    });
    if (error) throw error;
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json(
      { error: "Durable ingestion unavailable" },
      { status: 503 },
    );
  }
}
