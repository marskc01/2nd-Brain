import { owner, checked, failure } from "@/lib/server/auth";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { db, id } = await owner(request);
    const result: Record<string, unknown[]> = {};
    for (const table of [
      "owner_profiles",
      "goals",
      "projects",
      "captures",
      "actions",
      "artifacts",
      "knowledge_items",
      "budget_reservations",
    ]) {
      const rows: unknown[] = [];
      for (let page = 0; ; page++) {
        const data =
          checked(
            await db
              .from(table)
              .select("*")
              .eq(table === "owner_profiles" ? "id" : "owner_id", id)
              .order(table === "owner_profiles" ? "id" : "created_at")
              .range(page * 500, page * 500 + 499),
          ) || [];
        rows.push(...data);
        if (data.length < 500) break;
      }
      result[table] = rows;
    }
    return Response.json(
      {
        exportedAt: new Date().toISOString(),
        format: "kdn-owner-records-v1",
        note: "Record export; original media bytes, raw webhooks and worker logs are retained separately.",
        records: result,
      },
      {
        headers: {
          "Content-Disposition":
            'attachment; filename="kdn-brain-records.json"',
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return failure(error);
  }
}
