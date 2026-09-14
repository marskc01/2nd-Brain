import { adminDb } from "../db";
import { configured } from "../config";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function owner(request: Request) {
  if (!configured())
    throw new HttpError(
      503,
      "Setup required: configure Supabase and OWNER_USER_ID.",
    );
  const match = /^Bearer (\S+)$/.exec(
    request.headers.get("authorization") || "",
  );
  if (!match) throw new HttpError(401, "Sign in to continue.");
  const db = adminDb();
  const { data, error } = await db.auth.getUser(match[1]);
  if (error || !data.user)
    throw new HttpError(401, "Your session has expired. Sign in again.");
  if (data.user.id !== process.env.OWNER_USER_ID)
    throw new HttpError(403, "This application is restricted to its owner.");
  return { db, id: data.user.id };
}
export function checked<T>(result: {
  data: T;
  error: { message: string } | null;
}): T {
  if (result.error) throw new Error("Database operation failed");
  return result.data;
}
export function failure(error: unknown) {
  if (error instanceof HttpError)
    return Response.json({ error: error.message }, { status: error.status });
  return Response.json(
    { error: "Operation failed. Check setup and system health, then retry." },
    { status: 500 },
  );
}
export async function json(request: Request) {
  const text = await request.text();
  if (Buffer.byteLength(text) > 64000)
    throw new HttpError(413, "Request is too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
}
