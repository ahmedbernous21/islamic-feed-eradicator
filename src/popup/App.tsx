import { useEffect, useState } from 'react';
import { findSite } from '../shared/sites';
import { moveCursor } from '../shared/reminders/engine';
import type { Theme } from '../shared/settings';
import { useSettings } from '../ui/useSettings';

function currentHost(): Promise<string | null> {
  const tabs = globalThis.chrome?.tabs;
  if (!tabs?.query) return Promise.resolve(null);
  return tabs.query({ active: true, currentWindow: true }).then((found) => {
    const url = found[0]?.url;
    if (!url) return null;
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  });
}

export function App() {
  const { settings, store } = useSettings();
  const [host, setHost] = useState<string | null>(null);

  useEffect(() => {
    void currentHost().then(setHost);
    if (settings) document.documentElement.dataset.theme = settings.theme;
  }, [settings]);

  if (!settings) return <main><p>Loading settings…</p></main>;

  const site = host ? findSite(host) : null;
  const themes: Theme[] = ['system', 'light', 'dark'];

  return (
    <main>
      <h1>Islamic Feed</h1>
      <p className="muted">A reminder in place of the feed. The rest of the site stays usable.</p>
      <label className="switch">
        <input
          type="checkbox"
          checked={settings.globalEnabled}
          onChange={() => void store.update((current) => ({ ...current, globalEnabled: !current.globalEnabled }))}
        />
        Extension enabled
      </label>
      {site ? (
        <label className="switch">
          <input
            type="checkbox"
            checked={settings.sites[site.id].enabled}
            onChange={() =>
              void store.update((current) => ({
                ...current,
                sites: {
                  ...current.sites,
                  [site.id]: { ...current.sites[site.id], enabled: !current.sites[site.id].enabled },
                },
              }))
            }
          />
          {site.title} enabled
        </label>
      ) : (
        <p className="muted">Open YouTube, Facebook, LinkedIn, or Instagram to toggle that site.</p>
      )}
      <div className="row">
        <span>Theme</span>
        <select
          aria-label="Theme"
          value={settings.theme}
          onChange={(event) => void store.update((current) => ({ ...current, theme: event.target.value as Theme }))}
        >
          {themes.map((theme) => (
            <option key={theme} value={theme}>
              {theme}
            </option>
          ))}
        </select>
      </div>
      <div className="popup-actions">
        <button type="button" onClick={() => void store.update((current) => moveCursor(current, 'next', host ?? 'popup', Date.now()))}>
          Next reminder
        </button>
        <button type="button" onClick={() => void store.update((current) => ({ ...current, showTranslation: !current.showTranslation }))}>
          {settings.showTranslation ? 'Hide translation' : 'Show translation'}
        </button>
        <button type="button" onClick={() => globalThis.chrome?.runtime?.openOptionsPage()}>
          Settings
        </button>
      </div>
    </main>
  );
}
