import nextEnv from "@next/env";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { adminDb } from "../src/lib/db";
nextEnv.loadEnvConfig(process.cwd());
const run = promisify(execFile);
let failed = false;
for (const key of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OWNER_USER_ID",
  "OPENAI_API_KEY",
]) {
  const present = Boolean(process.env[key]);
  console.log(`${present ? "OK" : "MISSING"} ${key}`);
  if (!present) failed = true;
}
for (const bin of ["ffmpeg", "ffprobe"])
  try {
    await run(bin, ["-version"]);
    console.log(`OK ${bin}`);
  } catch {
    console.log(`MISSING ${bin} in worker PATH`);
    failed = true;
  }
if (
  process.env.SUPABASE_SERVICE_ROLE_KEY &&
  process.env.NEXT_PUBLIC_SUPABASE_URL
) {
  try {
    const db = adminDb();
    for (const table of [
      "captures",
      "jobs",
      "worker_heartbeats",
      "budget_reservations",
    ]) {
      const { error } = await db
        .from(table)
        .select("*", { head: true, count: "exact" });
      console.log(`${error ? "FAIL" : "OK"} database table ${table}`);
      if (error) failed = true;
    }
    const { data } = await db
      .from("owner_profiles")
      .select("id")
      .eq("id", process.env.OWNER_USER_ID || "")
      .maybeSingle();
    console.log(`${data ? "OK" : "MISSING"} owner profile`);
    const bucket = await db.storage.getBucket("kdn-media");
    console.log(
      `${bucket.data && !bucket.data.public ? "OK" : "FAIL"} private media bucket`,
    );
  } catch {
    console.log("FAIL database connection");
    failed = true;
  }
}
console.log(
  `Instagram: ${process.env.META_APP_SECRET && process.env.OWNER_INSTAGRAM_ID ? "configured, LIVE TEST UNVERIFIED" : "not configured"}`,
);
console.log(
  "No paid provider call was made. Run npm run test:provider separately.",
);
process.exitCode = failed ? 2 : 0;
