import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Locator, Page } from "playwright-core";
import { HOME_DIR, getFlowPage } from "../chrome.js";

export interface SelectorEntry {
  slot: string;
  description: string;
  primary: string;
  fallbacks: string[];
  override?: string;
  updatedAt?: string;
}

export interface CustomActionStep {
  action: "click" | "fill" | "press" | "wait" | "waitForSelector";
  selector?: string;
  value?: string;
  ms?: number;
}

export interface CustomUiAction {
  name: string;
  description: string;
  steps: CustomActionStep[];
  updatedAt: string;
}

export interface RegistryData {
  selectors: Record<string, { selector: string; fallbacks?: string[]; note?: string; updatedAt: string }>;
  actions: Record<string, CustomUiAction>;
}

export interface CatalogData {
  models: string[];
  aspectRatios: string[];
  durations: string[];
  resolutions: string[];
  updatedAt?: string;
}

export interface InspectedElement {
  index: number;
  tag: string;
  role: string | null;
  ariaLabel: string | null;
  text: string;
  testId: string | null;
  placeholder: string | null;
  cssSelector: string;
  rect: { x: number; y: number; w: number; h: number };
  visible: boolean;
}

const REGISTRY_FILE = join(HOME_DIR, "registry.json");
const CATALOG_FILE = join(HOME_DIR, "catalog.json");
export const INSPECTOR_DIR = join(HOME_DIR, "inspector");
export const INSPECTOR_SCREENSHOT = join(INSPECTOR_DIR, "latest.png");

const BUILTIN_SLOTS: Omit<SelectorEntry, "override" | "updatedAt">[] = [
  {
    slot: "prompt_input",
    description: "Main prompt text box in Flow composer",
    primary: 'textarea, [contenteditable="true"][role="textbox"]',
    fallbacks: ['[role="textbox"]', '[data-testid*="prompt"]'],
  },
  {
    slot: "generate_button",
    description: "Submit / Create generation button",
    primary: 'button[aria-label*="Create"], button[aria-label*="Generate"], button:has-text("Create"), button:has-text("Generate")',
    fallbacks: ['button[type="submit"]'],
  },
  {
    slot: "settings_button",
    description: "Composer settings / model & aspect ratio trigger",
    primary: 'button[aria-label*="Settings"], button[aria-haspopup="menu"]',
    fallbacks: ['button:has-text("Veo")', 'button:has-text("Nano")'],
  },
  {
    slot: "model_dropdown",
    description: "Model selector dropdown",
    primary: 'button[aria-label*="model" i], [role="combobox"][aria-label*="model" i]',
    fallbacks: ['flow-agent-panel button:has-text("model")'],
  },
  {
    slot: "add_ingredient",
    description: "Add reference image / ingredient (+) button",
    primary: 'button[aria-label*="Add" i], button[aria-label*="ingredient" i], button[aria-label*="reference" i]',
    fallbacks: ['button:has-text("+")'],
  },
  {
    slot: "account_button",
    description: "Account details panel trigger",
    primary: 'button[aria-label="Account details"]',
    fallbacks: ['button[aria-label*="Account" i]'],
  },
  {
    slot: "download_button",
    description: "Download media trigger",
    primary: 'button[aria-label*="Download" i], [role="menuitem"]:has-text("Download")',
    fallbacks: ['a[download]'],
  },
  {
    slot: "new_project_button",
    description: "Create new Flow project button",
    primary: 'button:has-text("New project"), a:has-text("New project")',
    fallbacks: ['button[aria-label*="New project" i]'],
  },
];

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!existsSync(file)) return fallback;
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown): void {
  mkdirSync(HOME_DIR, { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

export function loadRegistry(): RegistryData {
  return readJson<RegistryData>(REGISTRY_FILE, { selectors: {}, actions: {} });
}

export function loadCatalog(): CatalogData {
  return readJson<CatalogData>(CATALOG_FILE, {
    models: ["Veo 3.1 - Lite", "Veo 3.1 - Fast", "Veo 3.1 - Quality", "Omni 1.1 Flash", "Nano Banana"],
    aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    durations: ["4s", "6s", "8s", "10s"],
    resolutions: ["360p", "720p", "1080p", "2K"],
  });
}

/**
 * Returns all built-in selector slots merged with user overrides and custom slots.
 */
export function listSelectors(): { slots: SelectorEntry[]; actions: CustomUiAction[] } {
  const reg = loadRegistry();
  const seen = new Set<string>();
  const slots: SelectorEntry[] = BUILTIN_SLOTS.map((b) => {
    seen.add(b.slot);
    const ov = reg.selectors[b.slot];
    return {
      ...b,
      override: ov?.selector,
      fallbacks: ov?.fallbacks?.length ? [...ov.fallbacks, ...b.fallbacks] : b.fallbacks,
      updatedAt: ov?.updatedAt,
    };
  });
  for (const [slot, ov] of Object.entries(reg.selectors)) {
    if (seen.has(slot)) continue;
    slots.push({
      slot,
      description: ov.note ?? "Custom user-defined selector slot",
      primary: ov.selector,
      fallbacks: ov.fallbacks ?? [],
      override: ov.selector,
      updatedAt: ov.updatedAt,
    });
  }
  return { slots, actions: Object.values(reg.actions) };
}

/**
 * Saves or updates a selector override for a built-in or custom slot without rebuilding code.
 */
export function saveSelectorOverride(args: { slot: string; selector: string; fallbacks?: string[]; note?: string }): SelectorEntry {
  const reg = loadRegistry();
  const updatedAt = new Date().toISOString();
  reg.selectors[args.slot] = {
    selector: args.selector,
    fallbacks: args.fallbacks,
    note: args.note,
    updatedAt,
  };
  writeJson(REGISTRY_FILE, reg);
  return listSelectors().slots.find((s) => s.slot === args.slot)!;
}

export function deleteSelectorOverride(slot: string): { deleted: boolean; slot: string } {
  const reg = loadRegistry();
  const existed = Boolean(reg.selectors[slot]);
  delete reg.selectors[slot];
  writeJson(REGISTRY_FILE, reg);
  return { deleted: existed, slot };
}

/**
 * Resolves a slot name or raw Playwright selector using override -> primary -> fallbacks.
 */
export async function resolveSlotLocator(page: Page, slotOrSelector: string): Promise<{ locator: Locator; matchedBy: string }> {
  const entry = listSelectors().slots.find((s) => s.slot === slotOrSelector);
  const candidates = entry
    ? [entry.override, entry.primary, ...entry.fallbacks].filter((x): x is string => Boolean(x))
    : [slotOrSelector];

  for (const sel of candidates) {
    const loc = page.locator(sel);
    const count = await loc.count().catch(() => 0);
    if (count > 0) return { locator: loc.first(), matchedBy: sel };
  }
  return { locator: page.locator(candidates[0]), matchedBy: candidates[0] };
}

/**
 * Captures a screenshot of the live Flow page and lists interactive DOM elements for discovery.
 */
export async function inspectFlowPage(opts: { query?: string; limit?: number; includeHidden?: boolean } = {}): Promise<{
  url: string;
  title: string;
  screenshotPath: string;
  totalScanned: number;
  elements: InspectedElement[];
}> {
  const page = await getFlowPage();
  mkdirSync(INSPECTOR_DIR, { recursive: true });
  await page.screenshot({ path: INSPECTOR_SCREENSHOT, fullPage: false });

  const limit = Math.min(Math.max(opts.limit ?? 120, 10), 400);
  const query = (opts.query ?? "").trim().toLowerCase();
  const includeHidden = Boolean(opts.includeHidden);

  const raw = await page.evaluate((includeAll: boolean) => {
    const selector = [
      "button",
      "[role='button']",
      "[role='menuitem']",
      "[role='option']",
      "[role='tab']",
      "[role='combobox']",
      "input",
      "textarea",
      "select",
      "a[href]",
      "[contenteditable='true']",
    ].join(",");

    const nodes = Array.from(document.querySelectorAll(selector));
    const cssEscape = (s: string) => s.replace(/([^\w-])/g, "\\$1");

    const buildCss = (el: Element): string => {
      const testId = el.getAttribute("data-testid");
      if (testId) return `[data-testid="${testId.replace(/"/g, '\\"')}"]`;
      const aria = el.getAttribute("aria-label");
      const tag = el.tagName.toLowerCase();
      if (aria) return `${tag}[aria-label="${aria.replace(/"/g, '\\"')}"]`;
      if (el.id) return `#${cssEscape(el.id)}`;
      const role = el.getAttribute("role");
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      if (role && text && text.length <= 40) return `[role="${role}"]:has-text("${text.replace(/"/g, '\\"')}")`;
      if (tag === "button" && text && text.length <= 40) return `button:has-text("${text.replace(/"/g, '\\"')}")`;
      const cls = Array.from(el.classList).filter((c) => !c.startsWith("ng-") && !c.startsWith("cdk-")).slice(0, 2);
      return cls.length ? `${tag}.${cls.map(cssEscape).join(".")}` : tag;
    };

    const items: Omit<InspectedElement, "index">[] = [];
    for (const el of nodes) {
      const r = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const visible = r.width > 0 && r.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      if (!includeAll && !visible) continue;
      items.push({
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute("role"),
        ariaLabel: el.getAttribute("aria-label"),
        text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
        testId: el.getAttribute("data-testid"),
        placeholder: el.getAttribute("placeholder"),
        cssSelector: buildCss(el),
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        visible,
      });
    }
    return items;
  }, includeHidden);

  const filtered = query
    ? raw.filter((el) =>
        [el.tag, el.role ?? "", el.ariaLabel ?? "", el.text, el.testId ?? "", el.placeholder ?? "", el.cssSelector]
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
    : raw;

  return {
    url: page.url(),
    title: await page.title(),
    screenshotPath: INSPECTOR_SCREENSHOT,
    totalScanned: raw.length,
    elements: filtered.slice(0, limit).map((el, index) => ({ index, ...el })),
  };
}

/**
 * Tests a slot or selector non-destructively on the live Flow page and briefly highlights it.
 */
export async function testSelector(slotOrSelector: string): Promise<{
  ok: boolean;
  slotOrSelector: string;
  matchedBy: string;
  count: number;
  sample?: { tag: string; text: string; ariaLabel: string | null; visible: boolean };
}> {
  const page = await getFlowPage();
  const { locator, matchedBy } = await resolveSlotLocator(page, slotOrSelector);
  const count = await locator.page().locator(matchedBy).count().catch(() => 0);
  if (count === 0) {
    return { ok: false, slotOrSelector, matchedBy, count: 0 };
  }
  const sample = await locator
    .evaluate((el) => {
      const prev = (el as HTMLElement).style.outline;
      (el as HTMLElement).style.outline = "3px solid #ff3b30";
      setTimeout(() => {
        (el as HTMLElement).style.outline = prev;
      }, 2500);
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
        ariaLabel: el.getAttribute("aria-label"),
        visible: r.width > 0 && r.height > 0,
      };
    })
    .catch(() => undefined);
  return { ok: true, slotOrSelector, matchedBy, count, sample };
}

/**
 * Discovers live UI options (models, aspect ratios, durations) and merges user catalog additions.
 */
export async function discoverFlowOptions(): Promise<CatalogData & { liveTexts: string[] }> {
  const page = await getFlowPage();
  const liveTexts = await page
    .evaluate(() => {
      const els = Array.from(document.querySelectorAll("button, [role='option'], [role='menuitem'], [role='combobox']"));
      return Array.from(
        new Set(
          els
            .map((e) => (e.textContent ?? "").replace(/\s+/g, " ").trim())
            .filter((t) => t.length > 0 && t.length <= 60),
        ),
      );
    })
    .catch(() => [] as string[]);

  const catalog = loadCatalog();
  const mergeUnique = (base: string[], regex: RegExp) =>
    Array.from(new Set([...base, ...liveTexts.filter((t) => regex.test(t))]));

  const updated: CatalogData = {
    models: mergeUnique(catalog.models, /\b(veo|omni|nano|imagen)\b/i),
    aspectRatios: mergeUnique(catalog.aspectRatios, /^\d+:\d+$/),
    durations: mergeUnique(catalog.durations, /^\d+\s*s$/i),
    resolutions: mergeUnique(catalog.resolutions, /^(360p|480p|720p|1080p|2k|4k)$/i),
    updatedAt: new Date().toISOString(),
  };
  writeJson(CATALOG_FILE, updated);
  return { ...updated, liveTexts: liveTexts.slice(0, 80) };
}

export function addCatalogOption(args: { category: keyof Omit<CatalogData, "updatedAt">; value: string }): CatalogData {
  const catalog = loadCatalog();
  if (!catalog[args.category].includes(args.value)) {
    catalog[args.category].push(args.value);
  }
  catalog.updatedAt = new Date().toISOString();
  writeJson(CATALOG_FILE, catalog);
  return catalog;
}

export function saveCustomAction(args: { name: string; description: string; steps: CustomActionStep[] }): CustomUiAction {
  const reg = loadRegistry();
  const action: CustomUiAction = { ...args, updatedAt: new Date().toISOString() };
  reg.actions[args.name] = action;
  writeJson(REGISTRY_FILE, reg);
  return action;
}

/**
 * Runs a user-defined UI action sequence on the live Flow tab.
 */
export async function runCustomAction(name: string, vars: Record<string, string> = {}): Promise<{ ok: boolean; name: string; stepsRun: number }> {
  const reg = loadRegistry();
  const action = reg.actions[name];
  if (!action) throw new Error(`Custom UI action "${name}" not found in registry.`);
  const page = await getFlowPage();
  const sub = (s = "") => s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");

  let stepsRun = 0;
  for (const step of action.steps) {
    if (step.action === "wait") {
      await page.waitForTimeout(step.ms ?? 500);
    } else if (step.action === "press") {
      await page.keyboard.press(step.value ?? "Escape");
    } else if (step.selector) {
      const { locator } = await resolveSlotLocator(page, sub(step.selector));
      if (step.action === "waitForSelector") await locator.waitFor({ state: "visible", timeout: step.ms ?? 10_000 });
      else if (step.action === "click") await locator.click({ timeout: 10_000 });
      else if (step.action === "fill") await locator.fill(sub(step.value), { timeout: 10_000 });
    }
    stepsRun++;
  }
  return { ok: true, name, stepsRun };
}
