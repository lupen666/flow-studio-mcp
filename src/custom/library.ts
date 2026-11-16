import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HOME_DIR } from "../chrome.js";

export interface LocationAsset {
  id: string;
  name: string;
  description: string;
  lighting?: string;
  timeOfDay?: string;
  weather?: string;
  colorPalette?: string;
  cameraLens?: string;
  ambientAudio?: string;
  negativeNotes?: string;
  referenceImages: string[];
  updatedAt: string;
}

export type AvatarAngle = "front" | "threeQuarter" | "profile" | "closeup" | "fullBody";

export interface AvatarAsset {
  id: string;
  name: string;
  subjectDescription: string;
  outfitLock?: string;
  voiceNotes?: string;
  angles: Partial<Record<AvatarAngle, string>>;
  defaultAngles: AvatarAngle[];
  negativeNotes?: string;
  updatedAt: string;
}

export interface StyleAsset {
  id: string;
  name: string;
  visualStyle: string;
  filmOrRender?: string;
  colorGrading?: string;
  negativeNotes?: string;
  updatedAt: string;
}

const LIB_DIR = join(HOME_DIR, "library");
const LOCATIONS_FILE = join(LIB_DIR, "locations.json");
const AVATARS_FILE = join(LIB_DIR, "avatars.json");
const STYLES_FILE = join(LIB_DIR, "styles.json");

export const slugify = (name: string): string =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `item-${Date.now()}`;

function readMap<T>(file: string): Record<string, T> {
  try {
    if (!existsSync(file)) return {};
    return JSON.parse(readFileSync(file, "utf8")) as Record<string, T>;
  } catch {
    return {};
  }
}

function writeMap<T>(file: string, data: Record<string, T>): void {
  mkdirSync(LIB_DIR, { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

// --- Locations ---

export function saveLocation(input: Omit<LocationAsset, "id" | "updatedAt"> & { id?: string }): LocationAsset {
  const map = readMap<LocationAsset>(LOCATIONS_FILE);
  const id = input.id ? slugify(input.id) : slugify(input.name);
  const entry: LocationAsset = {
    ...input,
    id,
    referenceImages: (input.referenceImages ?? []).slice(0, 3),
    updatedAt: new Date().toISOString(),
  };
  map[id] = entry;
  writeMap(LOCATIONS_FILE, map);
  return entry;
}

export function listLocations(): LocationAsset[] {
  return Object.values(readMap<LocationAsset>(LOCATIONS_FILE)).sort((a, b) => a.name.localeCompare(b.name));
}

export function getLocation(idOrName: string): LocationAsset | undefined {
  const map = readMap<LocationAsset>(LOCATIONS_FILE);
  return map[idOrName] ?? map[slugify(idOrName)];
}

export function deleteLocation(id: string): { deleted: boolean; id: string } {
  const map = readMap<LocationAsset>(LOCATIONS_FILE);
  const key = map[id] ? id : slugify(id);
  const existed = Boolean(map[key]);
  delete map[key];
  writeMap(LOCATIONS_FILE, map);
  return { deleted: existed, id: key };
}

// --- Avatars ---

export function saveAvatar(input: Omit<AvatarAsset, "id" | "updatedAt" | "defaultAngles"> & { id?: string; defaultAngles?: AvatarAngle[] }): AvatarAsset {
  const map = readMap<AvatarAsset>(AVATARS_FILE);
  const id = input.id ? slugify(input.id) : slugify(input.name);
  const availableAngles = (Object.keys(input.angles ?? {}) as AvatarAngle[]).filter((k) => Boolean(input.angles?.[k]));
  const defaultAngles = (input.defaultAngles?.length ? input.defaultAngles : availableAngles).slice(0, 3);
  const entry: AvatarAsset = {
    ...input,
    id,
    defaultAngles,
    updatedAt: new Date().toISOString(),
  };
  map[id] = entry;
  writeMap(AVATARS_FILE, map);
  return entry;
}

export function listAvatars(): AvatarAsset[] {
  return Object.values(readMap<AvatarAsset>(AVATARS_FILE)).sort((a, b) => a.name.localeCompare(b.name));
}

export function getAvatar(idOrName: string): AvatarAsset | undefined {
  const map = readMap<AvatarAsset>(AVATARS_FILE);
  return map[idOrName] ?? map[slugify(idOrName)];
}

export function deleteAvatar(id: string): { deleted: boolean; id: string } {
  const map = readMap<AvatarAsset>(AVATARS_FILE);
  const key = map[id] ? id : slugify(id);
  const existed = Boolean(map[key]);
  delete map[key];
  writeMap(AVATARS_FILE, map);
  return { deleted: existed, id: key };
}

/**
 * Selects up to `maxRefs` reference images from an avatar packet matching requested angles.
 */
export function resolveAvatarRefs(avatar: AvatarAsset, preferredAngles?: AvatarAngle[], maxRefs = 3): string[] {
  const order: AvatarAngle[] = [
    ...(preferredAngles ?? []),
    ...avatar.defaultAngles,
    "front",
    "threeQuarter",
    "closeup",
    "profile",
    "fullBody",
  ];
  const seen = new Set<string>();
  const refs: string[] = [];
  for (const angle of order) {
    const ref = avatar.angles?.[angle];
    if (ref && !seen.has(ref)) {
      seen.add(ref);
      refs.push(ref);
      if (refs.length >= maxRefs) break;
    }
  }
  return refs;
}

// --- Styles ---

export function saveStyle(input: Omit<StyleAsset, "id" | "updatedAt"> & { id?: string }): StyleAsset {
  const map = readMap<StyleAsset>(STYLES_FILE);
  const id = input.id ? slugify(input.id) : slugify(input.name);
  const entry: StyleAsset = { ...input, id, updatedAt: new Date().toISOString() };
  map[id] = entry;
  writeMap(STYLES_FILE, map);
  return entry;
}

export function listStyles(): StyleAsset[] {
  return Object.values(readMap<StyleAsset>(STYLES_FILE)).sort((a, b) => a.name.localeCompare(b.name));
}

export function getStyle(idOrName: string): StyleAsset | undefined {
  const map = readMap<StyleAsset>(STYLES_FILE);
  return map[idOrName] ?? map[slugify(idOrName)];
}

export function deleteStyle(id: string): { deleted: boolean; id: string } {
  const map = readMap<StyleAsset>(STYLES_FILE);
  const key = map[id] ? id : slugify(id);
  const existed = Boolean(map[key]);
  delete map[key];
  writeMap(STYLES_FILE, map);
  return { deleted: existed, id: key };
}
