import { useEffect, useState } from 'react';
import { hostFromTab, injectContentIntoTab, queryActiveTab, type InjectChrome } from '../background/inject';
import { findSite, SITES, siteById } from '../shared/sites';
import type { SiteId } from '../shared/sites/types';
import { moveCursor } from '../shared/reminders/engine';
import { clearSnooze, isSnoozing, snoozeRemainingLabel, toggleRegion, toggleSite } from '../shared/settings';
import { track } from '../shared/telemetry';
import { ThemePicker } from '../ui/ThemePicker';
import { useSettings } from '../ui/useSettings';
import { SiteIcon } from './SiteIcon';

function chromeApi(): InjectChrome | null {
  const chromeLike = globalThis.chrome;
  if (!chromeLike?.tabs?.query) return null;
  return chromeLike as unknown as InjectChrome;
}

async function detectHost(): Promise<string | null> {
  const api = chromeApi();
  if (!api) return null;
  const tab = await queryActiveTab(api);
  const host = hostFromTab(tab);
  if (typeof tab?.id === 'number') void injectContentIntoTab(api, tab.id, host);
  return host;
}

function Switch({
  checked,
  label,
  hint,
  onChange,
}: {
  checked: boolean;
  label: string;
  hint?: string;
  onChange: () => void;
}) {
  return (
    <label className="opt">
      <span>
        {label}
        {hint ? <small>{hint}</small> : null}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={onChange} />
    </label>
  );
}

export function App() {
  const { settings, store } = useSettings();
  const [host, setHost] = useState<string | null>(null);
  const [picked, setPicked] = useState<SiteId | null>(null);

  useEffect(() => {
    void detectHost().then(setHost);
  }, []);

  useEffect(() => {
    if (settings) document.documentElement.dataset.theme = settings.theme;
  }, [settings]);

  if (!settings) return <main className="popup"><p>Loading settings…</p></main>;

  const detected = host ? findSite(host) : null;
  const selectedId = picked ?? detected?.id ?? 'youtube';
  const site = siteById(selectedId);
  const siteOn = settings.sites[site.id].enabled;
  const snoozing = isSnoozing(settings);
  const snoozeLeft = snoozeRemainingLabel(settings);

  return (
    <main className="popup">
      <nav className="site-rail" aria-label="Sites">
        {SITES.map((item) => (
          <button
            key={item.id}
            type="button"
            className="site-btn"
            aria-label={item.title}
            aria-pressed={item.id === selectedId}
            onClick={() => setPicked(item.id)}
          >
            <SiteIcon id={item.id} />
          </button>
        ))}
      </nav>
      <section className="panel-side">
        <header className="popup-head">
          <h1>Islamic Feed</h1>
          <button
            type="button"
            className="power"
            aria-label={settings.globalEnabled ? 'Turn extension off' : 'Turn extension on'}
            aria-pressed={settings.globalEnabled}
            onClick={() => void store.update((current) => ({ ...current, globalEnabled: !current.globalEnabled }))}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 3v9M8.2 5.6a7 7 0 1 0 7.6 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        {snoozing ? (
          <p className="snooze-note">
            The original feed is showing{snoozeLeft ? ` for ${snoozeLeft}` : ''}.
            <button type="button" onClick={() => void store.update(clearSnooze)}>
              Cancel snooze
            </button>
          </p>
        ) : null}

        <p className="site-title">{site.title}</p>

        <div className="opt-block">
          <p className="opt-label">Site</p>
          <Switch
            checked={siteOn}
            label={`${site.title} enabled`}
            onChange={() => void store.update((current) => toggleSite(current, site.id))}
          />
        </div>

        <div className={`opt-block${siteOn && settings.globalEnabled ? '' : ' is-paused'}`}>
          <p className="opt-label">Options</p>
          {site.regions.map((region) => (
            <Switch
              key={region.id}
              checked={settings.sites[site.id].regions[region.id] !== false}
              label={region.title}
              onChange={() => void store.update((current) => toggleRegion(current, site.id, region.id))}
            />
          ))}
        </div>

        <div className="row">
          <span>Theme</span>
          <ThemePicker
            value={settings.theme}
            onChange={(theme) => void store.update((current) => ({ ...current, theme }))}
          />
        </div>
        <div className="popup-actions">
          <button
            type="button"
            onClick={() => {
              track({ name: 'action', action: 'next' });
              void store.update((current) =>
                detected
                  ? moveCursor(current, 'next', host ?? detected.id, Date.now(), undefined, detected.id)
                  : moveCursor(current, 'next', 'popup', Date.now()),
              );
            }}
          >
            Next reminder
          </button>
          <button type="button" onClick={() => void store.update((current) => ({ ...current, showTranslation: !current.showTranslation }))}>
            {settings.showTranslation ? 'Hide translation' : 'Show translation'}
          </button>
          <button type="button" onClick={() => globalThis.chrome?.runtime?.openOptionsPage()}>
            Settings
          </button>
        </div>
      </section>
    </main>
  );
}
