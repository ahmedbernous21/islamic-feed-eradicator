import { describe, expect, it } from 'vitest';
import hadithTemplate from '../.github/ISSUE_TEMPLATE/hadith_reminder.yml?raw';
import quranTemplate from '../.github/ISSUE_TEMPLATE/quran_reminder.yml?raw';
import scholarTemplate from '../.github/ISSUE_TEMPLATE/scholar_reminder.yml?raw';
import {
  GITHUB_WEB,
  buildIssueUrl,
  buildReportUrl,
  emptySuggestion,
  formErrors,
  issueFields,
  publicationErrors,
  type ReviewRecord,
} from '../src/shared/community/submission';

function ready(category: ReviewRecord['category']): ReviewRecord {
  const base = emptySuggestion(category);
  return {
    ...base,
    status: 'approved',
    arabic: 'نص عربي للمراجعة',
    context: 'This explains the subject being discussed and the limit of reading the line alone.',
    benefit: 'It reminds the reader of a sourced point without standing in for the whole passage.',
    sources: 'Checked against the cited edition.',
    verificationSource: 'Reviewer compared the wording with the linked record on 26 October 2026.',
    reviewerNotes: 'Wording matched. Context is the submitter’s summary of that source, not a new grading.',
    correctsReminderId: '',
    translation: category === 'scholar' ? 'A concise meaning of the quotation.' : '',
    quranSourceUrl: 'https://quran.com/2/186',
    surah: 'Al-Baqarah',
    verses: '2:186',
    collection: 'Sahih al-Bukhari',
    reference: '1',
    hadithUrl: 'https://sunnah.com/bukhari:1',
    grading: '',
    gradingAuthority: '',
    needsExplanation: false,
    explanationUrl: '',
    scholar: 'Ibn al-Qayyim',
    book: 'Al-Fawa’id',
    location: 'Opening section',
    sourceUrl: 'https://shamela.ws/book/123',
  };
}

describe('suggestion forms', () => {
  it('asks only for a verse name or number', () => {
    const errors = formErrors(emptySuggestion('quran'));
    expect(errors.join(' ')).toMatch(/verse|surah/i);
    expect(errors.join(' ')).not.toMatch(/Arabic|link/i);
  });

  it('asks a scholar suggestion for the meaning', () => {
    const errors = formErrors(emptySuggestion('scholar'));
    expect(errors.join(' ')).toMatch(/meaning/i);
    const named = emptySuggestion('scholar');
    named.scholar = 'Ibn al-Qayyim';
    expect(formErrors(named).join(' ')).toMatch(/meaning/i);
    named.translation = 'Gather your heart when you recite.';
    expect(formErrors(named)).toEqual([]);
  });

  it('does not accept a hadith grade with no one responsible for it', () => {
    const suggestion = emptySuggestion('hadith');
    suggestion.grading = 'Sahih';
    const errors = formErrors(suggestion);
    expect(errors.some((error) => error.includes('grade'))).toBe(true);
  });

  it('requires an explanation link when a hadith is marked difficult', () => {
    const suggestion = { ...ready('hadith'), needsExplanation: true, explanationUrl: '' };
    expect(formErrors(suggestion).some((error) => error.includes('explanation'))).toBe(true);
    suggestion.explanationUrl = 'https://dorar.net/hadith/example';
    expect(formErrors(suggestion).some((error) => error.includes('explanation'))).toBe(false);
  });

  it('builds a public issue link without embedding a token', () => {
    const issue = buildIssueUrl(ready('quran'));
    expect(issue.url.startsWith(`${GITHUB_WEB}/issues/new?`)).toBe(true);
    expect(issue.url).toContain('template=quran_reminder.yml');
    expect(issue.url).toContain('surah=');
    expect(issue.url.toLowerCase()).not.toContain('token');
    expect(issue.overflow).toBe(false);
  });

  it('falls back when the prefilled link would be too long', () => {
    const suggestion = ready('scholar');
    suggestion.translation = 'meaning '.repeat(2000);
    const issue = buildIssueUrl(suggestion);
    expect(issue.overflow).toBe(true);
    expect(issue.url).toBe(`${GITHUB_WEB}/issues/new?template=scholar_reminder.yml`);
    expect(issue.body.length).toBeGreaterThan(1000);
  });
});

describe('reminder report', () => {
  it('opens a public GitHub issue for that saying', () => {
    const url = new URL(buildReportUrl('quran-3-173', 'Al Imran 3:173', 'The English line is wrong'));
    expect(url.origin + url.pathname).toBe(`${GITHUB_WEB}/issues/new`);
    expect(url.searchParams.get('template')).toBe('report.yml');
    expect(url.searchParams.get('reminder_id')).toBe('quran-3-173');
    expect(url.searchParams.get('problem')).toContain('The English line is wrong');
    expect(url.searchParams.get('problem')).toContain('Al Imran 3:173');
  });
});

describe('publication', () => {
  it('keeps pending, rejected, and incomplete records out of the library', () => {
    expect(publicationErrors({ ...ready('quran'), status: 'pending' }).join(' ')).toMatch(/approved or published/);
    expect(publicationErrors({ ...ready('hadith'), status: 'rejected' }).join(' ')).toMatch(/approved or published/);
    expect(publicationErrors({ ...ready('quran'), verificationSource: '' }).length).toBeGreaterThan(0);
  });

  it('accepts an approved record that names what the reviewer checked', () => {
    expect(publicationErrors(ready('quran'))).toEqual([]);
    expect(publicationErrors(ready('scholar'))).toEqual([]);
  });

  it('blocks approval of an ambiguous hadith with no explanation', () => {
    const record = { ...ready('hadith'), needsExplanation: true, explanationUrl: 'not a url' };
    expect(publicationErrors(record).some((error) => error.includes('explanation'))).toBe(true);
  });
});

describe('issue templates', () => {
  it('includes every field the extension prefills', () => {
    const files = { quran: quranTemplate, hadith: hadithTemplate, scholar: scholarTemplate };
    for (const category of ['quran', 'hadith', 'scholar'] as const) {
      const yaml = files[category];
      for (const id of Object.keys(issueFields(ready(category)))) {
        expect(yaml).toContain(`id: ${id}`);
      }
    }
  });
});
