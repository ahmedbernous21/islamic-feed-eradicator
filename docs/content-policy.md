# Religious content policy

Islamic Feed Eradicator shows a small bundled library of reminders. Community members can suggest additions. A suggestion is not a verification, and a reviewer is not a qualified Islamic scholar merely because they can merge a pull request.

The extension works offline. Approved text reaches people only after it is added to `src/shared/reminders/reminders.json` in a reviewed pull request. Pending suggestions stay on GitHub and are not shipped.

## What can be suggested

- A Qur'anic verse, with the surah, verse number, and exact Arabic.
- A hadith, with the collection, the numbering system used by the cited source, and the Arabic when it is available.
- A quotation from an Islamic scholar, early or later, with the scholar's full name and the exact words in their original language.

An isolated line is not automatically suitable. The suggestion has to say what the text means, what was being discussed, any important limit, whether people commonly misunderstand it out of context, and whether a translation is literal or interpretive.

## What must not be invented

Leave a field blank when the information is missing.

- Do not invent a reason for revelation. Include asbab al-nuzul only when a reliable source reports it, and cite that source.
- Do not invent a hadith grade. If a grade is given, name the scholar or institution responsible for it.
- Do not invent a scholar, a book, or a page to make a quotation look traceable.
- Do not present a disputed interpretation as if every scholar agreed. Record the disagreement and the sources for each reading.
- Do not label the extension's English wording as a published translation such as Sahih International.

## Sources

Qur'an suggestions need a link to a reliable Qur'an text, such as Quran.com. Hadith suggestions need a link to the report itself. Scholar quotations need a book title and a traceable location, or a bibliographic link.

For explanation of a hadith, prefer [Dorar.net](https://dorar.net/) (الدرر السنية), especially its hadith encyclopedia, or another reference site that names its scholars and sources. Sunnah.com, Quran.com, Islamweb, and Shamela are examples of sites a reviewer can identify. A link submitted by a community member is not authoritative because it was submitted. The reviewer checks who wrote the explanation and whether it matches the report.

A hadith that is difficult, uses unfamiliar words, or is often misunderstood needs a scholarly explanation link before it can be approved. The validator rejects an approval when that flag is set and the link is missing. Reviewers should set the flag themselves when the hadith needs it, even if the submitter did not.

## Review statuses

| Status | Meaning |
| --- | --- |
| `pending` | Submitted and not yet being checked. |
| `under_review` | A reviewer is comparing it with the cited sources. |
| `needs_changes` | Context, references, or wording still need clarification. |
| `approved` | The wording and references were checked, and it may be added to the library. |
| `rejected` | Unsuitable, unreliable, duplicated, or not traceable. |
| `published` | Approved and present in the bundled library. |

Only `approved` and `published` records may be added to the extension. `published` means the text is already in `reminders.json`. The running extension never reads GitHub issues.

## What a reviewer checks

1. Compare the original wording with the linked source. Do not silently "correct" it into a different reading.
2. Open the references and confirm they point at the same verse, report, or passage.
3. For a hadith grade, confirm the named scholar or institution actually gave that grade.
4. For a scholar, confirm the quotation against a traceable work where a copy is available.
5. Read the context, translation, and explanation. Reject anything fabricated, materially misleading, or impossible to trace.
6. Record the source used for the check, and notes about limits, in the review file.

The initial library was assembled by the maintainers before this workflow. Its sources are described in the README. New items use the review file below.

## Review file

Before a pull request changes `reminders.json`, add a JSON file under `reviews/` named for the new reminder id. Validate it with:

```bash
npm run validate-submission -- reviews/example.json
```

A publishable file looks like this:

```json
{
  "category": "hadith",
  "status": "approved",
  "arabic": "Exact Arabic from the cited source",
  "translation": "",
  "translationLanguage": "",
  "translationSource": "",
  "translationKind": "unspecified",
  "context": "What the report is about, and the limit of reading one sentence from it.",
  "qualifications": "Any condition the source itself mentions.",
  "commonlyMisunderstood": "",
  "benefit": "Why this is useful as a short reminder.",
  "sources": "Collection, number, and edition actually checked.",
  "links": "",
  "submitter": "",
  "collection": "Sahih al-Bukhari",
  "reference": "13",
  "grading": "Sahih",
  "gradingAuthority": "Included in Sahih al-Bukhari",
  "hadithUrl": "https://example.org/the-report",
  "needsExplanation": false,
  "explanationUrl": "",
  "verificationSource": "The reviewer compared the Arabic with the linked record.",
  "reviewerNotes": "Wording matched. No extra grade was added.",
  "correctsReminderId": ""
}
```

Qur'an records use `surah`, `verses`, `quranSourceUrl`, and `asbab`. Scholar records use `scholar`, `book`, `location`, and `sourceUrl`. Empty fields stay empty. The script rejects a file that is still `pending`, `under_review`, `needs_changes`, or `rejected`, and a file with no verification source or reviewer notes.

## Corrections and withdrawal

A published reminder can be corrected or removed when a mistake is found.

1. Open a **Correct or withdraw a reminder** issue with the reminder id, what is wrong, and the source for the correction.
2. A reviewer checks that source. The issue does not by itself change the extension.
3. A pull request edits or removes the `reminders.json` entry and updates the review file. Set `correctsReminderId` to the old id. Explain the change in `reviewerNotes`.
4. If the text should leave the library, delete or stop shipping that entry and say so in the pull request. Do not leave a known false attribution in place while discussing it.

People who already installed the extension keep the previous bundled file until they update. Say that in the pull request when a correction matters.

## Public submissions

GitHub issues for this project are public. The settings page says so before it opens an issue. Do not include an email address, phone number, or other private detail. An optional name or public alias is enough.
