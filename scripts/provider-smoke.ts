import nextEnv from "@next/env";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { sampleMedia } from "../src/lib/media";
import {
  analyseMedia,
  understand,
  createArtifact,
  type Context,
} from "../src/lib/intelligence";
nextEnv.loadEnvConfig(process.cwd());
if (!process.env.OPENAI_API_KEY) {
  console.error(
    "UNVERIFIED: OPENAI_API_KEY is missing. No provider call was made.",
  );
  process.exit(2);
}
const sample = await sampleMedia(
  await readFile("tests/fixtures/media/owned-sample.mp4"),
);
try {
  const evidence = await analyseMedia(sample, "owned-sample");
  const text = evidence
    .map((e) => e.text)
    .join(" ")
    .toLowerCase();
  if (
    !text.includes("red") ||
    !text.includes("blue") ||
    !evidence.some((e) => e.kind === "source_claim")
  )
    throw new Error(
      "Provider did not identify expected speech and both colours.",
    );
  const context: Context = {
    goals: [],
    projects: [],
    profile: null,
    related: [],
  };
  const understanding = await understand(
    evidence,
    "Create a short script using this visual contrast.",
    context,
    { video: "available", visuals: "sampled" },
  );
  const artifact = await createArtifact(understanding, "script", context, null);
  await mkdir("work/provider-smoke", { recursive: true });
  await writeFile(
    "work/provider-smoke/result.json",
    JSON.stringify(
      {
        verifiedAt: new Date().toISOString(),
        evidence,
        understanding,
        artifact,
      },
      null,
      2,
    ),
  );
  await writeFile("work/provider-smoke/script.md", artifact.content);
  console.log(
    "PASS: Actual video → speech transcription + sampled vision → structured understanding → script. Results in work/provider-smoke. Live Instagram was not tested.",
  );
} finally {
  await sample.cleanup();
}
