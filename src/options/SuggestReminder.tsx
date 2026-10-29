import { useMemo, useState, type FormEvent } from 'react';
import { GITHUB_WEB, buildIssueUrl, emptySuggestion, formErrors, type SuggestionCategory } from '../shared/community/submission';

const CATEGORIES: { id: SuggestionCategory; label: string }[] = [
  { id: 'quran', label: 'Qur’an' },
  { id: 'hadith', label: 'Hadith' },
  { id: 'scholar', label: 'Scholar quotation' },
];

function verseParts(value: string): { surah: string; verses: string } {
  const trimmed = value.trim();
  const match = trimmed.match(/^(.*?)(\d+:\d+(?:\s*[–-]\s*\d+)?)\s*$/);
  if (!match) return { surah: trimmed, verses: trimmed };
  return { surah: match[1].trim() || match[2].replace(/\s+/g, ''), verses: match[2].replace(/\s+/g, '') };
}

function hadithParts(value: string): { collection: string; reference: string } {
  const trimmed = value.trim();
  const match = trimmed.match(/^(.*\D)\s+(\d[\d,]*)\s*$/);
  if (!match) return { collection: trimmed, reference: trimmed };
  return { collection: match[1].trim(), reference: match[2] };
}

function scholarParts(value: string): { scholar: string; book: string } {
  const trimmed = value.trim();
  const comma = trimmed.indexOf(',');
  if (comma === -1) return { scholar: trimmed, book: '' };
  return { scholar: trimmed.slice(0, comma).trim(), book: trimmed.slice(comma + 1).trim() };
}

export function SuggestReminder() {
  const [draft, setDraft] = useState(() => emptySuggestion());
  const [errors, setErrors] = useState<string[]>([]);
  const [copy, setCopy] = useState('');
  const preview = useMemo(() => buildIssueUrl(draft), [draft]);
  const where =
    draft.category === 'quran'
      ? [draft.surah, draft.verses].filter((part, index, all) => part && all.indexOf(part) === index).join(' ')
      : draft.category === 'hadith'
        ? [draft.collection, draft.reference].filter((part, index, all) => part && all.indexOf(part) === index).join(' ')
        : [draft.scholar, draft.book].filter(Boolean).join(', ');

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = formErrors(draft);
    setErrors(next);
    if (next.length > 0) return;
    const issue = buildIssueUrl(draft);
    setCopy(issue.overflow ? issue.body : '');
    window.open(issue.url, '_blank', 'noopener,noreferrer');
  }

  return (
    <section className="panel suggest">
      <h2>Suggest a Reminder</h2>
      <p>
        A verse or hadith only needs the name or the number. A scholar’s quotation also needs the meaning.
        This opens a public GitHub issue and is not added until the wording is checked.
      </p>
      <form onSubmit={submit}>
        <fieldset>
          <legend>What is it?</legend>
          {CATEGORIES.map((category) => (
            <label className="choice" key={category.id}>
              <input
                type="radio"
                name="category"
                checked={draft.category === category.id}
                onChange={() => setDraft(emptySuggestion(category.id))}
              />
              <span>{category.label}</span>
            </label>
          ))}
        </fieldset>
        <label>
          {draft.category === 'quran' ? 'Name or verse number' : draft.category === 'hadith' ? 'Name or number' : 'Scholar'}
          <input
            value={where}
            placeholder={
              draft.category === 'quran' ? 'Al-Baqarah or 2:255' : draft.category === 'hadith' ? 'Bukhari or 6114' : 'Ibn al-Qayyim, al-Fawa’id'
            }
            onChange={(event) => {
              const value = event.target.value;
              setDraft((current) => {
                if (current.category === 'quran') return { ...current, ...verseParts(value) };
                if (current.category === 'hadith') return { ...current, ...hadithParts(value) };
                return { ...current, ...scholarParts(value) };
              });
            }}
          />
        </label>
        {draft.category === 'scholar' && (
          <label>
            Meaning
            <textarea
              rows={4}
              value={draft.translation}
              onChange={(event) => setDraft((current) => ({ ...current, translation: event.target.value }))}
              placeholder="What the quotation means"
            />
          </label>
        )}
        <p>
          The issue is public on <a href={GITHUB_WEB}>GitHub</a>. Do not include an email address or anything
          else you want kept private.
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
            <p>This draft is too long to prefill. The empty form is open. Copy this draft into it.</p>
            <textarea readOnly rows={8} value={copy} />
          </>
        )}
      </form>
    </section>
  );
}
