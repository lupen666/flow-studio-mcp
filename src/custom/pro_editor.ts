import { execFile } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { renderCtaOverlayVideo, type CtaOverlayOptions } from "./cta_overlay.js";

const run = promisify(execFile);
const FFMPEG = process.env.FLOW_MCP_FFMPEG ?? "ffmpeg";
const FFPROBE = process.env.FLOW_MCP_FFPROBE ?? "ffprobe";
const OUTPUT_ROOT = process.env.FLOW_MCP_OUTPUT ?? join(homedir(), "flow-mcp-out");

export const XFADE_TRANSITIONS = [
  "dissolve",
  "fade",
  "fadeblack",
  "fadewhite",
  "fadeslow",
  "hblur",
  "smoothleft",
  "smoothright",
  "smoothup",
  "smoothdown",
  "slideleft",
  "slideright",
  "slideup",
  "slidedown",
  "wipeleft",
  "wiperight",
  "wipeup",
  "wipedown",
  "hlwind",
  "hrwind",
  "vuwind",
  "vdwind",
  "zoomin",
  "circleopen",
  "circleclose",
  "circlecrop",
  "radial",
  "diagtl",
  "diagtr",
  "diagbl",
  "diagbr",
  "coverleft",
  "coverright",
  "revealleft",
  "revealright",
] as const;

export type XfadeTransition = (typeof XFADE_TRANSITIONS)[number];

export type ColorGradePreset = "none" | "warm-cinema" | "golden-dream" | "pastel-soft" | "canyon-fresh";

export interface ProEditClip {
  path: string;
  from?: number;
  to?: number;
  /** Extra seconds cloned onto the end of this clip so transitions never clip speech. */
  tailPad?: number;
  volume?: number;
  /** Transition applied AFTER this clip into the next clip. */
  transition?: XfadeTransition;
  /** Transition duration in seconds (default 0.7s). */
  transitionDuration?: number;
}

export interface ProEditArgs {
  project?: string;
  clips: ProEditClip[];
  outputName?: string;
  outputPath?: string;
  defaultTransition?: XfadeTransition;
  defaultTransitionDuration?: number;
  grade?: ColorGradePreset;
  subtitleAssPath?: string;
  ctaOverlay?: CtaOverlayOptions;
  startFade?: number;
  endFade?: number;
  musicPath?: string;
  musicVolume?: number;
  loudness?: number;
  fps?: number;
  size?: string;
}

interface ProbedClip {
  width: number;
  height: number;
  duration: number;
  hasAudio: boolean;
}

const GRADE_FILTERS: Record<ColorGradePreset, string> = {
  none: "",
  "warm-cinema": "eq=contrast=1.04:saturation=1.08:brightness=0.01,vignette=PI/6",
  "golden-dream": "eq=contrast=1.03:saturation=1.12:gamma_r=1.03:gamma_b=0.97,vignette=PI/7",
  "pastel-soft": "eq=contrast=0.98:saturation=1.05:brightness=0.02,vignette=PI/8",
  "canyon-fresh": "eq=contrast=1.05:saturation=1.10:brightness=0.01,vignette=PI/7",
};

async function probeClip(file: string): Promise<ProbedClip> {
  if (!existsSync(file)) throw new Error(`Clip not found: ${file}`);
  const { stdout } = await run(FFPROBE, [
    "-v",
    "error",
    "-show_entries",
    "stream=codec_type,width,height:format=duration",
    "-of",
    "json",
    file,
  ]);
  const data = JSON.parse(stdout) as {
    streams?: { codec_type?: string; width?: number; height?: number }[];
    format?: { duration?: string };
  };
  const v = data.streams?.find((s) => s.codec_type === "video");
  const a = data.streams?.find((s) => s.codec_type === "audio");
  const duration = Number(data.format?.duration ?? 0);
  if (!v?.width || !v?.height || !duration) throw new Error(`Invalid video file: ${file}`);
  return { width: v.width, height: v.height, duration, hasAudio: Boolean(a) };
}

/**
 * Edits and joins clips with smooth xfade video transitions, acrossfade audio,
 * rhythmic trims, color grading, opening/closing fades, and loudness normalization.
 */
export async function proEditVideo(args: ProEditArgs): Promise<{
  outputPath: string;
  duration: number;
  width: number;
  height: number;
  clipCount: number;
  transitionsUsed: { afterClip: number; transition: XfadeTransition; duration: number; offset: number }[];
}> {
  if (!args.clips.length) throw new Error("At least 1 clip is required.");

  const probed = await Promise.all(args.clips.map((c) => probeClip(c.path)));
  const fps = args.fps ?? 30;
  let width = probed[0].width;
  let height = probed[0].height;
  if (args.size) {
    const m = args.size.match(/^(\d+)x(\d+)$/);
    if (m) {
      width = Number(m[1]);
      height = Number(m[2]);
    }
  }

  const outDir = join(OUTPUT_ROOT, args.project ?? "pro-edit");
  mkdirSync(outDir, { recursive: true });
  const outputPath = args.outputPath ?? join(outDir, `${args.outputName ?? "final_pro"}.mp4`);

  const ffArgs: string[] = ["-y"];
  for (const c of args.clips) ffArgs.push("-i", c.path);

  let musicInputIdx = -1;
  if (args.musicPath) {
    if (!existsSync(args.musicPath)) throw new Error(`Music file not found: ${args.musicPath}`);
    ffArgs.push("-stream_loop", "-1", "-i", args.musicPath);
    musicInputIdx = args.clips.length;
  }

  let ctaRender: { movPath: string; duration: number; cleanup: () => void } | undefined;
  let ctaInputIdx = -1;
  if (args.ctaOverlay) {
    ctaRender = await renderCtaOverlayVideo({ width, height, fps, ffmpegPath: FFMPEG, options: args.ctaOverlay });
    ffArgs.push("-i", ctaRender.movPath);
    ctaInputIdx = args.clips.length + (musicInputIdx >= 0 ? 1 : 0);
  }

  const filters: string[] = [];
  const keptDurations: number[] = [];

  for (let i = 0; i < args.clips.length; i++) {
    const c = args.clips[i];
    const info = probed[i];
    const from = Math.max(0, c.from ?? 0);
    const to = Math.min(info.duration, c.to ?? info.duration);
    const tailPad = Math.max(0, c.tailPad ?? 0);
    const dur = Math.max(0.5, to - from + tailPad);
    keptDurations.push(dur);

    const vPad = tailPad > 0 ? `,tpad=stop_duration=${tailPad.toFixed(3)}:stop_mode=clone` : "";
    filters.push(
      `[${i}:v]trim=start=${from.toFixed(3)}:end=${to.toFixed(3)},setpts=PTS-STARTPTS${vPad},` +
        `fps=${fps},scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,format=yuv420p,setsar=1[v${i}]`,
    );

    const vol = c.volume ?? 1;
    const aPad = tailPad > 0 ? `,apad=pad_dur=${tailPad.toFixed(3)}` : "";
    if (info.hasAudio) {
      filters.push(
        `[${i}:a]atrim=start=${from.toFixed(3)}:end=${to.toFixed(3)},asetpts=PTS-STARTPTS,` +
          `aresample=48000,aformat=channel_layouts=stereo,volume=${vol.toFixed(2)}${aPad}[a${i}]`,
      );
    } else {
      filters.push(`anullsrc=r=48000:cl=stereo:d=${dur.toFixed(3)}[a${i}]`);
    }
  }

  let curV = "[v0]";
  let curA = "[a0]";
  let accDur = keptDurations[0];
  const transitionsUsed: { afterClip: number; transition: XfadeTransition; duration: number; offset: number }[] = [];

  for (let i = 1; i < args.clips.length; i++) {
    const prevClip = args.clips[i - 1];
    const transition: XfadeTransition = prevClip.transition ?? args.defaultTransition ?? "dissolve";
    const reqDur = prevClip.transitionDuration ?? args.defaultTransitionDuration ?? 0.7;
    const tDur = Math.max(0.15, Math.min(reqDur, keptDurations[i - 1] * 0.4, keptDurations[i] * 0.4));
    const offset = Math.max(0.1, accDur - tDur);

    const nextV = `[vx${i}]`;
    const nextA = `[ax${i}]`;
    filters.push(`${curV}[v${i}]xfade=transition=${transition}:duration=${tDur.toFixed(3)}:offset=${offset.toFixed(3)}${nextV}`);
    filters.push(`${curA}[a${i}]acrossfade=d=${tDur.toFixed(3)}:c1=tri:c2=tri${nextA}`);

    transitionsUsed.push({ afterClip: i, transition, duration: Number(tDur.toFixed(2)), offset: Number(offset.toFixed(2)) });
    curV = nextV;
    curA = nextA;
    accDur = accDur + keptDurations[i] - tDur;
  }

  // Video post-chain: color grade -> optional gradual blur/darken CTA background -> optional ASS subtitles -> CTA overlay -> fades
  const grade = GRADE_FILTERS[args.grade ?? "warm-cinema"];
  let gradedV = "[vgraded]";
  if (grade) {
    filters.push(`${curV}${grade}${gradedV}`);
  } else {
    gradedV = curV;
  }

  const ctaDur = ctaRender?.duration ?? 0;
  const ctaRamp = ctaRender ? Math.min(0.9, Math.max(0.4, ctaDur * 0.28)) : 0;
  const totalDur = ctaRender ? accDur + ctaDur : accDur;
  const startFade = Math.max(0, args.startFade ?? 0.7);
  const endFade = Math.max(0, args.endFade ?? 1.2);

  let baseV = gradedV;
  if (ctaRender && ctaInputIdx >= 0) {
    const rampStart = Math.max(0, accDur - ctaRamp);
    const darkenStart = accDur + 0.35;
    const darkenDur = Math.max(0.8, totalDur - darkenStart);

    // Time-aligned gradual blur & subtle dim so background never stops or ghosts abruptly
    filters.push(`${gradedV}tpad=stop_duration=${ctaDur.toFixed(3)}:stop_mode=clone,split=2[vsharp][vblur_src]`);
    filters.push(
      `[vblur_src]format=yuva420p,boxblur=luma_radius=10:luma_power=1,eq=brightness=-0.07,` +
        `fade=t=in:st=${rampStart.toFixed(3)}:d=${ctaRamp.toFixed(3)}:alpha=1[vblur_ramp]`,
    );
    filters.push(
      `[vsharp][vblur_ramp]overlay=0:0,fade=t=out:st=${darkenStart.toFixed(3)}:d=${darkenDur.toFixed(3)},` +
        `format=yuv420p,setsar=1[vhold]`,
    );
    baseV = "[vhold]";
  }

  // Burn ASS subtitles after background blur ramp (keeps captions sharp and out of CTA hold)
  if (args.subtitleAssPath) {
    if (!existsSync(args.subtitleAssPath)) throw new Error(`Subtitle file not found: ${args.subtitleAssPath}`);
    const escaped = args.subtitleAssPath.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
    filters.push(`${baseV}ass='${escaped}'[vsubbed]`);
    baseV = "[vsubbed]";
  }

  if (ctaRender && ctaInputIdx >= 0) {
    filters.push(`[${ctaInputIdx}:v]setpts=PTS-STARTPTS+${accDur.toFixed(3)}/TB[vcta]`);
    filters.push(`${baseV}[vcta]overlay=0:0:eof_action=pass[vwithcta]`);
    baseV = "[vwithcta]";
  }

  const vFades: string[] = [];
  if (startFade > 0) vFades.push(`fade=t=in:st=0:d=${startFade.toFixed(3)}`);
  if (!ctaRender && endFade > 0 && totalDur > endFade + 0.3) {
    vFades.push(`fade=t=out:st=${(totalDur - endFade).toFixed(3)}:d=${endFade.toFixed(3)}`);
  }

  const finalV = "[vfinal]";
  if (vFades.length) {
    filters.push(`${baseV}${vFades.join(",")}${finalV}`);
  } else {
    filters.push(`${baseV}null${finalV}`);
  }

  // Audio post-chain: pad for CTA hold + fades + optional music bed + EBU R128 loudness
  let paddedAudio = curA;
  if (ctaDur > 0) {
    filters.push(`${curA}apad=pad_dur=${ctaDur.toFixed(3)},atrim=0:${totalDur.toFixed(3)}[apadded]`);
    paddedAudio = "[apadded]";
  }

  const aFades: string[] = [];
  if (startFade > 0) aFades.push(`afade=t=in:st=0:d=${startFade.toFixed(3)}`);
  if (endFade > 0 && totalDur > endFade + 0.3) {
    aFades.push(`afade=t=out:st=${(totalDur - endFade).toFixed(3)}:d=${endFade.toFixed(3)}`);
  }

  let audioBed = paddedAudio;
  if (aFades.length) {
    filters.push(`${paddedAudio}${aFades.join(",")}[afaded]`);
    audioBed = "[afaded]";
  }

  const targetLufs = Math.min(-9, Math.max(-30, args.loudness ?? -14));
  if (musicInputIdx >= 0) {
    const mVol = Math.max(0, Math.min(1.5, args.musicVolume ?? 0.22));
    filters.push(
      `[${musicInputIdx}:a]atrim=0:${totalDur.toFixed(3)},asetpts=PTS-STARTPTS,` +
        `aresample=48000,aformat=channel_layouts=stereo,volume=${mVol.toFixed(2)},` +
        `afade=t=in:st=0:d=${Math.max(0.5, startFade).toFixed(3)},` +
        `afade=t=out:st=${Math.max(0, totalDur - Math.max(0.8, endFade)).toFixed(3)}:d=${Math.max(0.8, endFade).toFixed(3)}[music]`,
    );
    filters.push(`${audioBed}[music]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,loudnorm=I=${targetLufs}:TP=-1.5:LRA=11[afinal]`);
  } else {
    filters.push(`${audioBed}loudnorm=I=${targetLufs}:TP=-1.5:LRA=11[afinal]`);
  }

  ffArgs.push(
    "-filter_complex",
    filters.join(";"),
    "-map",
    finalV,
    "-map",
    "[afinal]",
    "-c:v",
    "libx264",
    "-crf",
    "18",
    "-preset",
    "medium",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    outputPath,
  );

  try {
    await run(FFMPEG, ffArgs, { maxBuffer: 64 * 1024 * 1024 });
  } finally {
    ctaRender?.cleanup();
  }

  return {
    outputPath,
    duration: Number(totalDur.toFixed(2)),
    width,
    height,
    clipCount: args.clips.length,
    transitionsUsed,
  };
}
