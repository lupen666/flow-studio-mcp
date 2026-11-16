import { execFile } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, extname, join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const FFMPEG = process.env.FLOW_MCP_FFMPEG ?? "ffmpeg";
const FFPROBE = process.env.FLOW_MCP_FFPROBE ?? "ffprobe";
const OUTPUT_ROOT = process.env.FLOW_MCP_OUTPUT ?? join(homedir(), "flow-mcp-out");
export const VERTICAL_DIR = join(OUTPUT_ROOT, "vertical");

export type VerticalMode = "blur-fill" | "center-crop";

export interface VerticalExportArgs {
  inputPath: string;
  mode?: VerticalMode;
  panX?: number;
  width?: number;
  height?: number;
  blurStrength?: number;
  outputPath?: string;
  safeZoneGuides?: boolean;
}

function buildFilterGraph(mode: VerticalMode, width: number, height: number, panX: number, blurStrength: number, guides: boolean): string {
  const clampedPan = Math.max(-1, Math.min(1, panX));
  let base: string;
  if (mode === "center-crop") {
    const xExpr = `(iw-ow)/2*(1+${clampedPan.toFixed(3)})`;
    base = `[0:v]scale=-2:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}:${xExpr}:0,setsar=1[v]`;
  } else {
    const sigma = Math.max(5, Math.min(60, blurStrength));
    base =
      `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},boxblur=${sigma}:2[bg];` +
      `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease[fg];` +
      `[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[v]`;
  }
  if (!guides) return base;
  const topH = Math.round(height * 0.14);
  const botY = Math.round(height * 0.78);
  const botH = height - botY;
  const rightX = Math.round(width * 0.85);
  return (
    `${base};` +
    `[v]drawbox=x=0:y=0:w=${width}:h=${topH}:color=yellow@0.25:t=fill,` +
    `drawbox=x=0:y=${botY}:w=${width}:h=${botH}:color=cyan@0.25:t=fill,` +
    `drawbox=x=${rightX}:y=${topH}:w=${width - rightX}:h=${botY - topH}:color=magenta@0.25:t=fill[v]`
  );
}

/**
 * Generates a single PNG preview frame showing how the 9:16 vertical layout and safe-zones look.
 */
export async function previewVerticalFrame(args: VerticalExportArgs & { timestampSec?: number }): Promise<{ previewPath: string }> {
  if (!existsSync(args.inputPath)) throw new Error(`Input video not found: ${args.inputPath}`);
  mkdirSync(VERTICAL_DIR, { recursive: true });
  const width = args.width ?? 1080;
  const height = args.height ?? 1920;
  const mode = args.mode ?? "blur-fill";
  const filter = buildFilterGraph(mode, width, height, args.panX ?? 0, args.blurStrength ?? 24, args.safeZoneGuides ?? true);
  const name = basename(args.inputPath, extname(args.inputPath));
  const previewPath = join(VERTICAL_DIR, `${name}-preview-${mode}.png`);

  await run(FFMPEG, [
    "-y",
    "-ss",
    String(args.timestampSec ?? 0.5),
    "-i",
    args.inputPath,
    "-filter_complex",
    filter,
    "-map",
    "[v]",
    "-frames:v",
    "1",
    previewPath,
  ]);
  return { previewPath };
}

/**
 * Exports a video in 9:16 vertical format using FFmpeg (center-crop or blur-fill).
 */
export async function exportVerticalVideo(args: VerticalExportArgs): Promise<{
  outputPath: string;
  mode: VerticalMode;
  width: number;
  height: number;
}> {
  if (!existsSync(args.inputPath)) throw new Error(`Input video not found: ${args.inputPath}`);
  mkdirSync(VERTICAL_DIR, { recursive: true });
  const width = args.width ?? 1080;
  const height = args.height ?? 1920;
  const mode = args.mode ?? "blur-fill";
  const filter = buildFilterGraph(mode, width, height, args.panX ?? 0, args.blurStrength ?? 24, false);

  const baseName = basename(args.inputPath, extname(args.inputPath));
  const outputPath = args.outputPath ?? join(VERTICAL_DIR, `${baseName}-9x16-${mode}.mp4`);

  const probe = await run(FFPROBE, ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", args.inputPath]).catch(
    () => ({ stdout: "" }),
  );
  const hasAudio = probe.stdout.trim().length > 0;

  const ffArgs = [
    "-y",
    "-i",
    args.inputPath,
    "-filter_complex",
    filter,
    "-map",
    "[v]",
    ...(hasAudio ? ["-map", "0:a", "-c:a", "aac", "-b:a", "192k"] : []),
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputPath,
  ];
  await run(FFMPEG, ffArgs, { maxBuffer: 64 * 1024 * 1024 });
  return { outputPath, mode, width, height };
}
