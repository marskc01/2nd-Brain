import { configured } from "@/lib/config";
export function GET() {
  return Response.json(
    {
      service: "kdn-brain",
      status: configured() ? "configured_not_verified" : "setup_required",
      workerRequired: true,
      details: "Sign in and open Settings for database and worker diagnostics.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
