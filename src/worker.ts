import nextEnv from "@next/env";
import crypto from "node:crypto";
import { adminDb } from "./lib/db";
import { processCapture, Blocked, type Job } from "./lib/pipeline";
import { checked } from "./lib/server/auth";
nextEnv.loadEnvConfig(process.cwd());
const worker = `worker-${crypto.randomUUID()}`;
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
async function main() {
  const db = adminDb();
  console.log(
    "KDN worker started. One capture at a time; Ctrl+C stops after the current capture.",
  );
  while (!stopping) {
    try {
      checked(
        await db
          .from("worker_heartbeats")
          .upsert({ worker_id: worker, last_seen: new Date().toISOString() }),
      );
      const jobs = checked(
        await db.rpc("claim_jobs", {
          p_worker: worker,
          p_limit: 1,
          p_lease_seconds: 180,
        }),
      ) as Job[];
      for (const job of jobs) {
        const heartbeat = setInterval(() => {
          void db
            .rpc("renew_job", { p_job: job.id, p_worker: worker })
            .then(() => {});
          void db
            .from("worker_heartbeats")
            .upsert({ worker_id: worker, last_seen: new Date().toISOString() })
            .then(() => {});
        }, 30000);
        try {
          await processCapture(job, worker);
          console.log(JSON.stringify({ job: job.id, event: "completed" }));
        } catch (error) {
          const blocked = error instanceof Blocked;
          const message = blocked
            ? error.message
            : "Processing failed. Check worker configuration and media limits, then Retry. Provider or private content details are omitted from logs.";
          checked(
            await db.rpc("fail_job", {
              p_job: job.id,
              p_worker: worker,
              p_message: message,
              p_blocked: blocked,
            }),
          );
          console.error(
            JSON.stringify({
              job: job.id,
              event: blocked ? "blocked" : "failed",
              errorType: error instanceof Error ? error.name : "unknown",
            }),
          );
        } finally {
          clearInterval(heartbeat);
        }
      }
    } catch {
      console.error(
        "Worker database unavailable. Check credentials and apply migrations 001 and 002.",
      );
    }
    if (!stopping) await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}
main().catch(() => {
  console.error(
    "Worker could not start: configure server credentials in .env.local.",
  );
  process.exitCode = 1;
});
