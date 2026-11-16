import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright-core";

export const FLOW_URL = "https://flow.google.com/";
// Flow's buttons are found by their English names ("Start generation", "Download"...), so Flow has to show in English
// whatever language the Google account uses. `hl=en` on the address does that: `hl=es` turned every label Spanish on
// an English account (2026-10-13), the choice holds through Flow's in-app navigation, and the browser's own language
// changes nothing. It only lasts until the next full page load, so every load adds it and ensureEnglish re-checks.
export const inEnglish = (url: string): string => {
  const u = new URL(url);
  u.searchParams.set("hl", "en");
  return u.toString();
};
const FLOW_HOSTS = /^https:\/\/(flow\.google\.com|labs\.google\/fx)/;
export const HOME_DIR = process.env.FLOW_MCP_HOME ?? join(homedir(), ".flow-mcp");
export const PROFILE_DIR = join(HOME_DIR, "chrome-profile");
export const CDP_PORT = Number(process.env.FLOW_MCP_CDP_PORT ?? 9333);
const CDP_URL = `http://127.0.0.1:${CDP_PORT}`;

const CHROME_PATHS = [
  process.env.FLOW_MCP_CHROME,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/local/bin/chromium",
  "/opt/google/chrome/chrome",
  "/snap/bin/chromium",
  "/var/lib/flatpak/exports/bin/com.google.Chrome",
  "/var/lib/flatpak/exports/bin/org.chromium.Chromium",
  join(homedir(), ".local/share/flatpak/exports/bin/com.google.Chrome"),
  join(homedir(), ".local/share/flatpak/exports/bin/org.chromium.Chromium"),
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  // Windows also installs Chrome here: 32-bit builds, and per-user installs made without admin rights.
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : undefined,
].filter((p): p is string => Boolean(p));

const LINUX_BROWSER_BINS = [
  "google-chrome",
  "google-chrome-stable",
  "chromium",
  "chromium-browser",
  "brave-browser",
  "brave",
  "microsoft-edge",
];

function findBrowserOnPath(): string | undefined {
  if (process.platform !== "linux") return undefined;
  for (const bin of LINUX_BROWSER_BINS) {
    try {
      const resolved = execFileSync("which", [bin], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
      if (resolved && existsSync(resolved)) return resolved;
    } catch {
      // Binary not on PATH; try next candidate.
    }
  }
  return undefined;
}

let browser: Browser | null = null;

async function cdpUp(): Promise<boolean> {
  try {
    const res = await fetch(`${CDP_URL}/json/version`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

// Real Chrome/Chromium with a dedicated profile: Google sign-in works normally and the
// session persists, while the user's everyday profile is never touched.
export function chromeExecutable(): string {
  const chromePath = CHROME_PATHS.find((p) => existsSync(p)) ?? findBrowserOnPath();
  if (!chromePath) {
    throw new Error(
      "Chrome/Chromium browser not found. Install Chrome or Chromium, or set FLOW_MCP_CHROME to the browser executable path.",
    );
  }
  return chromePath;
}

async function launchChrome(): Promise<void> {
  const chromePath = chromeExecutable();
  mkdirSync(PROFILE_DIR, { recursive: true });
  const child = spawn(
    chromePath,
    [
      `--user-data-dir=${PROFILE_DIR}`,
      `--remote-debugging-port=${CDP_PORT}`,
      "--no-first-run",
      "--no-default-browser-check",
      inEnglish(FLOW_URL),
    ],
    { detached: true, stdio: "ignore" },
  );
  child.unref();
  for (let i = 0; i < 40; i++) {
    if (await cdpUp()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Chrome started but CDP port ${CDP_PORT} never came up.`);
}

export async function getBrowser(): Promise<Browser> {
  if (browser?.isConnected()) return browser;
  if (!(await cdpUp())) await launchChrome();
  browser = await chromium.connectOverCDP(CDP_URL);
  return browser;
}

export async function getFlowPage(): Promise<Page> {
  const b = await getBrowser();
  const context = b.contexts()[0];
  if (!context) throw new Error("Chrome has no browser context; restart the Flow Chrome window.");
  const existing = context.pages().find((p) => FLOW_HOSTS.test(p.url()));
  if (existing) {
    await ensureEnglish(existing);
    return existing;
  }
  const page = await context.newPage();
  await page.goto(inEnglish(FLOW_URL), { waitUntil: "domcontentloaded" });
  await ensureEnglish(page);
  return page;
}

// Reloads Flow in English when it is showing in another language (a page the user opened by hand, or Flow redirecting
// to an address without hl). Sign-in pages are left alone.
export async function ensureEnglish(page: Page): Promise<void> {
  if (!/^https:\/\/flow\.google\.com\//.test(page.url())) return;
  const lang = () => page.evaluate(() => document.documentElement.lang).catch(() => "");
  const now = await lang();
  if (!now || /^en\b/i.test(now)) return;
  await page.goto(inEnglish(page.url()), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.documentElement.lang, null, { timeout: 15_000 }).catch(() => {});
  const after = await lang();
  if (after && !/^en\b/i.test(after)) {
    throw new Error(
      `Flow is showing in "${after}" and would not switch to English. flow-mcp finds Flow's buttons by their English names. ` +
        `Add ?hl=en to the end of Flow's address in the Flow Chrome window, or set your Google account's language to English (myaccount.google.com/language).`,
    );
  }
}
