import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  deleteAvatar,
  deleteLocation,
  listAvatars,
  listLocations,
  listStyles,
  saveAvatar,
  saveLocation,
  saveStyle,
} from "./library.js";
import { composePrompt, planStoryboard } from "./prompt_composer.js";
import {
  addCatalogOption,
  deleteSelectorOverride,
  discoverFlowOptions,
  inspectFlowPage,
  listSelectors,
  loadCatalog,
  runCustomAction,
  saveCustomAction,
  saveSelectorOverride,
  testSelector,
} from "./selector_registry.js";
import { exportVerticalVideo, previewVerticalFrame } from "./vertical_export.js";

const AVATAR_ANGLE = z.enum(["front", "threeQuarter", "profile", "closeup", "fullBody"]);

export const customShapes = {
  flow_location_create: {
    id: z.string().optional().describe("Optional slug ID; auto-generated from name if omitted."),
    name: z.string().min(1),
    description: z.string().min(1).describe("Visual environment & architectural description."),
    lighting: z.string().optional(),
    timeOfDay: z.string().optional(),
    weather: z.string().optional(),
    colorPalette: z.string().optional(),
    cameraLens: z.string().optional(),
    ambientAudio: z.string().optional(),
    negativeNotes: z.string().optional(),
    referenceImages: z.array(z.string()).max(3).default([]).describe("Up to 3 local paths or 'asset:<title>' references."),
  },
  flow_locations: {},
  flow_location_delete: { id: z.string().min(1) },

  flow_avatar_create: {
    id: z.string().optional(),
    name: z.string().min(1),
    subjectDescription: z.string().min(1).describe("Fixed face, hair, age, and build description."),
    outfitLock: z.string().optional(),
    voiceNotes: z.string().optional(),
    angles: z
      .object({
        front: z.string().optional(),
        threeQuarter: z.string().optional(),
        profile: z.string().optional(),
        closeup: z.string().optional(),
        fullBody: z.string().optional(),
      })
      .default({}),
    defaultAngles: z.array(AVATAR_ANGLE).max(3).optional(),
    negativeNotes: z.string().optional(),
  },
  flow_avatars: {},
  flow_avatar_delete: { id: z.string().min(1) },

  flow_style_save: {
    id: z.string().optional(),
    name: z.string().min(1),
    visualStyle: z.string().min(1),
    filmOrRender: z.string().optional(),
    colorGrading: z.string().optional(),
    negativeNotes: z.string().optional(),
  },
  flow_styles: {},

  flow_prompt_compose: {
    type: z.enum(["video", "image"]).default("video"),
    subject: z.string().optional(),
    avatarId: z.string().optional(),
    avatarAngles: z.array(AVATAR_ANGLE).max(3).optional(),
    characterDescriptions: z.array(z.string()).optional(),
    locationId: z.string().optional(),
    styleId: z.string().optional(),
    techniqueId: z.string().optional(),
    cameraMove: z.string().optional(),
    shotSize: z.string().optional(),
    action: z.string().optional(),
    beats: z
      .array(
        z.object({
          startSec: z.number().min(0),
          endSec: z.number().positive(),
          action: z.string().min(1),
          dialogue: z.string().optional(),
          speaker: z.string().optional(),
        }),
      )
      .optional(),
    ambientAudio: z.string().optional(),
    aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:3", "3:4"]).optional(),
    durationSeconds: z.number().int().min(4).max(10).optional(),
    model: z.string().optional(),
    continuityMode: z.enum(["standalone", "chain_previous", "first_last_frame", "ingredients"]).optional(),
    extraReferenceImages: z.array(z.string()).optional(),
    extraInstructions: z.string().optional(),
  },

  flow_storyboard_plan: {
    projectName: z.string().optional(),
    aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:3", "3:4"]).optional(),
    defaultModel: z.string().optional(),
    scenes: z
      .array(
        z.object({
          title: z.string().optional(),
          type: z.enum(["video", "image"]).default("video"),
          subject: z.string().optional(),
          avatarId: z.string().optional(),
          avatarAngles: z.array(AVATAR_ANGLE).max(3).optional(),
          characterDescriptions: z.array(z.string()).optional(),
          locationId: z.string().optional(),
          styleId: z.string().optional(),
          techniqueId: z.string().optional(),
          cameraMove: z.string().optional(),
          shotSize: z.string().optional(),
          action: z.string().optional(),
          ambientAudio: z.string().optional(),
          durationSeconds: z.number().int().min(4).max(10).optional(),
          continuityMode: z.enum(["standalone", "chain_previous", "first_last_frame", "ingredients"]).optional(),
          extraReferenceImages: z.array(z.string()).optional(),
        }),
      )
      .min(1),
  },

  flow_inspect: {
    query: z.string().optional().describe("Filter interactive elements by text, aria-label, role, or selector."),
    limit: z.number().int().min(10).max(400).optional(),
    includeHidden: z.boolean().optional(),
  },
  flow_discover_options: {},
  flow_catalog_add: {
    category: z.enum(["models", "aspectRatios", "durations", "resolutions"]),
    value: z.string().min(1),
  },
  flow_selectors: {},
  flow_selector_save: {
    slot: z.string().min(1),
    selector: z.string().min(1),
    fallbacks: z.array(z.string()).optional(),
    note: z.string().optional(),
  },
  flow_selector_delete: { slot: z.string().min(1) },
  flow_selector_test: { slotOrSelector: z.string().min(1) },
  flow_ui_action_save: {
    name: z.string().min(1),
    description: z.string().default(""),
    steps: z
      .array(
        z.object({
          action: z.enum(["click", "fill", "press", "wait", "waitForSelector"]),
          selector: z.string().optional(),
          value: z.string().optional(),
          ms: z.number().int().positive().optional(),
        }),
      )
      .min(1),
  },
  flow_ui_action_run: {
    name: z.string().min(1),
    vars: z.record(z.string(), z.string()).optional(),
  },

  flow_vertical_export: {
    inputPath: z.string().min(1),
    mode: z.enum(["blur-fill", "center-crop"]).default("blur-fill"),
    panX: z.number().min(-1).max(1).optional(),
    blurStrength: z.number().int().min(5).max(60).optional(),
    previewOnly: z.boolean().optional(),
    safeZoneGuides: z.boolean().optional(),
    timestampSec: z.number().min(0).optional(),
    outputPath: z.string().optional(),
  },
} as const;

type CustomMethod = keyof typeof customShapes;

const handlers: Record<CustomMethod, (args: any) => Promise<unknown>> = {
  flow_location_create: async (a) => saveLocation(a),
  flow_locations: async () => ({ locations: listLocations() }),
  flow_location_delete: async (a) => deleteLocation(a.id),

  flow_avatar_create: async (a) => saveAvatar(a),
  flow_avatars: async () => ({ avatars: listAvatars() }),
  flow_avatar_delete: async (a) => deleteAvatar(a.id),

  flow_style_save: async (a) => saveStyle(a),
  flow_styles: async () => ({ styles: listStyles() }),

  flow_prompt_compose: async (a) => composePrompt(a),
  flow_storyboard_plan: async (a) => planStoryboard(a),

  flow_inspect: async (a) => inspectFlowPage(a),
  flow_discover_options: async () => discoverFlowOptions(),
  flow_catalog_add: async (a) => addCatalogOption(a),
  flow_selectors: async () => ({ ...listSelectors(), catalog: loadCatalog() }),
  flow_selector_save: async (a) => saveSelectorOverride(a),
  flow_selector_delete: async (a) => deleteSelectorOverride(a.slot),
  flow_selector_test: async (a) => testSelector(a.slotOrSelector),
  flow_ui_action_save: async (a) => saveCustomAction(a),
  flow_ui_action_run: async (a) => runCustomAction(a.name, a.vars ?? {}),

  flow_vertical_export: async (a) => (a.previewOnly ? previewVerticalFrame(a) : exportVerticalVideo(a)),
};

const TOOL_META: Record<CustomMethod, { title: string; description: string; readOnly?: boolean }> = {
  flow_location_create: { title: "Create or update a reusable location", description: "Save a persistent location/environment card with lighting, lens, ambient audio, and up to 3 reference images." },
  flow_locations: { title: "List saved locations", description: "List all reusable locations in the local library.", readOnly: true },
  flow_location_delete: { title: "Delete a saved location", description: "Remove a location card from the local library." },
  flow_avatar_create: { title: "Create or update a multi-angle avatar", description: "Save a reusable avatar packet with front, threeQuarter, profile, closeup, and fullBody references." },
  flow_avatars: { title: "List saved avatars", description: "List all multi-angle avatar packets in the local library.", readOnly: true },
  flow_avatar_delete: { title: "Delete a saved avatar", description: "Remove an avatar packet from the local library." },
  flow_style_save: { title: "Create or update a visual style", description: "Save a reusable visual style preset (film stock, color grading, negative notes)." },
  flow_styles: { title: "List saved styles", description: "List all visual style presets in the local library.", readOnly: true },
  flow_prompt_compose: { title: "Compose Flow/Veo prompt (0 credits)", description: "Compile an optimized English prompt and <=3 reference_images from saved avatars, locations, styles, and techniques." , readOnly: true },
  flow_storyboard_plan: { title: "Plan multi-scene storyboard (0 credits)", description: "Build a multi-shot storyboard with continuity flags and estimated credit budget.", readOnly: true },
  flow_inspect: { title: "Inspect live Flow UI", description: "Capture a screenshot of the open Flow tab and list interactive DOM elements with selectors and coordinates.", readOnly: true },
  flow_discover_options: { title: "Discover live Flow options", description: "Read available models, aspect ratios, durations, and resolutions from the live Flow UI.", readOnly: true },
  flow_catalog_add: { title: "Add custom model or option", description: "Manually register a new Flow model, aspect ratio, duration, or resolution in catalog.json." },
  flow_selectors: { title: "List UI selector slots and custom actions", description: "List all built-in/overridden selector slots, custom UI actions, and option catalog.", readOnly: true },
  flow_selector_save: { title: "Save a UI selector override", description: "Override a Flow UI selector slot or add a new custom slot without rebuilding code." },
  flow_selector_delete: { title: "Delete a UI selector override", description: "Revert a selector slot back to its built-in default." },
  flow_selector_test: { title: "Test and highlight a UI selector", description: "Verify a selector slot or CSS/Playwright selector on the live Flow tab without spending credits.", readOnly: true },
  flow_ui_action_save: { title: "Save a custom UI action macro", description: "Record a reusable sequence of UI clicks/fills/waits for new Flow features." },
  flow_ui_action_run: { title: "Run a custom UI action macro", description: "Execute a saved custom UI macro on the live Flow page." },
  flow_vertical_export: { title: "Export or preview 9:16 vertical video", description: "Convert a 16:9 video to 9:16 (blur-fill or center-crop) or render a safe-zone preview frame with FFmpeg." },
};

type ReplyFn = (work: Promise<unknown>, extra?: object) => Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }>;

export function registerCustomTools(server: McpServer, reply: ReplyFn): void {
  for (const name of Object.keys(customShapes) as CustomMethod[]) {
    const meta = TOOL_META[name];
    server.registerTool(
      name,
      {
        title: meta.title,
        description: meta.description,
        inputSchema: customShapes[name],
        annotations: { readOnlyHint: Boolean(meta.readOnly), openWorldHint: !meta.readOnly },
      },
      (args: unknown) => reply(handlers[name](args)),
    );
  }
}

export async function dispatchCustomApi(method: string, rawBody: string): Promise<{ handled: boolean; result?: unknown }> {
  if (!(method in customShapes)) return { handled: false };
  const key = method as CustomMethod;
  const parsed = z.object(customShapes[key]).parse(JSON.parse(rawBody || "{}"));
  const result = await handlers[key](parsed);
  return { handled: true, result };
}
