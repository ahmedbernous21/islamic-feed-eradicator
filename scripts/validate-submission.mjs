import { readFileSync } from 'node:fs';
import { normalizeReviewRecord, publicationErrors } from '../src/shared/community/submission.ts';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run validate-submission -- reviews/<reminder-id>.json');
  process.exit(1);
}

let value;
try {
  value = JSON.parse(readFileSync(file, 'utf8'));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Could not read the review file.');
  process.exit(1);
}

const record = normalizeReviewRecord(value);
if (!record) {
  console.error('The file needs category "quran", "hadith", or "scholar", and a known review status.');
  process.exit(1);
}

const errors = publicationErrors(record);
if (errors.length > 0) {
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`${record.status}: ${file} can be added to the bundled library.`);
