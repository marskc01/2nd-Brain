export const limits = {
  bytes: 25 * 1024 * 1024,
  seconds: 120,
  frames: 12,
  text: 20000,
  outputTokens: 3000,
};
export const models = () => ({
  reasoning: process.env.OPENAI_REASONING_MODEL || "gpt-4.1-mini",
  vision: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
  transcription: process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1",
  embedding: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
});
export const promptVersion = "kdn-2026-09-14-v2";
export function configured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.OWNER_USER_ID,
  );
}
export function positiveEnv(key: string, fallback: number) {
  const value = Number(process.env[key] ?? fallback);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid ${key}`);
  return value;
}
