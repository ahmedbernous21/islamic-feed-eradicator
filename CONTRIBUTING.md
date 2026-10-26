# Contributing

Thank you for helping Islamic Feed Eradicator stay accurate and small. Bug reports, site fixes, and sourced reminder suggestions are welcome. Please read the [code of conduct](CODE_OF_CONDUCT.md) and the [content policy](docs/content-policy.md) first.

This project does not need an account inside the extension, a private API key, or a paid service. GitHub Issues and pull requests are the contribution path.

## Set up

Requirements: Node.js 22, npm, and Chrome.

```bash
npm install
npm test
npm run typecheck
npm run build
```

Load `dist` as an unpacked extension:

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select the `dist` folder.
4. After later code changes, run `npm run build` and press reload on the extension card.

`npm run dev` serves the popup and settings page for layout work. Feed replacement on YouTube, Facebook, LinkedIn, and Instagram comes from the built content script, so test that from `dist`.

## Suggest a reminder

Use **Suggest a Reminder** on the extension settings page, or open a blank form on GitHub:

- [Qur'anic verse](https://github.com/ahmedbernous21/islamic-feed-eradicator/issues/new?template=quran_reminder.yml)
- [Hadith](https://github.com/ahmedbernous21/islamic-feed-eradicator/issues/new?template=hadith_reminder.yml)
- [Scholar quotation](https://github.com/ahmedbernous21/islamic-feed-eradicator/issues/new?template=scholar_reminder.yml)

The issue is public. Say what you could not verify instead of filling the gap. A suggestion stays out of the extension until a reviewer checks the wording and a pull request adds it to `src/shared/reminders/reminders.json`.

## Review and publish a suggestion

1. Move the issue from `pending` to `under_review` while you check the linked source. Maintainers apply the labels.
2. If context or a reference is missing, ask for it and mark `needs_changes`.
3. If it is fabricated, misleading, duplicated, or impossible to trace, close it as `rejected` and say why.
4. If the wording matches, add `reviews/<reminder-id>.json` with status `approved`, the verification source, and reviewer notes. Run:

```bash
npm run validate-submission -- reviews/<reminder-id>.json
```

5. Add the reminder to `reminders.json` in the same pull request, then set the review status to `published` once it is merged. Only `approved` and `published` records pass validation for the library.

Do not describe that check as a scholarly fatwa or as the agreement of every scholar. Notes can say "wording matched this edition" and can also say that another edition differs.

## Correct a published reminder

Open a [correction issue](https://github.com/ahmedbernous21/islamic-feed-eradicator/issues/new?template=correction.yml). A later pull request changes or removes the bundled entry and records `correctsReminderId`. The steps are in the [content policy](docs/content-policy.md).

## Code changes

- Keep feed hiding reversible. Hide with the page stylesheet; do not delete the site's nodes.
- Keep permissions limited to `storage` and the four sites. Do not add a host wildcard, `history`, or a token.
- Do not commit `.env` files, credentials, API keys, or `node_modules` and `dist`.
- Prefer free and open-source dependencies. If you add one, record its license in the README.
- Cover behavior with a test when the change is in the reminder engine, settings, selectors, or the submission validator.

## Pull requests

Use the pull request template. For a content change, link the issue, name the source you opened, and include the validation command output. For a selector change, say which logged-in page you checked. A platform is not "fully supported" until that check has been done.

Discussion about a translation or a scholarly reading can stay open. Record the disagreement in the review notes rather than editing the text into false certainty.
