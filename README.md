# Islamic Feed Eradicator

Chrome extension (Manifest V3) that replaces the feed on YouTube, Facebook, LinkedIn, and Instagram with bundled Qur’an, hadith, and scholar reminders. Search, messages, playback, and the rest of each site stay usable.

MIT. [Privacy](https://ahmedbernous21.github.io/islamic-feed-eradicator/privacy.html) · [Content policy](https://ahmedbernous21.github.io/islamic-feed-eradicator/policy.html)

## APIs

The installed extension does **not** fetch verses or hadith while you browse. Reminder text ships in `src/shared/reminders/reminders.json`.

| API | When | What |
| --- | --- | --- |
| [Quran.com content API](https://api.quran.com/api/v4/quran/verses/uthmani) | Building the library | Uthmani Qur’an text (`text_uthmani`) |
| [hadith-api](https://github.com/fawazahmed0/hadith-api) `ara-bukhari` | Building the library | Sahih al-Bukhari Arabic |
| Chrome `storage`, `alarms`, `runtime` | Runtime | Settings, badge, usage flush |
| `POST https://ife-metrics.vercel.app/api/event` | Runtime, optional | Anonymous counts (install, Next, disable, minutes on screen). No URLs or reminder text. Off in Settings. |
| GitHub Issues (browser form) | Suggest / Report | Opens a public issue. No GitHub token in the extension. |

No Quran.com, hadith, or translation API is called on YouTube, Facebook, LinkedIn, or Instagram.

## Load unpacked

```bash
npm install
npm test
npm run build
```

Load the `dist` folder from `chrome://extensions` (Developer mode). Pin the extension. After code changes, build again and reload the card.

## License notes

Amiri (SIL OFL) and hadith-api Arabic (Unlicense) keep their own licenses. English on the card is a concise rendering for this extension, not Sahih International.
