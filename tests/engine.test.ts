import { describe, expect, it } from 'vitest';
import { advanceCursor, arabicCitation, citation, collectReminders, moveCursor, nextId, previousId, randomId } from '../src/shared/reminders/engine';
import { defaultSettings } from '../src/shared/settings';

describe('reminder engine', () => {
  it('filters by category and wraps next and previous', () => {
    const settings = defaultSettings();
    settings.categories = { quran: true, hadith: false, scholar: false, personal: false };
    const list = collectReminders(settings);
    expect(list.every((item) => item.category === 'quran')).toBe(true);
    expect(nextId(list, list[list.length - 1].id)).toBe(list[0].id);
    expect(previousId(list, list[0].id)).toBe(list[list.length - 1].id);
  });

  it('keeps a Qur’an verse number in left-to-right order beside the Arabic name', () => {
    const settings = defaultSettings();
    settings.categories = { quran: true, hadith: false, scholar: false, personal: false };
    const opening = collectReminders(settings)[0];
    const label = citation(opening);
    expect(label).toContain('1:1–7');
    expect(label).toContain('\u2066');
    expect(label.indexOf('\u2066')).toBeLessThan(label.indexOf('1:1–7'));
    expect(arabicCitation(opening)).toBe('سورة الفاتحة ١–٧');
  });

  it('names the collection and the scholar in Arabic under the saying', () => {
    const settings = defaultSettings();
    const list = collectReminders(settings);
    const hadith = list.find((item) => item.id === 'hadith-bukhari-54');
    const scholar = list.find((item) => item.id === 'scholar-abu-hurayrah-heart');
    expect(hadith && arabicCitation(hadith)).toBe('صحيح البخاري ٥٤');
    expect(scholar && arabicCitation(scholar)).toBe('أبو هريرة');
  });

  it('picks a different reminder at random when more than one exists', () => {
    const settings = defaultSettings();
    const list = collectReminders(settings);
    expect(randomId(list, list[0].id, () => 0)).not.toBe(list[0].id);
  });

  it('keeps a separate reminder on each site', () => {
    const youtube = advanceCursor(defaultSettings(), 'www.youtube.com/', 1_000, true, true, 'youtube');
    const facebook = advanceCursor(youtube.settings, 'www.facebook.com/', 2_000, true, true, 'facebook');
    expect(facebook.settings.cursors.facebook?.reminderId).toBeTruthy();
    expect(facebook.settings.cursors.facebook?.reminderId).not.toBe(facebook.settings.cursors.youtube?.reminderId);
    const youtubeAgain = advanceCursor(facebook.settings, 'www.youtube.com/', 3_000, true, false, 'youtube');
    expect(youtubeAgain.changed).toBe(false);
    expect(youtubeAgain.settings.cursors.youtube?.reminderId).toBe(youtube.settings.cursors.youtube?.reminderId);
    expect(youtubeAgain.settings.cursors.facebook?.reminderId).toBe(facebook.settings.cursors.facebook?.reminderId);
    expect(youtubeAgain.settings.cursors.facebook?.lastPath).toBe('www.facebook.com/');
  });

  it('advances on every page load after the first view, including a refresh', () => {
    const settings = defaultSettings();
    const first = advanceCursor(settings, 'www.youtube.com/', 1_000, true);
    expect(first.changed).toBe(true);
    const second = advanceCursor(first.settings, 'www.youtube.com/watch', 2_000, false);
    expect(second.settings.cursor.reminderId).toBe(first.settings.cursor.reminderId);
    const third = advanceCursor(second.settings, 'www.youtube.com/', 3_000, true);
    expect(third.settings.cursor.reminderId).not.toBe(first.settings.cursor.reminderId);
    const refreshed = advanceCursor(third.settings, 'www.youtube.com/', 4_000, true);
    expect(refreshed.settings.cursor.reminderId).not.toBe(third.settings.cursor.reminderId);
  });

  it('rotates on the interval only while a reminder is visible', () => {
    const settings = defaultSettings();
    settings.rotation.mode = 'interval';
    settings.rotation.intervalMinutes = 1;
    const first = advanceCursor(settings, 'www.youtube.com/', 1_000, true);
    const waiting = advanceCursor(first.settings, 'www.youtube.com/', 30_000, true);
    expect(waiting.settings.cursor.reminderId).toBe(first.settings.cursor.reminderId);
    const later = advanceCursor(waiting.settings, 'www.youtube.com/', 70_000, true);
    expect(later.settings.cursor.reminderId).not.toBe(first.settings.cursor.reminderId);
  });

  it('moves with next, previous, and random without losing the place', () => {
    const settings = defaultSettings();
    const list = collectReminders(settings);
    const fromStart = moveCursor(settings, 'next', 'options', 5);
    expect(fromStart.cursor.reminderId).toBe(list[1].id);
    const started = advanceCursor(settings, 'options', 10, true).settings;
    const next = moveCursor(started, 'next', 'options', 20);
    const back = moveCursor(next, 'previous', 'options', 30);
    expect(back.cursor.reminderId).toBe(started.cursor.reminderId);
    const random = moveCursor(back, 'random', 'options', 40, () => 0.2);
    expect(random.cursor.reminderId).toBeTruthy();
  });

  it('limits the list to favorites when asked', () => {
    const settings = defaultSettings();
    const id = collectReminders(settings)[0].id;
    settings.favorites = [id];
    settings.favoritesOnly = true;
    expect(collectReminders(settings).map((item) => item.id)).toEqual([id]);
  });
});
