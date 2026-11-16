import { TECHNIQUES } from "../techniques.js";
import { getAvatar, getLocation, getStyle, resolveAvatarRefs, type AvatarAngle } from "./library.js";

export interface PromptBeat {
  startSec: number;
  endSec: number;
  action: string;
  dialogue?: string;
  speaker?: string;
}

export interface ComposePromptInput {
  type?: "video" | "image";
  subject?: string;
  avatarId?: string;
  avatarAngles?: AvatarAngle[];
  characterDescriptions?: string[];
  locationId?: string;
  styleId?: string;
  techniqueId?: string;
  cameraMove?: string;
  shotSize?: string;
  action?: string;
  beats?: PromptBeat[];
  ambientAudio?: string;
  aspectRatio?: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  durationSeconds?: number;
  model?: string;
  continuityMode?: "standalone" | "chain_previous" | "first_last_frame" | "ingredients";
  extraReferenceImages?: string[];
  extraInstructions?: string;
}

export interface ComposedPromptResult {
  prompt: string;
  reference_images: string[];
  warnings: string[];
  estimated_credits: number;
  ready_scene: {
    type: "video" | "image";
    prompt: string;
    aspect_ratio?: string;
    model?: string;
    duration?: number;
    chain_previous?: boolean;
    reference_images?: string[];
  };
}

const CREDIT_ESTIMATES: Record<string, number> = {
  "Nano Banana": 0,
  "Omni 1.1 Flash": 12,
  "Veo 3.1 - Lite": 10,
  "Veo 3.1 - Fast": 20,
  "Veo 3.1 - Quality": 100,
};

const RISKY_PATTERNS: [RegExp, string][] = [
  [/\b(turns? left|turns? right|u-turn)\b/i, "Vehicle/subject turns mid-tracking shot often morph in video models; prefer straight motion or a cut."],
  [/\b(confetti|hundreds of|crowd cheering|smashing)\b/i, "Many small flying particles or reacting crowds frequently cause visual artifacts."],
  [/\b(caught in mid-air|throws? .* to )\b/i, "Throwing/catching objects between hands often breaks hand continuity."],
];

/**
 * Compiles a structured, continuity-safe Flow/Veo prompt from reusable library assets.
 */
export function composePrompt(input: ComposePromptInput): ComposedPromptResult {
  const type = input.type ?? "video";
  const warnings: string[] = [];
  const parts: string[] = [];
  const rawRefs: string[] = [];
  const negativeNotes: string[] = [];

  const avatar = input.avatarId ? getAvatar(input.avatarId) : undefined;
  if (input.avatarId && !avatar) warnings.push(`Avatar "${input.avatarId}" not found in library.`);

  const location = input.locationId ? getLocation(input.locationId) : undefined;
  if (input.locationId && !location) warnings.push(`Location "${input.locationId}" not found in library.`);

  const style = input.styleId ? getStyle(input.styleId) : undefined;
  if (input.styleId && !style) warnings.push(`Style "${input.styleId}" not found in library.`);

  const technique = input.techniqueId ? TECHNIQUES.find((t) => t.id === input.techniqueId) : undefined;
  if (input.techniqueId && !technique) warnings.push(`Technique "${input.techniqueId}" not found.`);

  // 1. Subject / Avatar / Characters
  const subjectChunks: string[] = [];
  if (avatar) {
    subjectChunks.push(avatar.subjectDescription);
    if (avatar.outfitLock) subjectChunks.push(`wearing ${avatar.outfitLock}`);
    if (avatar.negativeNotes) negativeNotes.push(avatar.negativeNotes);
    rawRefs.push(...resolveAvatarRefs(avatar, input.avatarAngles, 3));
  }
  if (input.characterDescriptions?.length) {
    subjectChunks.push(...input.characterDescriptions);
  }
  if (input.subject) subjectChunks.push(input.subject);
  if (subjectChunks.length) parts.push(subjectChunks.join(", ") + ".");

  // 2. Action & Second-by-Second Timeline
  if (input.beats?.length) {
    const timeline = input.beats
      .map((b) => {
        const line = b.dialogue ? ` ${b.speaker ? `${b.speaker} says` : "says"} "${b.dialogue}"` : "";
        return `${b.startSec.toFixed(1)}-${b.endSec.toFixed(1)}s: ${b.action}${line}`;
      })
      .join("; ");
    parts.push(`Timeline (${timeline}).`);
  } else if (input.action) {
    parts.push(input.action.endsWith(".") ? input.action : `${input.action}.`);
  }

  // 3. Shot Size & Camera Technique (one camera instruction per scene)
  if (technique) {
    parts.push(technique.phrase);
    if (input.cameraMove) warnings.push("Both techniqueId and cameraMove provided; keep one camera instruction to avoid conflicting motion.");
  } else {
    const cam = [input.shotSize, input.cameraMove].filter(Boolean).join(", ");
    if (cam) parts.push(`Camera: ${cam}.`);
  }

  // 4. Location & Lighting DNA
  if (location) {
    const locBits = [
      `Location: ${location.description}`,
      location.timeOfDay ? `time: ${location.timeOfDay}` : undefined,
      location.weather ? `weather: ${location.weather}` : undefined,
      location.lighting ? `lighting: ${location.lighting}` : undefined,
      location.colorPalette ? `palette: ${location.colorPalette}` : undefined,
      location.cameraLens ? `lens: ${location.cameraLens}` : undefined,
    ].filter(Boolean);
    parts.push(locBits.join(", ") + ".");
    if (location.negativeNotes) negativeNotes.push(location.negativeNotes);
    rawRefs.push(...location.referenceImages);
  }

  // 5. Visual Style
  if (style) {
    const styleBits = [style.visualStyle, style.filmOrRender, style.colorGrading].filter(Boolean).join(", ");
    if (styleBits) parts.push(`Visual style: ${styleBits}.`);
    if (style.negativeNotes) negativeNotes.push(style.negativeNotes);
  }

  // 6. Native Audio
  if (type === "video") {
    const audio = input.ambientAudio ?? location?.ambientAudio;
    if (audio) parts.push(`Audio: ${audio}.`);
  }

  // 7. Extra instructions & negative guards
  if (input.extraInstructions) parts.push(input.extraInstructions);
  if (negativeNotes.length) parts.push(`Avoid: ${Array.from(new Set(negativeNotes)).join("; ")}.`);

  const prompt = parts.join(" ").replace(/\s+/g, " ").trim();

  for (const [re, msg] of RISKY_PATTERNS) {
    if (re.test(prompt)) warnings.push(msg);
  }

  if (input.extraReferenceImages?.length) rawRefs.push(...input.extraReferenceImages);
  const uniqueRefs = Array.from(new Set(rawRefs.filter(Boolean)));
  if (uniqueRefs.length > 3) {
    warnings.push(`Flow supports max 3 reference_images per call; trimmed from ${uniqueRefs.length} to 3.`);
  }
  const reference_images = uniqueRefs.slice(0, 3);

  const chainPrevious = input.continuityMode === "chain_previous";
  if (chainPrevious && reference_images.length > 0) {
    warnings.push("Flow's composer cannot use chain_previous and reference_images together; use flow_continue for frame+character lock or omit reference_images.");
  }

  const defaultModel = type === "image" ? "Nano Banana" : "Omni 1.1 Flash";
  const model = input.model ?? defaultModel;
  const estimated_credits = type === "image" ? 0 : (CREDIT_ESTIMATES[model] ?? 12);

  const ready_scene: ComposedPromptResult["ready_scene"] = {
    type,
    prompt,
    ...(input.aspectRatio ? { aspect_ratio: input.aspectRatio } : {}),
    ...(input.model ? { model: input.model } : {}),
    ...(type === "video" && input.durationSeconds ? { duration: input.durationSeconds } : {}),
    ...(chainPrevious ? { chain_previous: true } : {}),
    ...(!chainPrevious && reference_images.length ? { reference_images } : {}),
  };

  return { prompt, reference_images, warnings, estimated_credits, ready_scene };
}

export interface StoryboardSceneInput extends ComposePromptInput {
  title?: string;
}

/**
 * Plans a multi-scene storyboard, estimating total credits and building flow_generate-ready scenes.
 */
export function planStoryboard(input: {
  projectName?: string;
  aspectRatio?: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  defaultModel?: string;
  scenes: StoryboardSceneInput[];
}): {
  projectName: string;
  sceneCount: number;
  total_estimated_credits: number;
  warnings: string[];
  scenes: Array<ComposedPromptResult & { sceneNumber: number; title: string }>;
} {
  const warnings: string[] = [];
  let totalCredits = 0;

  const scenes = input.scenes.map((scene, idx) => {
    const composed = composePrompt({
      ...scene,
      aspectRatio: scene.aspectRatio ?? input.aspectRatio ?? "16:9",
      model: scene.model ?? input.defaultModel,
    });
    totalCredits += composed.estimated_credits;
    for (const w of composed.warnings) warnings.push(`Scene ${idx + 1}: ${w}`);
    return {
      sceneNumber: idx + 1,
      title: scene.title ?? `Scene ${idx + 1}`,
      ...composed,
    };
  });

  return {
    projectName: input.projectName ?? "storyboard",
    sceneCount: scenes.length,
    total_estimated_credits: totalCredits,
    warnings,
    scenes,
  };
}
