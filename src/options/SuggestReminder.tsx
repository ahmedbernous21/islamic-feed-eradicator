import { useMemo, useState, type FormEvent } from 'react';
import {
  GITHUB_WEB,
  buildIssueUrl,
  emptySuggestion,
  explanationHostWarning,
  formErrors,
  type SuggestionCategory,
  type TranslationKind,
} from '../shared/community/submission';

const CATEGORIES: { id: SuggestionCategory; label: string }[] = [
  { id: 'quran', label: 'Qur’an' },
  { id: 'hadith', label: 'Hadith' },
  { id: 'scholar', label: 'Scholar quotation' },
];

export function SuggestReminder() {
  const [draft, setDraft] = useState(() => emptySuggestion());
  const [errors, setErrors] = useState<string[]>([]);
  const [copy, setCopy] = useState('');
  const hostWarning = explanationHostWarning(draft.explanationUrl);
  const preview = useMemo(() => buildIssueUrl(draft), [draft]);

  function set<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = formErrors(draft);
    setErrors(next);
    if (next.length > 0) return;
    const issue = buildIssueUrl(draft);
    if (issue.overflow) setCopy(issue.body);
    else setCopy('');
    window.open(issue.url, '_blank', 'noopener,noreferrer');
  }

  return (
    <section className="panel suggest">
      <h2>Suggest a Reminder</h2>
      <p>
        Suggest a Qur’anic verse, a hadith, or a quotation from an early or later scholar. This opens a
        public GitHub issue. It does not create an account, and nothing is added to the extension until a
        reviewer checks it and a pull request publishes it.
      </p>
      <p>
        A reviewer is not a qualified scholar merely because they can merge the suggestion. Do not invent a
        context, a reason for revelation, a grade, or an attribution to fill a gap. Leave that field blank
        and say what you could not verify.
      </p>
      <form onSubmit={submit}>
        <fieldset>
          <legend>Content category</legend>
          {CATEGORIES.map((category) => (
            <label className="choice" key={category.id}>
              <input
                type="radio"
                name="category"
                checked={draft.category === category.id}
                onChange={() => set('category', category.id)}
              />
              <span>{category.label}</span>
            </label>
          ))}
        </fieldset>

        {draft.category === 'quran' && (
          <>
            <label>
              Surah name
              <input value={draft.surah} onChange={(event) => set('surah', event.target.value)} />
            </label>
            <label>
              Verse number
              <input
                value={draft.verses}
                onChange={(event) => set('verses', event.target.value)}
                placeholder="2:186 or 2:255"
              />
            </label>
          </>
        )}
        {draft.category === 'hadith' && (
          <>
            <label>
              Collection
              <input
                value={draft.collection}
                onChange={(event) => set('collection', event.target.value)}
                placeholder="Sahih al-Bukhari"
              />
            </label>
            <label>
              Reference or number
              <input
                value={draft.reference}
                onChange={(event) => set('reference', event.target.value)}
                placeholder="Hadith 1, or Book 45, Hadith 42"
              />
            </label>
            <label>
              Grade, if you have one
              <input value={draft.grading} onChange={(event) => set('grading', event.target.value)} />
            </label>
            <label>
              Who gave that grade
              <input
                value={draft.gradingAuthority}
                onChange={(event) => set('gradingAuthority', event.target.value)}
              />
            </label>
          </>
        )}
        {draft.category === 'scholar' && (
          <>
            <label>
              Scholar’s full name
              <input value={draft.scholar} onChange={(event) => set('scholar', event.target.value)} />
            </label>
            <label>
              Book title
              <input value={draft.book} onChange={(event) => set('book', event.target.value)} />
            </label>
            <label>
              Page, chapter, or volume
              <input value={draft.location} onChange={(event) => set('location', event.target.value)} />
            </label>
          </>
        )}

        <label>
          {draft.category === 'scholar' ? 'Exact quotation in its original language' : 'Exact Arabic text'}
          <textarea
            rows={4}
            value={draft.arabic}
            onChange={(event) => set('arabic', event.target.value)}
          />
        </label>
        <label>
          Translation, optional
          <textarea
            rows={3}
            value={draft.translation}
            onChange={(event) => set('translation', event.target.value)}
          />
        </label>
        <div className="split">
          <label>
            Translation language
            <input
              value={draft.translationLanguage}
              onChange={(event) => set('translationLanguage', event.target.value)}
            />
          </label>
          <label>
            Translator or translation source
            <input
              value={draft.translationSource}
              onChange={(event) => set('translationSource', event.target.value)}
            />
          </label>
          <label>
            Translation kind
            <select
              value={draft.translationKind}
              onChange={(event) => set('translationKind', event.target.value as TranslationKind)}
            >
              <option value="unspecified">Not specified</option>
              <option value="literal">Literal</option>
              <option value="interpretive">Interpretive</option>
            </select>
          </label>
        </div>
        <label>
          Context, meaning, and circumstances
          <textarea
            rows={4}
            value={draft.context}
            onChange={(event) => set('context', event.target.value)}
            placeholder="What was being discussed, and how should this be understood?"
          />
        </label>
        <label>
          Qualifications or limits
          <textarea
            rows={3}
            value={draft.qualifications}
            onChange={(event) => set('qualifications', event.target.value)}
            placeholder="What would be lost or changed if this were read alone?"
          />
        </label>
        <label>
          Is this commonly misunderstood out of context?
          <textarea
            rows={2}
            value={draft.commonlyMisunderstood}
            onChange={(event) => set('commonlyMisunderstood', event.target.value)}
          />
        </label>
        <label>
          Why this would be a beneficial reminder
          <textarea rows={3} value={draft.benefit} onChange={(event) => set('benefit', event.target.value)} />
        </label>
        {draft.category === 'quran' && (
          <label>
            Reason for revelation, only with a reliable source
            <textarea
              rows={3}
              value={draft.asbab}
              onChange={(event) => set('asbab', event.target.value)}
              placeholder="Leave blank if you do not have a sourced report."
            />
          </label>
        )}
        <label>
          Source references
          <textarea rows={3} value={draft.sources} onChange={(event) => set('sources', event.target.value)} />
        </label>
        <label>
          {draft.category === 'quran' ? 'Qur’an source link' : 'Source link'}
          <input
            type="url"
            value={
              draft.category === 'quran'
                ? draft.quranSourceUrl
                : draft.category === 'hadith'
                  ? draft.hadithUrl
                  : draft.sourceUrl
            }
            onChange={(event) => {
              const value = event.target.value;
              if (draft.category === 'quran') set('quranSourceUrl', value);
              else if (draft.category === 'hadith') set('hadithUrl', value);
              else set('sourceUrl', value);
            }}
          />
        </label>
        {draft.category === 'hadith' && (
          <>
            <label className="choice">
              <input
                type="checkbox"
                checked={draft.needsExplanation}
                onChange={(event) => set('needsExplanation', event.target.checked)}
              />
              <span>
                This hadith is difficult, uses unfamiliar words, or is often misunderstood. A scholarly
                explanation link is required before approval.
              </span>
            </label>
            <label>
              Scholarly explanation link
              <input
                type="url"
                value={draft.explanationUrl}
                onChange={(event) => set('explanationUrl', event.target.value)}
                placeholder="https://dorar.net/..."
              />
            </label>
            <p>
              Prefer Dorar.net (الدرر السنية) when it explains the report. The link still has to be checked.
              It is not authoritative just because someone submitted it.
            </p>
            {hostWarning && <p className="danger">{hostWarning}</p>}
          </>
        )}
        <label>
          Other supporting links
          <textarea rows={2} value={draft.links} onChange={(event) => set('links', event.target.value)} />
        </label>
        <label>
          Your name or public alias, optional
          <input value={draft.submitter} onChange={(event) => set('submitter', event.target.value)} />
        </label>
        <p>
          The issue will be publicly visible on <a href={GITHUB_WEB}>GitHub</a>. Do not include an email
          address, phone number, or anything else you want kept private.
        </p>
        {errors.length > 0 && (
          <ul className="danger" role="alert">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
        <button type="submit">Open GitHub issue</button>
        {preview.overflow && copy && (
          <>
            <p>
              This draft is too long to prefill. The empty form is open. Copy this draft into it.
            </p>
            <textarea readOnly rows={8} value={copy} />
          </>
        )}
      </form>
    </section>
  );
}
