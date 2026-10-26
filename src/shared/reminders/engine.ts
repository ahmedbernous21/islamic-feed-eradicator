import library from './reminders.json';
import type { Settings } from '../settings';
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

export function advanceCursor(
  settings: Settings,
  path: string,
  now: number,
  visible: boolean,
): { settings: Settings; changed: boolean } {
  const reminders = collectReminders(settings);
  const cursor = { ...settings.cursor };
  let changed = false;
  let id = cursor.reminderId;

  if (!reminders.length) {
    if (cursor.reminderId !== null) {
      cursor.reminderId = null;
      changed = true;
    }
    return { settings: { ...settings, cursor }, changed };
  }

  if (visible && (!id || !reminders.some((reminder) => reminder.id === id))) {
    id = reminders[0].id;
    changed = true;
  }

  if (settings.rotation.mode === 'visit') {
    if (visible && cursor.lastPath && cursor.lastPath !== path && id) {
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

  return { settings: { ...settings, cursor }, changed };
}

export function moveCursor(
  settings: Settings,
  direction: 'next' | 'previous' | 'random',
  path: string,
  now: number,
  rng?: () => number,
): Settings {
  const reminders = collectReminders(settings);
  const current = reminderById(reminders, settings.cursor.reminderId)?.id ?? reminders[0]?.id ?? null;
  const id =
    direction === 'next'
      ? nextId(reminders, current)
      : direction === 'previous'
        ? previousId(reminders, current)
        : randomId(reminders, current, rng);
  return {
    ...settings,
    cursor: {
      reminderId: id,
      lastPath: path,
      lastAdvancedAt: now,
    },
  };
}

export function toggleFavorite(settings: Settings, id: string): Settings {
  const favorites = settings.favorites.includes(id)
    ? settings.favorites.filter((item) => item !== id)
    : [...settings.favorites, id];
  return { ...settings, favorites };
}

export function citation(reminder: Reminder): string {
  if (reminder.category === 'quran') {
    return `${reminder.surah.english} (${reminder.surah.arabic}) ${reminder.verses}`;
  }
  if (reminder.category === 'hadith') return `${reminder.collection}, ${reminder.reference}`;
  if (reminder.category === 'scholar') return `${reminder.scholar} — ${reminder.source}`;
  return 'Personal note';
}

export function categoryLabel(reminder: Reminder): string {
  if (reminder.category === 'quran') return "Qur'an";
  if (reminder.category === 'hadith') return 'Hadith';
  if (reminder.category === 'scholar') return 'Scholar';
  return 'Personal note';
}
