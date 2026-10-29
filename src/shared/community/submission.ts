export const GITHUB_OWNER = 'ahmedbernous21';
export const GITHUB_REPO = 'islamic-feed-eradicator';
export const GITHUB_REPOSITORY = `${GITHUB_OWNER}/${GITHUB_REPO}`;
export const GITHUB_WEB = `https://github.com/${GITHUB_REPOSITORY}`;

export const REVIEW_STATUSES = [
  'pending',
  'under_review',
  'needs_changes',
  'approved',
  'rejected',
  'published',
] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type SuggestionCategory = 'quran' | 'hadith' | 'scholar';
export type TranslationKind = 'literal' | 'interpretive' | 'unspecified';

export const ISSUE_TEMPLATES: Record<SuggestionCategory, string> = {
  quran: 'quran_reminder.yml',
  hadith: 'hadith_reminder.yml',
  scholar: 'scholar_reminder.yml',
};

const URL_LIMIT = 7000;

export type ReminderSuggestion = {
  category: SuggestionCategory;
  arabic: string;
  translation: string;
  translationLanguage: string;
  translationSource: string;
  translationKind: TranslationKind;
  context: string;
  qualifications: string;
  commonlyMisunderstood: string;
  benefit: string;
  sources: string;
  links: string;
  submitter: string;
  surah: string;
  verses: string;
  asbab: string;
  quranSourceUrl: string;
  collection: string;
  reference: string;
  grading: string;
  gradingAuthority: string;
  hadithUrl: string;
  needsExplanation: boolean;
  explanationUrl: string;
  scholar: string;
  book: string;
  location: string;
  sourceUrl: string;
};

export type ReviewRecord = ReminderSuggestion & {
  status: ReviewStatus;
  verificationSource: string;
  reviewerNotes: string;
  correctsReminderId: string;
};

export function emptySuggestion(category: SuggestionCategory = 'quran'): ReminderSuggestion {
  return {
    category,
    arabic: '',
    translation: '',
    translationLanguage: '',
    translationSource: '',
    translationKind: 'unspecified',
    context: '',
    qualifications: '',
    commonlyMisunderstood: '',
    benefit: '',
    sources: '',
    links: '',
    submitter: '',
    surah: '',
    verses: '',
    asbab: '',
    quranSourceUrl: '',
    collection: '',
    reference: '',
    grading: '',
    gradingAuthority: '',
    hadithUrl: '',
    needsExplanation: false,
    explanationUrl: '',
    scholar: '',
    book: '',
    location: '',
    sourceUrl: '',
  };
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function filled(value: string): boolean {
  return value.trim().length > 0;
}

function requireText(errors: string[], value: string, message: string): void {
  if (!filled(value)) errors.push(message);
}

export function formErrors(suggestion: ReminderSuggestion): string[] {
  const errors: string[] = [];

  if (suggestion.category === 'quran') {
    requireText(errors, suggestion.verses || suggestion.surah, 'Name the surah or give the verse number.');
  }

  if (suggestion.category === 'hadith') {
    requireText(errors, suggestion.collection || suggestion.reference, 'Name the collection or give the number.');
    if (filled(suggestion.grading) && !filled(suggestion.gradingAuthority)) {
      errors.push('Name the scholar or institution responsible for this grade, or leave the grade blank.');
    }
    if ((suggestion.needsExplanation || filled(suggestion.commonlyMisunderstood)) && !isHttpUrl(suggestion.explanationUrl)) {
      errors.push(
        'This hadith needs a scholarly explanation link before it can be approved. Prefer Dorar.net when it has the report.',
      );
    }
  }

  if (suggestion.category === 'scholar') {
    requireText(errors, suggestion.scholar, 'Name the scholar.');
    requireText(errors, suggestion.translation, 'Give the meaning of the quotation.');
  }

  return errors;
}

export function canAppearInExtension(status: ReviewStatus): boolean {
  return status === 'approved' || status === 'published';
}

export function publicationErrors(record: ReviewRecord): string[] {
  const errors = formErrors(record);
  if (!REVIEW_STATUSES.includes(record.status)) {
    errors.push('Status must be pending, under_review, needs_changes, approved, rejected, or published.');
  } else if (!canAppearInExtension(record.status)) {
    errors.push('Only an approved or published record can be added to the reminder library.');
  }
  requireText(
    errors,
    record.verificationSource,
    'Record the source the reviewer checked. A community link is not a verification by itself.',
  );
  requireText(errors, record.reviewerNotes, 'Add reviewer notes about what was checked and any remaining limit.');
  if (record.category === 'hadith' && record.needsExplanation && !isHttpUrl(record.explanationUrl)) {
    errors.push('A complex or ambiguous hadith cannot be approved without a scholarly explanation link.');
  }
  if (record.status === 'published' && !filled(record.verificationSource)) {
    errors.push('Published text needs a recorded verification source.');
  }
  return errors;
}

export function explanationHostWarning(url: string): string | null {
  if (!isHttpUrl(url)) return null;
  const host = new URL(url.trim()).hostname.toLowerCase().replace(/^www\./, '');
  const known =
    host === 'dorar.net' ||
    host.endsWith('.dorar.net') ||
    host === 'sunnah.com' ||
    host === 'quran.com' ||
    host === 'islamweb.net' ||
    host === 'shamela.ws';
  if (known) return null;
  return 'This explanation site is not Dorar.net or one of the reference sites listed in the content policy. Reviewers still have to identify the author. A submitted link is not authoritative by itself.';
}

export function normalizeReviewRecord(value: unknown): ReviewRecord | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (raw.category !== 'quran' && raw.category !== 'hadith' && raw.category !== 'scholar') return null;
  if (typeof raw.status !== 'string' || !REVIEW_STATUSES.includes(raw.status as ReviewStatus)) return null;
  const suggestion = emptySuggestion(raw.category);
  for (const key of Object.keys(suggestion) as (keyof ReminderSuggestion)[]) {
    if (key === 'category') continue;
    const incoming = raw[key];
    if (key === 'needsExplanation') {
      suggestion.needsExplanation = incoming === true || incoming === 'yes' || incoming === 'Yes';
      continue;
    }
    if (key === 'translationKind') {
      suggestion.translationKind =
        incoming === 'literal' || incoming === 'interpretive' || incoming === 'unspecified'
          ? incoming
          : 'unspecified';
      continue;
    }
    if (typeof incoming === 'string') suggestion[key] = incoming;
  }
  return {
    ...suggestion,
    status: raw.status as ReviewStatus,
    verificationSource: typeof raw.verificationSource === 'string' ? raw.verificationSource : '',
    reviewerNotes: typeof raw.reviewerNotes === 'string' ? raw.reviewerNotes : '',
    correctsReminderId: typeof raw.correctsReminderId === 'string' ? raw.correctsReminderId : '',
  };
}

export function issueFields(suggestion: ReminderSuggestion): Record<string, string> {
  if (suggestion.category === 'quran') {
    return { surah: suggestion.surah, verses: suggestion.verses };
  }
  if (suggestion.category === 'hadith') {
    return {
      collection: suggestion.collection,
      reference: suggestion.reference.trim() || suggestion.collection,
    };
  }
  return {
    scholar: suggestion.scholar,
    book: suggestion.book,
    translation: suggestion.translation,
    source_url: suggestion.sourceUrl,
  };
}

export function issueTitle(suggestion: ReminderSuggestion): string {
  if (suggestion.category === 'quran') {
    const name = suggestion.surah.trim() || 'verse';
    const verses = suggestion.verses.trim();
    return `Qur'an: ${name}${verses ? ` ${verses}` : ''}`;
  }
  if (suggestion.category === 'hadith') {
    const collection = suggestion.collection.trim() || 'hadith';
    const reference = suggestion.reference.trim();
    return `Hadith: ${collection}${reference ? ` ${reference}` : ''}`;
  }
  return `Scholar: ${suggestion.scholar.trim() || 'quotation'}`;
}

export function suggestionMarkdown(suggestion: ReminderSuggestion): string {
  const lines = [`### ${issueTitle(suggestion)}`, ''];
  for (const [key, value] of Object.entries(issueFields(suggestion))) {
    if (!value.trim()) continue;
    lines.push(`**${key}**`, '', value.trim(), '');
  }
  return lines.join('\n');
}

export function buildReportUrl(reminderId: string, citationLabel: string, note: string): string {
  const problem = [`Reminder: ${reminderId}`, citationLabel, '', note.trim()].filter((line) => line !== undefined).join('\n').slice(0, 3500);
  const params = new URLSearchParams();
  params.set('template', 'report.yml');
  params.set('title', `Report: ${reminderId}`.slice(0, 120));
  params.set('reminder_id', reminderId);
  params.set('problem', problem);
  return `${GITHUB_WEB}/issues/new?${params.toString()}`;
}

export function buildIssueUrl(suggestion: ReminderSuggestion): { url: string; overflow: boolean; body: string } {
  const body = suggestionMarkdown(suggestion);
  const template = `${GITHUB_WEB}/issues/new?template=${ISSUE_TEMPLATES[suggestion.category]}`;
  const params = new URLSearchParams();
  params.set('template', ISSUE_TEMPLATES[suggestion.category]);
  params.set('title', issueTitle(suggestion));
  for (const [key, value] of Object.entries(issueFields(suggestion))) {
    if (value.trim()) params.set(key, value.trim());
  }
  const url = `${GITHUB_WEB}/issues/new?${params.toString()}`;
  if (url.length > URL_LIMIT) return { url: template, overflow: true, body };
  return { url, overflow: false, body };
}

export function isReviewRecord(value: unknown): value is ReviewRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<ReviewRecord>;
  return (
    record.category === 'quran' ||
    record.category === 'hadith' ||
    record.category === 'scholar'
  ) && REVIEW_STATUSES.includes(record.status as ReviewStatus);
}
