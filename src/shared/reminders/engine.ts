import library from './reminders.json';
import type { ReminderCursor, Settings } from '../settings';
import type { SiteId } from '../sites/types';
import type { LibraryReminder, PersonalReminder, Reminder, ReminderLibrary } from './types';

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

/**
 * Pick the next reminder at random without repeating until every item in the
 * current list has been shown, then start a fresh pass.
 */
export function drawNext(
  reminders: Reminder[],
  currentId: string | null,
  seenIds: string[],
  rng: () => number = Math.random,
): { id: string | null; seenIds: string[] } {
  if (!reminders.length) return { id: null, seenIds: [] };

  const valid = new Set(reminders.map((reminder) => reminder.id));
  let seen = seenIds.filter((id) => valid.has(id));
  let pool = reminders.filter((reminder) => !seen.includes(reminder.id));

  if (!pool.length) {
    seen = [];
    pool = reminders.filter((reminder) => reminder.id !== currentId);
    if (!pool.length) pool = reminders;
  }

  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(rng() * pool.length)));
  const id = pool[index].id;
  return { id, seenIds: [...seen, id] };
}

function emptyCursor(): ReminderCursor {
  return { reminderId: null, lastPath: null, lastAdvancedAt: 0, seenIds: [], history: [] };
}

/** First reminder for a site, skipping one already showing on another open site. */
function openingId(
  reminders: Reminder[],
  siteId: string,
  settings: Settings,
  rng: () => number = Math.random,
): { id: string; seenIds: string[] } {
  const used = new Set(
    Object.entries(settings.cursors)
      .filter(([key]) => key !== siteId)
      .map(([, cursor]) => cursor?.reminderId)
      .filter((id): id is string => Boolean(id)),
  );
  const pool = reminders.filter((reminder) => !used.has(reminder.id));
  const choices = pool.length ? pool : reminders;
  const index = Math.min(choices.length - 1, Math.max(0, Math.floor(rng() * choices.length)));
  const id = choices[index].id;
  return { id, seenIds: [id] };
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
  rng: () => number = Math.random,
): { settings: Settings; changed: boolean } {
  const reminders = collectReminders(settings);
  const cursor = {
    ...(siteId ? settings.cursors[siteId as SiteId] ?? emptyCursor() : settings.cursor),
  };
  cursor.seenIds = Array.isArray(cursor.seenIds) ? [...cursor.seenIds] : [];
  cursor.history = Array.isArray(cursor.history) ? [...cursor.history] : [];
  let changed = false;
  let id = cursor.reminderId;

  if (!reminders.length) {
    if (cursor.reminderId !== null || cursor.seenIds.length || cursor.history.length) {
      cursor.reminderId = null;
      cursor.seenIds = [];
      cursor.history = [];
      changed = true;
    }
    return { settings: withCursor(settings, siteId, cursor), changed };
  }

  if (visible && (!id || !reminders.some((reminder) => reminder.id === id))) {
    if (siteId) {
      const opening = openingId(reminders, siteId, settings, rng);
      id = opening.id;
      cursor.seenIds = opening.seenIds;
    } else {
      const drawn = drawNext(reminders, null, cursor.seenIds, rng);
      id = drawn.id;
      cursor.seenIds = drawn.seenIds;
    }
    changed = true;
  }

  if (navigated && settings.rotation.mode === 'visit') {
    // Every page load counts, including a refresh of the same page. Only the
    // very first view keeps the opening reminder.
    if (visible && cursor.lastPath && id) {
      cursor.history = [...cursor.history, id].slice(-50);
      const drawn = drawNext(reminders, id, cursor.seenIds, rng);
      id = drawn.id;
      cursor.seenIds = drawn.seenIds;
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
      cursor.history = [...cursor.history, id].slice(-50);
      const drawn = drawNext(reminders, id, cursor.seenIds, rng);
      id = drawn.id;
      cursor.seenIds = drawn.seenIds;
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
  rng: () => number = Math.random,
  siteId?: string,
): Settings {
  const reminders = collectReminders(settings);
  const stored = siteId ? settings.cursors[siteId as SiteId] : settings.cursor;
  const base = stored ? { ...stored } : emptyCursor();
  base.seenIds = Array.isArray(base.seenIds) ? [...base.seenIds] : [];
  base.history = Array.isArray(base.history) ? [...base.history] : [];

  let current =
    reminderById(reminders, base.reminderId)?.id ?? null;
  if (!current && reminders.length) {
    if (siteId) {
      const opening = openingId(reminders, siteId, settings, rng);
      current = opening.id;
      base.seenIds = opening.seenIds;
    } else {
      current = reminders[0].id;
      base.seenIds = [current];
    }
  }

  if (direction === 'previous') {
    while (base.history.length) {
      const previous = base.history.pop()!;
      if (previous !== current && reminders.some((reminder) => reminder.id === previous)) {
        return withCursor(settings, siteId, {
          reminderId: previous,
          lastPath: path,
          lastAdvancedAt: now,
          seenIds: base.seenIds,
          history: base.history,
        });
      }
    }
    return withCursor(settings, siteId, {
      reminderId: current,
      lastPath: path,
      lastAdvancedAt: now,
      seenIds: base.seenIds,
      history: base.history,
    });
  }

  if (current) base.history = [...base.history, current].slice(-50);
  const drawn =
    direction === 'random'
      ? { id: randomId(reminders, current, rng), seenIds: base.seenIds }
      : drawNext(reminders, current, base.seenIds, rng);

  return withCursor(settings, siteId, {
    reminderId: drawn.id,
    lastPath: path,
    lastAdvancedAt: now,
    seenIds: direction === 'random' && drawn.id ? [...base.seenIds.filter((id) => id !== drawn.id), drawn.id] : drawn.seenIds,
    history: base.history,
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
  'Sahih Muslim': 'صحيح مسلم',
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

export function prophetSaidArabic(): string {
  return 'قال رسول الله صلى الله عليه وسلم';
}

export function hadithAttributionEnglish(_reminder: Extract<Reminder, { category: 'hadith' }>): string {
  return `The Prophet \uFDFA said.`;
}

export function hadithNarratorArabic(reminder: Extract<Reminder, { category: 'hadith' }>): string {
  return `رواه ${reminder.narratorArabic}`;
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
  if (reminder.category === 'scholar') {
    return reminder.sourceArabic
      ? `${reminder.scholarArabic} — ${reminder.sourceArabic}`
      : reminder.scholarArabic;
  }
  return '';
}

export function categoryLabel(reminder: Reminder): string {
  if (reminder.category === 'quran') return "Qur'an";
  if (reminder.category === 'hadith') return 'Hadith';
  if (reminder.category === 'scholar') return 'Scholar quotation';
  return 'Personal note';
}
