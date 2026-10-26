# Islamic Feed Eradicator

A Manifest V3 Chrome extension that replaces distracting feeds on YouTube, Facebook, LinkedIn, and Instagram with reminders from the Qur'an, authentic hadith, and sourced scholarly quotations. The rest of each site — playback, search, messages, jobs, profiles, and navigation — stays usable. Every block can be turned off.

This is an original extension. [News Feed Eradicator](https://github.com/jordwest/news-feed-eradicator) v3.0.5 (public repo, July 2026) was reviewed for behavior only. Its code is AGPL-3.0 and was not copied.

The source is at [github.com/ahmedbernous21/islamic-feed-eradicator](https://github.com/ahmedbernous21/islamic-feed-eradicator) under the [MIT License](LICENSE). The Amiri font and the hadith dataset keep their own licenses, listed below. No API key or paid service is required to build or run it.

## What News Feed Eradicator does, and what this extension keeps

NFE v3 replaces a feed with a quotation and can hide extra regions per site. Its public site list also includes Reddit, X, Threads, Bluesky, Substack, GitHub, Hacker News, and ABC News. Those sites are out of scope here.

Behavior carried over for the four target sites:

- Replace the main feed, and do not blank the whole website.
- Turn each site on or off, and turn individual regions on or off.
- YouTube: home recommendations, Shorts shelves and the Shorts viewer, optional suggestions beside a video, end-screen suggestions, and optional comments, live chat, and the subscriptions grid. Comments, live chat, suggestions beside a video, and the subscriptions grid are off by default so playback and subscriptions keep working.
- Facebook: home feed and stories. The groups feed is off by default.
- LinkedIn: home feed and the news sidebar. Jobs, messaging, search, notifications, and profiles are not targeted.
- Instagram: home feed, stories, and suggested accounts. The Explore grid is off by default because Instagram uses Explore for search.
- A temporary way to see the feed again. NFE uses press-and-hold. This extension uses a keyboard-reachable **Show feed for N minutes** control and a **Resume reminders** button.
- A new reminder when you move between pages. NFE does this per visit. Here you can choose per visit, a timer, or manual only.
- Settings stored in `chrome.storage.local` on this device. Nothing is uploaded.

Also included, because the product needs them: a toolbar popup, favorites, category filters, light / dark / system theme, optional English rendering, personal notes that are never labeled as scripture, and a JSON settings backup.

## Reminders

The library is `src/shared/reminders/reminders.json`.

- Qur'an text is the Uthmani script from the Quran.com content API (`text_uthmani`). A check compared every stored line with that API.
- English fields are concise renderings written for this extension. They are not a published translation such as Sahih International. Compare a printed mushaf.
- Hadith Arabic comes from the public-domain [hadith-api](https://github.com/fawazahmed0/hadith-api) dataset. Bukhari numbers match that edition's hadith numbers. Muslim entries cite the hadith-api number and the in-book reference, because other sites use different global numbers for the same report.
- Grading is "Sahih" only because the report is in Sahih al-Bukhari or Sahih Muslim. No extra grade was invented.
- Sahih al-Bukhari 1 in that dataset does not include a clause about emigrating for Allah and His Messenger that many printed copies include. The card says so.
- Scholar entries are limited to wording checked against a named source. Abu Hurayrah's statement is from Musannaf Abd al-Razzaq, no. 20375, and is not a prophetic hadith. The Ibn al-Qayyim lines follow the digital text of al-Fawa'id on usul.ai (Dar al-Kutub al-Ilmiyyah) and should be checked against a printed copy. Their orthography is kept as displayed there.

New reminders are suggested from **Suggest a Reminder** in the extension settings, or with a [GitHub issue template](https://github.com/ahmedbernous21/islamic-feed-eradicator/issues/new/choose). The issue is public. It is not added to this file until a reviewer checks the wording and a pull request includes a valid `reviews/<id>.json`. See [CONTRIBUTING.md](CONTRIBUTING.md) and the [content policy](docs/content-policy.md). Do not invent a source, a grade, or a reason for revelation.

## Load it in Chrome

```bash
npm install
npm test
npm run build
```

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked**.
4. Select the `dist` folder in this project (the folder that contains `manifest.json`, not the project root).
5. Pin **Islamic Feed Eradicator**. After you change the code, run `npm run build` again and press the reload icon on the extension card.

`npm run dev` serves the popup and settings page for layout work. Feed replacement runs from the built content script, so use the unpacked `dist` build to test it on a real site.

## Manual test

These checks were not all run against logged-in production sites in this workspace. Do them before treating a platform as confirmed on your machine.

1. Settings page: switch theme, hide the English rendering, turn a category off, press Next, Previous, Random, and Favorite. Reload the page and confirm the choices remain.
2. Turn the extension off from the popup. The feed should come back without a reload. Turn it on again.
3. YouTube home (`/`): the recommendation grid is replaced by a reminder. Search, a video page, and Subscriptions still work. Suggestions beside a video appear until you enable that region.
4. YouTube `/watch`: the player still plays. Enable **Suggestions beside a video** and confirm only the side column is hidden.
5. YouTube `/shorts/...`: the Shorts viewer is replaced. Turn **Shorts viewer** off and confirm the viewer returns.
6. Facebook home: the news feed is replaced. Open Messenger, notifications, a profile, and a group. The groups feed stays visible unless you enable that region.
7. LinkedIn `/feed`: the post list is replaced. Open Jobs, Messaging, search, and a profile.
8. Instagram home: the post feed is replaced. Open Direct, search, and a profile. Leave Explore off unless you want that grid hidden.
9. On a hidden feed, press **Show feed for N minutes**, confirm the posts come back, then press **Resume reminders**.
10. Move from a feed to another page and back with **When the page changes** selected. The reminder should advance. Set rotation to **Only when I press next** and confirm it stays put.

Keyboard, when the reminder card is focused: Right arrow next, Left arrow previous, `R` random, `F` favorite.

## Known limits

- Facebook, LinkedIn, and Instagram change obfuscated class names often. The adapters prefer roles and stable containers (`[role="feed"]`, `.scaffold-finite-scroll`, `main article`) and keep a few extra selectors as fallbacks. If a feed slips through, the region is not "fully supported" until the selector is updated and retested on a logged-in session.
- YouTube home, checked logged out in October 2026, uses `ytd-browse[page-subtype="home"]` and `ytd-rich-grid-renderer`. The Shorts guide link is `/shorts/`. A signed-in recommendation grid and the watch-page sidebar were not opened here, so confirm those on your account.
- The subscriptions page, comments, live chat, and suggestions beside a YouTube video are optional and off by default.
- If LinkedIn draws the post composer inside `.scaffold-finite-scroll`, that composer is hidden with the feed. The left navigation, jobs, and messaging are not.
- Instagram stories markup is especially unstable. Direct messages are not targeted. Explore is off by default so search is not blocked by accident.
- Mobile hosts such as `m.youtube.com` and `m.facebook.com` are not included.
- Hiding uses a stylesheet (`display: none`). Removing the stylesheet, or turning a region off, shows the original nodes again. The extension does not delete them.
- There is a short moment after navigation before settings are read and the feed is hidden.
- Personal notes are local text. They are labeled **Personal note** and are not given a religious source.
- No browsing history is collected, and reminder text is not fetched from a server at runtime.
- Community suggestions are GitHub issues. They are not in the installed library until a reviewed pull request publishes them.

## Privacy

Settings, favorites, and personal notes stay in `chrome.storage.local` on this device. The extension does not have `history` or `tabs` permissions, does not send reminder text or page contents to a server, and does not embed a GitHub token. Opening **Suggest a Reminder** sends you to a public GitHub issue form in the browser. Anything typed into that form is visible to anyone who can see the repository's issues.

The public privacy policy is at [ahmedbernous21.github.io/islamic-feed-eradicator/privacy.html](https://ahmedbernous21.github.io/islamic-feed-eradicator/privacy.html). The content policy is at [policy.html](https://ahmedbernous21.github.io/islamic-feed-eradicator/policy.html).

## License and third-party works

Project code is MIT. These pieces stay under their own terms and are not relicensed:

| Work | Used for | License |
| --- | --- | --- |
| React, React DOM | Settings page and popup | MIT |
| Vite, `@vitejs/plugin-react`, Vitest | Build and tests | MIT |
| TypeScript | Typecheck, not shipped in `dist` | Apache-2.0 |
| linkedom | Tests, not shipped in `dist` | ISC |
| `@types/chrome`, `@types/react`, `@types/react-dom` | Types, not shipped in `dist` | MIT |
| Amiri (`public/fonts`) | Arabic text | SIL Open Font License, `public/fonts/OFL.txt` |
| [hadith-api](https://github.com/fawazahmed0/hadith-api) Arabic | Bundled hadith wording | Unlicense |

Apache-2.0 and ISC apply to development tools. The extension can be built from the public source with `npm install` and `npm run build`.

## Project map

- `src/content` injects the page stylesheet and the shadow-DOM reminder. It watches `history.pushState`, `replaceState`, `popstate`, YouTube's `yt-navigate-finish` event, and DOM updates. New feed items are hidden by the stylesheet, so the observer does not walk the whole page on every scroll.
- `src/shared/sites` holds one adapter per platform.
- `src/shared/reminders` is the dataset and the next / previous / random / rotation logic.
- `src/shared/community` checks a suggestion before it can be published, and builds the public GitHub issue link. No token is included.
- `reviews/` holds the verification record for a reminder added after the initial library.
- `src/popup` and `src/options` are the React interfaces.
- `src/background/service-worker.ts` only updates the toolbar badge.
- Permissions are `storage` plus the four sites. There is no `history`, `tabs`, or host wildcard.

## Scripts

- `npm test` — path matching, settings merge, reminder selection, dataset checks, and feed show/hide.
- `npm run typecheck` — TypeScript.
- `npm run build` — popup, settings page, content script, and service worker in `dist`.
- `npm run validate-submission -- reviews/<id>.json` — checks a review record before it is added to the library.

Bugs, feature requests, and reminder suggestions use [GitHub Issues](https://github.com/ahmedbernous21/islamic-feed-eradicator/issues). Code and published reminders use pull requests. Contribution steps are in [CONTRIBUTING.md](CONTRIBUTING.md), and expected behavior is in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
