export type Category = 'quran' | 'hadith' | 'scholar' | 'personal';

export type Verification = 'source_checked' | 'widely_attributed';

export type QuranReminder = {
  id: string;
  category: 'quran';
  arabic: string;
  translation: string;
  surah: { number: number; arabic: string; english: string };
  verses: string;
  note?: string;
};

export type HadithReminder = {
  id: string;
  category: 'hadith';
  arabic: string;
  arabicFull: string;
  translation: string;
  collection: string;
  reference: string;
  authenticity: string;
  authenticityBasis: string;
  note?: string;
};

export type ScholarReminder = {
  id: string;
  category: 'scholar';
  scholar: string;
  arabic: string;
  translation: string;
  source: string;
  verification: Verification;
  verificationNote: string;
};

export type PersonalReminder = {
  id: string;
  category: 'personal';
  text: string;
  createdAt: number;
};

export type LibraryReminder = QuranReminder | HadithReminder | ScholarReminder;
export type Reminder = LibraryReminder | PersonalReminder;

export type ReminderLibrary = {
  meta: {
    translation: string;
    quranText: string;
    hadithText: string;
  };
  reminders: LibraryReminder[];
};
