import { describe, expect, it } from 'vitest';
import { libraryReminders } from '../src/shared/reminders/engine';

const arabic = /[\u0600-\u06FF]/;

describe('reminder dataset', () => {
  it('has unique ids and sourced text in every category', () => {
    const ids = libraryReminders.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(libraryReminders.some((item) => item.category === 'quran')).toBe(true);
    expect(libraryReminders.some((item) => item.category === 'hadith')).toBe(true);
    expect(libraryReminders.some((item) => item.category === 'scholar')).toBe(true);

    for (const reminder of libraryReminders) {
      if (reminder.category === 'quran') {
        expect(reminder.arabic).toMatch(arabic);
        expect(reminder.verses).toMatch(/^\d+:\d+/);
        expect(reminder.surah.arabic).toMatch(arabic);
        expect(reminder.translation.length).toBeGreaterThan(10);
        expect(reminder.translation).not.toMatch(/Sahih International|Yusuf Ali|Pickthall/i);
      }
      if (reminder.category === 'hadith') {
        expect(reminder.arabic).toMatch(arabic);
        expect(reminder.arabicFull).toContain(reminder.arabic.replace(/\s+/g, ' ').slice(0, 12));
        expect(reminder.collection.length).toBeGreaterThan(3);
        expect(reminder.reference.length).toBeGreaterThan(3);
        expect(reminder.authenticityBasis.length).toBeGreaterThan(10);
      }
      if (reminder.category === 'scholar') {
        expect(reminder.arabic).toMatch(arabic);
        expect(reminder.source.length).toBeGreaterThan(8);
        expect(reminder.verification).toBe('source_checked');
        expect(reminder.verificationNote.length).toBeGreaterThan(20);
      }
    }
  });
});
