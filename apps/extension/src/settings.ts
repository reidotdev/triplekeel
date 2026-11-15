// The user's capture settings, kept in chrome.storage.local under
// `settings`. Live capture reads them on start and again whenever they
// change. The popup's toggles (REI-272) write them with saveSettings().
import type { SiteId } from "./adapters/index.js";
import type { KeyValueStore } from "./session.js";

export const SETTINGS_KEY = "settings";

export type Settings = {
  /** True stops live capture on every site. */
  paused: boolean;
  /** False stops live capture on that site. */
  sites: Record<SiteId, boolean>;
};

/** Capture is on for a connected user unless they turn it off. */
export const DEFAULT_SETTINGS: Settings = {
  paused: false,
  sites: { claude: true, chatgpt: true },
};

/** Reads stored settings. Missing or bad values take the default. */
export function parseSettings(value: unknown): Settings {
  const stored = (value ?? {}) as Partial<Settings>;
  const sites = (stored.sites ?? {}) as Partial<Record<SiteId, unknown>>;
  const flag = (input: unknown, fallback: boolean) =>
    typeof input === "boolean" ? input : fallback;
  return {
    paused: flag(stored.paused, DEFAULT_SETTINGS.paused),
    sites: {
      claude: flag(sites.claude, DEFAULT_SETTINGS.sites.claude),
      chatgpt: flag(sites.chatgpt, DEFAULT_SETTINGS.sites.chatgpt),
    },
  };
}

export async function readSettings(store: KeyValueStore): Promise<Settings> {
  return parseSettings((await store.get([SETTINGS_KEY]))[SETTINGS_KEY]);
}

export async function saveSettings(
  store: KeyValueStore,
  settings: Settings,
): Promise<void> {
  await store.set({ [SETTINGS_KEY]: parseSettings(settings) });
}

/** True if the settings let live capture run on this site. */
export function captureAllowed(settings: Settings, site: SiteId): boolean {
  return !settings.paused && settings.sites[site];
}
