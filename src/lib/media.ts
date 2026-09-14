import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { limits } from "./config";
const run = promisify(execFile);
export type MediaSample = {
  duration: number;
  hasVideo: boolean;
  hasAudio: boolean;
  frames: { atMs: number; dataUrl: string }[];
  audioPath?: string;
  cleanup: () => Promise<void>;
};
export async function sampleMedia(bytes: Buffer): Promise<MediaSample> {
  if (!bytes.length || bytes.length > limits.bytes)
    throw new Error("File must be between 1 byte and 25 MB");
  const dir = await mkdtemp(join(tmpdir(), "kdn-media-"));
  const path = join(dir, "source");
  const cleanup = () => rm(dir, { recursive: true, force: true });
  try {
    await writeFile(path, bytes, { mode: 0o600 });
    const { stdout } = await run(
      "ffprobe",
      [
        "-v",
        "error",
        "-protocol_whitelist",
        "file,pipe",
        "-format_whitelist",
        "mov,matroska,webm,jpeg_pipe,png_pipe,image2",
        "-show_format",
        "-show_streams",
        "-of",
        "json",
        path,
      ],
      { timeout: 10000, maxBuffer: 1024 * 1024 },
    );
    const probe = JSON.parse(stdout) as {
      format: { duration?: string; format_name?: string };
      streams: { codec_type: string; width?: number; height?: number }[];
    };
    if (
      !/(mov|mp4|matroska|webm|jpeg|png)/.test(probe.format.format_name || "")
    )
      throw new Error("Only MP4/MOV/WebM/JPEG/PNG content is supported");
    const video = probe.streams.find((s) => s.codec_type === "video"),
      hasAudio = probe.streams.some((s) => s.codec_type === "audio");
    const image = /image2|jpeg_pipe|png_pipe/.test(
      probe.format.format_name || "",
    );
    const duration = image ? 0 : Number(probe.format.duration);
    if (
      !Number.isFinite(duration) ||
      duration < 0 ||
      (!image && duration === 0) ||
      duration > limits.seconds
    )
      throw new Error(
        "Media must have a valid duration of at most 120 seconds",
      );
    if (video && ((video.width || 0) > 4096 || (video.height || 0) > 4096))
      throw new Error("Media dimensions exceed 4096 pixels");
    if (!video) throw new Error("Upload a video or image");
    const frames: MediaSample["frames"] = [];
    const count = image ? 1 : Math.min(8, Math.max(2, Math.ceil(duration / 5)));
    const times = Array.from({ length: count }, (_, i) =>
      image ? 0 : Math.min(duration - 0.05, (i * duration) / count),
    );
    if (!image) {
      const scene = await run(
        "ffmpeg",
        [
          "-hide_banner",
          "-nostdin",
          "-protocol_whitelist",
          "file,pipe",
          "-format_whitelist",
          "mov,matroska,webm,jpeg_pipe,png_pipe,image2",
          "-i",
          path,
          "-an",
          "-vf",
          "select='gt(scene,0.35)',showinfo",
          "-frames:v",
          "4",
          "-f",
          "null",
          "-",
        ],
        { timeout: 30000, maxBuffer: 1024 * 1024 },
      );
      for (const match of scene.stderr.matchAll(/pts_time:([0-9.]+)/g)) {
        const time = Number(match[1]);
        if (time < duration && times.every((t) => Math.abs(t - time) > 0.5))
          times.push(time);
      }
    }
    for (const [index, time] of times
      .sort((a, b) => a - b)
      .slice(0, limits.frames)
      .entries()) {
      const output = join(dir, `frame-${index}.jpg`);
      await run(
        "ffmpeg",
        [
          "-v",
          "error",
          "-nostdin",
          "-protocol_whitelist",
          "file,pipe",
          "-format_whitelist",
          "mov,matroska,webm,jpeg_pipe,png_pipe,image2",
          "-ss",
          String(time),
          "-i",
          path,
          "-frames:v",
          "1",
          "-vf",
          "scale=768:768:force_original_aspect_ratio=decrease",
          "-threads",
          "1",
          output,
        ],
        { timeout: 15000, maxBuffer: 1024 * 1024 },
      );
      frames.push({
        atMs: Math.round(time * 1000),
        dataUrl: `data:image/jpeg;base64,${(await readFile(output)).toString("base64")}`,
      });
    }
    let audioPath: string | undefined;
    if (hasAudio) {
      audioPath = join(dir, "audio.wav");
      await run(
        "ffmpeg",
        [
          "-v",
          "error",
          "-nostdin",
          "-protocol_whitelist",
          "file,pipe",
          "-format_whitelist",
          "mov,matroska,webm,jpeg_pipe,png_pipe,image2",
          "-i",
          path,
          "-vn",
          "-ac",
          "1",
          "-ar",
          "16000",
          "-t",
          String(limits.seconds),
          audioPath,
        ],
        { timeout: 30000, maxBuffer: 1024 * 1024 },
      );
      if ((await stat(audioPath)).size > limits.bytes)
        throw new Error("Extracted audio exceeds limit");
    }
    return { duration, hasVideo: !image, hasAudio, frames, audioPath, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
