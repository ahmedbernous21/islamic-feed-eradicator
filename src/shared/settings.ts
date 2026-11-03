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
  /** Reminder ids already shown in the current random pass. Cleared when the pass finishes. */
  seenIds: string[];
  /** Recent reminder ids for the Previous button (most recent last). */
  history: string[];
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
  /** Anonymous usage counts. No URLs or reminder text. */
  telemetry: boolean;
  sites: Record<SiteId, SiteSettings>;
  favorites: string[];
  personalNotes: PersonalNote[];
  /** Preview cursor for the popup and options page. Each site stores its own in `cursors`. */
  cursor: ReminderCursor;
  cursors: Partial<Record<SiteId, ReminderCursor>>;
};

const THEMES: Theme[] = ['light', 'dark', 'system'];
const ROTATIONS: RotationMode[] = ['manual', 'visit', 'interval'];

export const SNOOZE_PRESETS: { minutes: number; label: string }[] = [
  { minutes: 10, label: '10 min' },
  { minutes: 20, label: '20 min' },
  { minutes: 60, label: '1 hour' },
  { minutes: 120, label: '2 hours' },
];

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
    telemetry: true,
    sites,
    favorites: [],
    personalNotes: [],
    cursor: { reminderId: null, lastPath: null, lastAdvancedAt: 0, seenIds: [], history: [] },
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
    telemetry: typeof input.telemetry === 'boolean' ? input.telemetry : defaults.telemetry,
    sites,
    favorites,
    personalNotes,
    cursor,
    cursors,
  };
}

function normalizeCursor(value: unknown, fallback: ReminderCursor): ReminderCursor {
  if (!isRecord(value)) return { ...fallback, seenIds: [...fallback.seenIds], history: [...fallback.history] };
  const seenIds = Array.isArray(value.seenIds)
    ? value.seenIds.filter((id): id is string => typeof id === 'string')
    : [];
  const history = Array.isArray(value.history)
    ? value.history.filter((id): id is string => typeof id === 'string')
    : [];
  return {
    reminderId: typeof value.reminderId === 'string' ? value.reminderId : null,
    lastPath: typeof value.lastPath === 'string' ? value.lastPath : null,
    lastAdvancedAt: typeof value.lastAdvancedAt === 'number' ? value.lastAdvancedAt : 0,
    seenIds,
    history,
  };
}

export function isSnoozing(settings: Settings, now = Date.now()): boolean {
  return typeof settings.snoozeUntil === 'number' && settings.snoozeUntil > now;
}

export function startSnooze(settings: Settings, minutes: number, now = Date.now()): Settings {
  const snoozeMinutes = clamp(minutes, 1, 180, settings.snoozeMinutes);
  return { ...settings, snoozeMinutes, snoozeUntil: now + snoozeMinutes * 60_000 };
}

export function clearSnooze(settings: Settings): Settings {
  return { ...settings, snoozeUntil: null };
}

export function snoozeButtonLabel(minutes: number): string {
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? 'Show feed for 1 hour' : `Show feed for ${hours} hours`;
  }
  return `Show feed for ${minutes} min`;
}

export function snoozeRemainingLabel(settings: Settings, now = Date.now()): string | null {
  if (!isSnoozing(settings, now) || typeof settings.snoozeUntil !== 'number') return null;
  const minutes = Math.max(1, Math.ceil((settings.snoozeUntil - now) / 60_000));
  return minutes === 1 ? '1 min' : `${minutes} min`;
}

export function snoozeRemainingClock(settings: Settings, now = Date.now()): string | null {
  if (!isSnoozing(settings, now) || typeof settings.snoozeUntil !== 'number') return null;
  const totalSec = Math.max(0, Math.ceil((settings.snoozeUntil - now) / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function luminance(color: string): number | null {
  const match = color.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/);
  if (!match) return null;
  const alpha = match[4] === undefined ? 1 : Number(match[4]);
  if (alpha < 0.2) return null;
  return (0.2126 * Number(match[1]) + 0.7152 * Number(match[2]) + 0.0722 * Number(match[3])) / 255;
}

function looksDark(value: string): boolean {
  return /\bdark\b/i.test(value) && !/\blight\b/i.test(value);
}

function looksLight(value: string): boolean {
  return /\blight\b/i.test(value) && !/\bdark\b/i.test(value);
}

/** Light or dark for the reminder card. System follows the page, then the computer. */
export function resolveCardTheme(theme: Theme, doc?: Document | null): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') return theme;
  const view = doc?.defaultView;
  if (doc && view && typeof view.getComputedStyle === 'function') {
    try {
      const root = view.getComputedStyle(doc.documentElement);
      if (looksDark(root.colorScheme)) return 'dark';
      if (looksLight(root.colorScheme)) return 'light';
      const hints = [
        doc.documentElement.getAttribute('class') ?? '',
        doc.documentElement.getAttribute('data-theme') ?? '',
        doc.documentElement.getAttribute('color') ?? '',
        doc.body?.getAttribute('class') ?? '',
        doc.documentElement.hasAttribute('dark') ? 'dark' : '',
      ].join(' ');
      if (looksDark(hints)) return 'dark';
      if (looksLight(hints)) return 'light';
      const bg =
        luminance(view.getComputedStyle(doc.body ?? doc.documentElement).backgroundColor) ??
        luminance(root.backgroundColor);
      if (bg !== null) {
        if (bg < 0.45) return 'dark';
        if (bg > 0.55) return 'light';
      }
    } catch {
      // linkedom and some host pages omit computed styles.
    }
  }
  if (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}
