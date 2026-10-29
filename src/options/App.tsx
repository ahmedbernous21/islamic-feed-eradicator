import { useEffect, useRef, useState } from 'react';
import { renderReminder } from '../content/widget';
import { buildReportUrl } from '../shared/community/submission';
import { citation, collectReminders, libraryMeta, moveCursor, reminderById, toggleFavorite } from '../shared/reminders/engine';
import { defaultSettings, isSnoozing, normalizeSettings, type RotationMode, type Settings, type Theme } from '../shared/settings';
import { SITES } from '../shared/sites';
import type { SiteId } from '../shared/sites/types';
import { useSettings } from '../ui/useSettings';
import { SuggestReminder } from './SuggestReminder';

function Preview({ settings, onUpdate }: { settings: Settings; onUpdate: (mutator: (current: Settings) => Settings) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const reminders = collectReminders(settings);
  const reminder = reminderById(reminders, settings.cursor.reminderId) ?? reminders[0] ?? null;

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    renderReminder(
      host,
      {
        reminder,
        showTranslation: settings.showTranslation,
        theme: settings.theme,
        favorite: reminder ? settings.favorites.includes(reminder.id) : false,
        compact: false,
        emptyMessage: 'Nothing to show with the current filters.',
      },
      {
        onPrevious: () => onUpdate((current) => moveCursor(current, 'previous', 'options', Date.now())),
        onNext: () => onUpdate((current) => moveCursor(current, 'next', 'options', Date.now())),
        onRandom: () => onUpdate((current) => moveCursor(current, 'random', 'options', Date.now())),
        onToggleFavorite: () => {
          if (reminder) onUpdate((current) => toggleFavorite(current, reminder.id));
        },
        onToggleTranslation: () => onUpdate((current) => ({ ...current, showTranslation: !current.showTranslation })),
        onReport: (note) => {
          if (!reminder || reminder.category === 'personal') return;
          window.open(buildReportUrl(reminder.id, citation(reminder), note), '_blank', 'noopener');
        },
      },
    );
  }, [onUpdate, reminder, settings.favorites, settings.showTranslation, settings.theme]);

  return <div className="preview" ref={ref} />;
}

export function App() {
  const { settings, store } = useSettings();
  const [note, setNote] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings) document.documentElement.dataset.theme = settings.theme;
  }, [settings]);

  if (!settings) return <main><p>Loading settings…</p></main>;

  const update = (mutator: (current: Settings) => Settings) => {
    void store.update(mutator);
  };
  const favorites = collectReminders({ ...settings, favoritesOnly: false }).filter((item) => settings.favorites.includes(item.id));

  return (
    <main>
      <header>
        <h1>Islamic Feed Eradicator</h1>
        <p className="muted">
          Distracting feeds are replaced with a reminder. Search, messages, playback, profiles, and the rest of each site stay available.
          Every block can be turned off.
        </p>
      </header>
      <div className="layout">
        <section className="panel">
          <h2>Preview</h2>
          <Preview settings={settings} onUpdate={update} />
        </section>

        <section className="panel">
          <h2>General</h2>
          <label className="choice">
            <input
              type="checkbox"
              checked={settings.globalEnabled}
              onChange={() => update((current) => ({ ...current, globalEnabled: !current.globalEnabled }))}
            />
            <span>Enable the extension</span>
          </label>
          <label className="choice">
            <input
              type="checkbox"
              checked={settings.showTranslation}
              onChange={() => update((current) => ({ ...current, showTranslation: !current.showTranslation }))}
            />
            <span>Show English rendering<small>Arabic stays visible either way.</small></span>
          </label>
          <label className="choice">
            <input
              type="checkbox"
              checked={settings.favoritesOnly}
              onChange={() => update((current) => ({ ...current, favoritesOnly: !current.favoritesOnly }))}
            />
            <span>Show favorites only</span>
          </label>
          <div className="row">
            <label htmlFor="theme">Theme</label>
            <select
              id="theme"
              value={settings.theme}
              onChange={(event) => update((current) => ({ ...current, theme: event.target.value as Theme }))}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
          <div className="row">
            <label htmlFor="rotation">Reminder rotation</label>
            <select
              id="rotation"
              value={settings.rotation.mode}
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  rotation: { ...current.rotation, mode: event.target.value as RotationMode },
                }))
              }
            >
              <option value="visit">Each page load or refresh</option>
              <option value="interval">On a timer</option>
              <option value="manual">Only when I press next</option>
            </select>
          </div>
          <div className="row">
            <label htmlFor="interval">Timer minutes</label>
            <input
              id="interval"
              type="number"
              min={1}
              max={720}
              value={settings.rotation.intervalMinutes}
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  rotation: { ...current.rotation, intervalMinutes: Number(event.target.value) },
                }))
              }
            />
          </div>
          <div className="row">
            <label htmlFor="snooze">Show the feed for (minutes)</label>
            <input
              id="snooze"
              type="number"
              min={1}
              max={180}
              value={settings.snoozeMinutes}
              onChange={(event) => update((current) => ({ ...current, snoozeMinutes: Number(event.target.value) }))}
            />
          </div>
          <div className="row">
            <span>{isSnoozing(settings) ? 'The feed is visible right now.' : 'Show the original feed for a while.'}</span>
            <button
              type="button"
              onClick={() =>
                update((current) =>
                  isSnoozing(current)
                    ? { ...current, snoozeUntil: null }
                    : { ...current, snoozeUntil: Date.now() + current.snoozeMinutes * 60_000 },
                )
              }
            >
              {isSnoozing(settings) ? 'Resume reminders' : `Show feed for ${settings.snoozeMinutes} min`}
            </button>
          </div>
        </section>

        <section className="panel">
          <h2>Categories</h2>
          {([
            ['quran', "Qur'an"],
            ['hadith', 'Hadith'],
            ['scholar', 'Scholars'],
            ['personal', 'Personal notes'],
          ] as const).map(([key, label]) => (
            <label className="choice" key={key}>
              <input
                type="checkbox"
                checked={settings.categories[key]}
                onChange={() =>
                  update((current) => ({
                    ...current,
                    categories: { ...current.categories, [key]: !current.categories[key] },
                  }))
                }
              />
              <span>{label}</span>
            </label>
          ))}
        </section>

        <section className="panel">
          <h2>Sites</h2>
          {SITES.map((site) => (
            <div className="site-block" key={site.id}>
              <label className="choice">
                <input
                  type="checkbox"
                  checked={settings.sites[site.id].enabled}
                  onChange={() => update((current) => toggleSite(current, site.id))}
                />
                <span><strong>{site.title}</strong></span>
              </label>
              {site.regions.map((region) => (
                <label className="choice" key={region.id}>
                  <input
                    type="checkbox"
                    checked={settings.sites[site.id].regions[region.id] !== false}
                    onChange={() => update((current) => toggleRegion(current, site.id, region.id))}
                  />
                  <span>
                    {region.title}
                    <small>{region.description}</small>
                  </span>
                </label>
              ))}
            </div>
          ))}
        </section>

        <section className="panel">
          <h2>Favorites</h2>
          {favorites.length === 0 ? <p className="muted">No favorites yet. Use the Favorite button on a reminder.</p> : null}
          {favorites.map((reminder) => (
            <div className="row" key={reminder.id}>
              <span>{reminder.category === 'personal' ? reminder.text : reminder.translation}</span>
              <button type="button" onClick={() => update((current) => toggleFavorite(current, reminder.id))}>
                Remove
              </button>
            </div>
          ))}
        </section>

        <section className="panel">
          <h2>Personal notes</h2>
          <p className="muted">Notes stay on this device and are labeled as personal notes. They are not treated as Qur'an, hadith, or a scholar's words.</p>
          <textarea
            aria-label="Personal note"
            rows={3}
            maxLength={1000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <div className="split">
            <button
              type="button"
              onClick={() => {
                const text = note.trim();
                if (!text) return;
                update((current) => ({
                  ...current,
                  categories: { ...current.categories, personal: true },
                  personalNotes: [
                    ...current.personalNotes,
                    { id: `personal-${crypto.randomUUID()}`, text, createdAt: Date.now() },
                  ],
                }));
                setNote('');
              }}
            >
              Add note
            </button>
          </div>
          {settings.personalNotes.map((item) => (
            <div className="row" key={item.id}>
              <span>{item.text}</span>
              <button
                type="button"
                onClick={() =>
                  update((current) => ({
                    ...current,
                    personalNotes: current.personalNotes.filter((noteItem) => noteItem.id !== item.id),
                    favorites: current.favorites.filter((id) => id !== item.id),
                  }))
                }
              >
                Delete
              </button>
            </div>
          ))}
        </section>

        <SuggestReminder />

        <section className="panel">
          <h2>Backup</h2>
          <div className="split">
            <button
              type="button"
              onClick={() => {
                const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'islamic-feed-eradicator-settings.json';
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export settings
            </button>
            <button type="button" onClick={() => fileRef.current?.click()}>
              Import settings
            </button>
            <input
              ref={fileRef}
              hidden
              type="file"
              accept="application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void file.text().then((raw) => {
                  update(() => normalizeSettings(JSON.parse(raw)));
                }).catch(() => {
                  window.alert('That file could not be read as settings.');
                });
              }}
            />
            <button
              type="button"
              className="danger"
              onClick={() => {
                if (!confirmReset) {
                  setConfirmReset(true);
                  return;
                }
                update(() => defaultSettings());
                setConfirmReset(false);
              }}
            >
              {confirmReset ? 'Confirm reset' : 'Reset settings'}
            </button>
          </div>
        </section>

        <section className="panel">
          <h2>About the text</h2>
          <p>{libraryMeta.quranText}</p>
          <p>{libraryMeta.hadithText}</p>
          <p>{libraryMeta.translation}</p>
          <p className="muted">
            Scholar entries name the book they were taken from and say when the wording comes from a digital copy.
            Nothing in this extension is sent to a server.
          </p>
        </section>
      </div>
    </main>
  );
}

function toggleSite(settings: Settings, id: SiteId): Settings {
  return {
    ...settings,
    sites: {
      ...settings.sites,
      [id]: { ...settings.sites[id], enabled: !settings.sites[id].enabled },
    },
  };
}

function toggleRegion(settings: Settings, id: SiteId, regionId: string): Settings {
  return {
    ...settings,
    sites: {
      ...settings.sites,
      [id]: {
        ...settings.sites[id],
        regions: {
          ...settings.sites[id].regions,
          [regionId]: settings.sites[id].regions[regionId] === false,
        },
      },
    },
  };
}
