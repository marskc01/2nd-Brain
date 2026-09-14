import { HttpError } from "./auth";

type Result<T> = {
  data: T;
  error: { code?: string; message: string } | null;
  status?: number;
};

// Reads only: never use this helper for mutations or external side effects.
export async function readView<T>(
  name: string,
  query: (signal: AbortSignal) => PromiseLike<Result<T>>,
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await query(AbortSignal.timeout(12000));
    if (!result.error) return result.data;
    const code = /^[A-Z0-9]{1,12}$/.test(result.error.code || "")
      ? result.error.code
      : "unavailable";
    // Provider error text may include private values. Log only bounded metadata.
    console.error(
      JSON.stringify({
        event: "dashboard_read_failed",
        query: name,
        status: result.status || 0,
        code,
        attempt: attempt + 1,
      }),
    );
    const transient = result.status === 0 || (result.status || 0) >= 500;
    if (!transient || attempt === 1) break;
  }
  throw new HttpError(
    503,
    "Your saved data could not be loaded. We will retry automatically; your captures are preserved.",
  );
}
