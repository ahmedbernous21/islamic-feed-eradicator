import { SITES } from './sites';
import type { SiteId } from './sites/types';

export type Theme = 'light' | 'dark' | 'system';
export type RotationMode = 'manual' | 'visit' | 'interval';

export type SiteSettings = {
  enabled: boolean;
  regions: Record<string, boolean>;
};

export type PersonalNote = {
  id: string;
  text: string;
  createdAt: number;
};

export type ReminderCursor = {
  reminderId: string | null;
  lastPath: string | null;
  lastAdvancedAt: number;
};

export type Settings = {
  version: 1;
  globalEnabled: boolean;
  theme: Theme;
  showTranslation: boolean;
  favoritesOnly: boolean;
  categories: {
    quran: boolean;
    hadith: boolean;
    scholar: boolean;
    personal: boolean;
  };
  rotation: {
    mode: RotationMode;
    intervalMinutes: number;
  };
  snoozeMinutes: number;
  snoozeUntil: number | null;
  sites: Record<SiteId, SiteSettings>;
  favorites: string[];
  personalNotes: PersonalNote[];
  /** Preview cursor for the popup and options page. Each site stores its own in `cursors`. */
  cursor: ReminderCursor;
  cursors: Partial<Record<SiteId, ReminderCursor>>;
};

const THEMES: Theme[] = ['light', 'dark', 'system'];
const ROTATIONS: RotationMode[] = ['manual', 'visit', 'interval'];

export function defaultSettings(): Settings {
  const sites = {} as Record<SiteId, SiteSettings>;
  for (const site of SITES) {
    sites[site.id] = {
      enabled: true,
      regions: Object.fromEntries(site.regions.map((region) => [region.id, region.defaultEnabled])),
    };
  }
  return {
    version: 1,
    globalEnabled: true,
    theme: 'system',
    showTranslation: true,
    favoritesOnly: false,
    categories: { quran: true, hadith: true, scholar: true, personal: false },
    rotation: { mode: 'visit', intervalMinutes: 30 },
    snoozeMinutes: 10,
    snoozeUntil: null,
    sites,
    favorites: [],
    personalNotes: [],
    cursor: { reminderId: null, lastPath: null, lastAdvancedAt: 0 },
    cursors: {},
  };
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeSettings(input: unknown): Settings {
  const defaults = defaultSettings();
  if (!isRecord(input)) return defaults;
  const sites = { ...defaults.sites };
  if (isRecord(input.sites)) {
    for (const site of SITES) {
      const stored = input.sites[site.id];
      if (!isRecord(stored)) continue;
      const regions = { ...defaults.sites[site.id].regions };
      if (isRecord(stored.regions)) {
        for (const region of site.regions) {
          const value = stored.regions[region.id];
          if (typeof value === 'boolean') regions[region.id] = value;
        }
      }
      sites[site.id] = {
        enabled: typeof stored.enabled === 'boolean' ? stored.enabled : true,
        regions,
      };
    }
  }

  const categories = { ...defaults.categories };
  if (isRecord(input.categories)) {
    for (const key of Object.keys(categories) as (keyof Settings['categories'])[]) {
      const value = input.categories[key];
      if (typeof value === 'boolean') categories[key] = value;
    }
  }

  const rotation = { ...defaults.rotation };
  if (isRecord(input.rotation)) {
    if (typeof input.rotation.mode === 'string' && ROTATIONS.includes(input.rotation.mode as RotationMode)) {
      rotation.mode = input.rotation.mode as RotationMode;
    }
    if (typeof input.rotation.intervalMinutes === 'number') {
      rotation.intervalMinutes = clamp(input.rotation.intervalMinutes, 1, 720, defaults.rotation.intervalMinutes);
    }
  }

  const cursor = normalizeCursor(input.cursor, defaults.cursor);
  const cursors: Settings['cursors'] = {};
  if (isRecord(input.cursors)) {
    for (const site of SITES) {
      const stored = input.cursors[site.id];
      if (isRecord(stored)) cursors[site.id] = normalizeCursor(stored, defaults.cursor);
    }
  }

  const favorites = Array.isArray(input.favorites)
    ? input.favorites.filter((id): id is string => typeof id === 'string').slice(0, 500)
    : [];

  const personalNotes = Array.isArray(input.personalNotes)
    ? input.personalNotes
        .filter(isRecord)
        .map((note) => ({
          id: typeof note.id === 'string' ? note.id : '',
          text: typeof note.text === 'string' ? note.text.trim().slice(0, 1000) : '',
          createdAt: typeof note.createdAt === 'number' ? note.createdAt : Date.now(),
        }))
        .filter((note) => note.id && note.text)
        .slice(0, 200)
    : [];

  const theme = typeof input.theme === 'string' && THEMES.includes(input.theme as Theme) ? (input.theme as Theme) : defaults.theme;

  return {
    version: 1,
    globalEnabled: typeof input.globalEnabled === 'boolean' ? input.globalEnabled : defaults.globalEnabled,
    theme,
    showTranslation: typeof input.showTranslation === 'boolean' ? input.showTranslation : defaults.showTranslation,
    favoritesOnly: typeof input.favoritesOnly === 'boolean' ? input.favoritesOnly : defaults.favoritesOnly,
    categories,
    rotation,
    snoozeMinutes: typeof input.snoozeMinutes === 'number' ? clamp(input.snoozeMinutes, 1, 180, defaults.snoozeMinutes) : defaults.snoozeMinutes,
    snoozeUntil: typeof input.snoozeUntil === 'number' ? input.snoozeUntil : null,
    sites,
    favorites,
    personalNotes,
    cursor,
    cursors,
  };
}

function normalizeCursor(value: unknown, fallback: ReminderCursor): ReminderCursor {
  if (!isRecord(value)) return { ...fallback };
  return {
    reminderId: typeof value.reminderId === 'string' ? value.reminderId : null,
    lastPath: typeof value.lastPath === 'string' ? value.lastPath : null,
    lastAdvancedAt: typeof value.lastAdvancedAt === 'number' ? value.lastAdvancedAt : 0,
  };
}

export function isSnoozing(settings: Settings, now = Date.now()): boolean {
  return typeof settings.snoozeUntil === 'number' && settings.snoozeUntil > now;
}
