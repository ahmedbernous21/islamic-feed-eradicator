# Review records

A new reminder is added to `src/shared/reminders/reminders.json` together with a JSON file in this folder. The file is the review record described in [the content policy](../docs/content-policy.md).

```bash
npm run validate-submission -- reviews/<reminder-id>.json
```

The script accepts only `approved` and `published` records that still include their context, references, verification source, and reviewer notes. A difficult hadith also needs an explanation link.
