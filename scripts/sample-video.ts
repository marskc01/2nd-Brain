import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir } from "node:fs/promises";
const run = promisify(execFile);
await mkdir("tests/fixtures/media", { recursive: true });
await mkdir("work", { recursive: true });
await run("say", [
  "-o",
  "work/sample-narration.aiff",
  "A red square is on the left. A blue square is on the right. Compare the opening shots before choosing an edit.",
]);
await run("ffmpeg", [
  "-y",
  "-v",
  "error",
  "-f",
  "lavfi",
  "-i",
  "color=c=white:s=640x360:r=12:d=10,drawbox=x=60:y=100:w=140:h=140:color=red:t=fill:enable='lt(t,5)',drawbox=x=440:y=100:w=140:h=140:color=blue:t=fill:enable='gte(t,5)'",
  "-i",
  "work/sample-narration.aiff",
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  "-c:a",
  "aac",
  "-af",
  "apad",
  "-t",
  "10",
  "-movflags",
  "+faststart",
  "tests/fixtures/media/owned-sample.mp4",
]);
console.log(
  "Created original synthetic sample: tests/fixtures/media/owned-sample.mp4. See sample-manifest.json for expected speech and visuals.",
);
