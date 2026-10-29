import library from './reminders.json';
import type { ReminderCursor, Settings } from '../settings';
import type { SiteId } from '../sites/types';
import type { LibraryReminder, PersonalReminder, Reminder, ReminderLibrary } from './types';

const SITE_ORDER: SiteId[] = ['youtube', 'facebook', 'linkedin', 'instagram'];

const data = library as ReminderLibrary;

export const libraryMeta = data.meta;
export const libraryReminders: LibraryReminder[] = data.reminders;

export function collectReminders(settings: Settings): Reminder[] {
  const libraryItems = libraryReminders.filter((reminder) => settings.categories[reminder.category]);
  const personal: PersonalReminder[] = settings.categories.personal
    ? settings.personalNotes.map((note) => ({
        id: note.id,
        category: 'personal',
        text: note.text,
        createdAt: note.createdAt,
      }))
    : [];
  const all = [...libraryItems, ...personal];
  if (!settings.favoritesOnly) return all;
  return all.filter((reminder) => settings.favorites.includes(reminder.id));
}

export function reminderById(reminders: Reminder[], id: string | null): Reminder | null {
  if (!id) return null;
  return reminders.find((reminder) => reminder.id === id) ?? null;
}

export function nextId(reminders: Reminder[], currentId: string | null): string | null {
  if (!reminders.length) return null;
  const index = reminders.findIndex((reminder) => reminder.id === currentId);
  return reminders[(index + 1) % reminders.length].id;
}

export function previousId(reminders: Reminder[], currentId: string | null): string | null {
  if (!reminders.length) return null;
  const index = reminders.findIndex((reminder) => reminder.id === currentId);
  const resolved = index < 0 ? 0 : index;
  return reminders[(resolved - 1 + reminders.length) % reminders.length].id;
}

export function randomId(reminders: Reminder[], currentId: string | null, rng: () => number = Math.random): string | null {
  if (!reminders.length) return null;
  if (reminders.length === 1) return reminders[0].id;
  const pool = reminders.filter((reminder) => reminder.id !== currentId);
  const index = Math.floor(rng() * pool.length);
  return pool[Math.min(pool.length - 1, Math.max(0, index))].id;
}

function emptyCursor(): ReminderCursor {
  return { reminderId: null, lastPath: null, lastAdvancedAt: 0 };
}

/** First reminder for a site, skipping one already showing on another open site. */
function openingId(reminders: Reminder[], siteId: string, settings: Settings): string {
  const used = new Set(
    Object.entries(settings.cursors)
      .filter(([key]) => key !== siteId)
      .map(([, cursor]) => cursor?.reminderId)
      .filter((id): id is string => Boolean(id)),
  );
  const offset = Math.max(0, SITE_ORDER.indexOf(siteId as SiteId));
  for (let step = 0; step < reminders.length; step += 1) {
    const candidate = reminders[(offset + step) % reminders.length];
    if (!used.has(candidate.id)) return candidate.id;
  }
  return reminders[offset % reminders.length].id;
}

function withCursor(settings: Settings, siteId: string | undefined, cursor: ReminderCursor): Settings {
  if (!siteId) return { ...settings, cursor };
  return {
    ...settings,
    cursors: { ...settings.cursors, [siteId]: cursor },
  };
}

/**
 * Moves one site's cursor forward when that page calls for it.
 * Omit `siteId` for the options and popup preview, which keep `settings.cursor`.
 * `navigated` is false for refreshes that were not caused by this tab opening a
 * new page, such as another tab writing to storage. Those refreshes never count
 * as a visit, otherwise two open tabs would hand the rotation back and forth.
 */
export function advanceCursor(
  settings: Settings,
  path: string,
  now: number,
  visible: boolean,
  navigated = true,
  siteId?: string,
): { settings: Settings; changed: boolean } {
  const reminders = collectReminders(settings);
  const cursor = { ...(siteId ? settings.cursors[siteId as SiteId] ?? emptyCursor() : settings.cursor) };
  let changed = false;
  let id = cursor.reminderId;

  if (!reminders.length) {
    if (cursor.reminderId !== null) {
      cursor.reminderId = null;
      changed = true;
    }
    return { settings: withCursor(settings, siteId, cursor), changed };
  }

  if (visible && (!id || !reminders.some((reminder) => reminder.id === id))) {
    id = siteId ? openingId(reminders, siteId, settings) : reminders[0].id;
    changed = true;
  }

  if (navigated && settings.rotation.mode === 'visit') {
    // Every page load counts, including a refresh of the same page. Only the
    // very first view keeps the opening reminder.
    if (visible && cursor.lastPath && id) {
      id = nextId(reminders, id);
      changed = true;
    }
    if (cursor.lastPath !== path) {
      cursor.lastPath = path;
      changed = true;
    }
  }

  if (visible && settings.rotation.mode === 'interval') {
    const interval = settings.rotation.intervalMinutes * 60_000;
    if (!cursor.lastAdvancedAt) {
      cursor.lastAdvancedAt = now;
      changed = true;
    } else if (now - cursor.lastAdvancedAt >= interval && id) {
      id = nextId(reminders, id);
      cursor.lastAdvancedAt = now;
      changed = true;
    }
  }

  if (cursor.reminderId !== id) {
    cursor.reminderId = id;
    changed = true;
  }

  return { settings: withCursor(settings, siteId, cursor), changed };
}

export function moveCursor(
  settings: Settings,
  direction: 'next' | 'previous' | 'random',
  path: string,
  now: number,
  rng?: () => number,
  siteId?: string,
): Settings {
  const reminders = collectReminders(settings);
  const stored = siteId ? settings.cursors[siteId as SiteId] : settings.cursor;
  const current =
    reminderById(reminders, stored?.reminderId ?? null)?.id ??
    (siteId && reminders.length ? openingId(reminders, siteId, settings) : reminders[0]?.id ?? null);
  const id =
    direction === 'next'
      ? nextId(reminders, current)
      : direction === 'previous'
        ? previousId(reminders, current)
        : randomId(reminders, current, rng);
  return withCursor(settings, siteId, {
    reminderId: id,
    lastPath: path,
    lastAdvancedAt: now,
  });
}

export function toggleFavorite(settings: Settings, id: string): Settings {
  const favorites = settings.favorites.includes(id)
    ? settings.favorites.filter((item) => item !== id)
    : [...settings.favorites, id];
  return { ...settings, favorites };
}

const COLLECTION_ARABIC: Record<string, string> = {
  'Sahih al-Bukhari': 'صحيح البخاري',
};

function arabicDigits(value: string): string {
  return value.replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
}

export function citation(reminder: Reminder): string {
  if (reminder.category === 'quran') {
    const arabicName = `\u2068${reminder.surah.arabic}\u2069`;
    const verses = `\u2066${reminder.verses}\u2069`;
    return `${reminder.surah.english} (${arabicName}) ${verses}`;
  }
  if (reminder.category === 'hadith') return `${reminder.collection}, ${reminder.reference}`;
  if (reminder.category === 'scholar') return `${reminder.scholar} — ${reminder.source}`;
  return 'Personal note';
}

export function arabicCitation(reminder: Reminder): string {
  if (reminder.category === 'quran') {
    const ayah = reminder.verses.split(':')[1] ?? '';
    return `سورة ${reminder.surah.arabic}${ayah ? ` ${arabicDigits(ayah)}` : ''}`;
  }
  if (reminder.category === 'hadith') {
    const name = COLLECTION_ARABIC[reminder.collection];
    if (!name) return '';
    const number = reminder.reference.replace(/[^\d]/g, '');
    return number ? `${name} ${arabicDigits(number)}` : name;
  }
  if (reminder.category === 'scholar') return reminder.scholarArabic;
  return '';
}

export function categoryLabel(reminder: Reminder): string {
  if (reminder.category === 'quran') return "Qur'an";
  if (reminder.category === 'hadith') return 'Hadith';
  if (reminder.category === 'scholar') return 'Scholar';
  return 'Personal note';
}
