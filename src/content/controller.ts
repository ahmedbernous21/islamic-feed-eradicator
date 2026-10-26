import { advanceCursor, collectReminders, moveCursor, reminderById, toggleFavorite } from '../shared/reminders/engine';
import { hostMatches, pathMatches } from '../shared/paths';
import { isSnoozing, type Settings } from '../shared/settings';
import type { SettingsStore } from '../shared/storage';
import { buildPageCss, regionClass } from '../shared/sites/css';
import { SITES } from '../shared/sites';
import type { RegionDefinition, SiteDefinition } from '../shared/sites/types';
import { renderReminder, renderSnooze } from './widget';

export type ControllerOptions = {
  document: Document;
  location: Location;
  history: History;
  store: SettingsStore;
  sites?: SiteDefinition[];
  now?: () => number;
  windowTarget?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
};

type Stop = () => void;

function query(doc: Document, selector: string): Element | null {
  try {
    return doc.querySelector(selector);
  } catch {
    return null;
  }
}

function whenBody(doc: Document): Promise<void> {
  if (doc.body) return Promise.resolve();
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (doc.body) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(doc.documentElement, { childList: true, subtree: true });
  });
}

function activeRegions(site: SiteDefinition, settings: Settings, pathname: string): RegionDefinition[] {
  const siteSettings = settings.sites[site.id];
  return site.regions.filter(
    (region) => siteSettings.regions[region.id] !== false && pathMatches(pathname, region.paths),
  );
}

function reminderRegion(regions: RegionDefinition[]): RegionDefinition | null {
  return regions.find((region) => region.placement === 'primary') ?? regions.find((region) => region.placement === 'compact') ?? null;
}

function findMount(doc: Document, region: RegionDefinition): Element | null {
  for (const selector of region.mountSelectors ?? []) {
    const found = query(doc, selector);
    if (found) return found;
  }
  for (const selector of region.selectors) {
    const found = query(doc, selector);
    if (found?.parentElement) return found.parentElement;
  }
  return null;
}

function clearMarks(doc: Document): void {
  const html = doc.documentElement;
  for (const className of [...html.classList]) {
    if (className.startsWith('ife-')) html.classList.remove(className);
  }
  doc.getElementById('ife-style')?.remove();
  doc.getElementById('ife-reminder-host')?.remove();
  doc.getElementById('ife-snooze-host')?.remove();
}

export function startController(options: ControllerOptions): { ready: Promise<void>; refresh: () => Promise<void>; stop: Stop } {
  const sites = options.sites ?? SITES;
  const now = () => options.now?.() ?? Date.now();
  const target = options.windowTarget ?? window;
  let stopped = false;
  let refreshTimer: ReturnType<typeof setTimeout> | 0 = 0;
  let wakeTimer: ReturnType<typeof setTimeout> | 0 = 0;
  let applied = '';
  const scheduleTimer = (callback: () => void, delay: number) => globalThis.setTimeout(callback, delay);
  const cancelTimer = (timer: ReturnType<typeof setTimeout> | 0) => globalThis.clearTimeout(timer);

  const refresh = async () => {
    if (stopped) return;
    const loaded = await options.store.load();
    const site = sites.find((item) => hostMatches(options.location.hostname, item.hosts));
    const pathKey = `${options.location.hostname}${options.location.pathname}`;
    if (!site || !loaded.globalEnabled || !loaded.sites[site.id]?.enabled) {
      applied = '';
      clearMarks(options.document);
      return;
    }

    if (isSnoozing(loaded, now())) {
      applied = '';
      clearMarks(options.document);
      const host = options.document.createElement('div');
      host.id = 'ife-snooze-host';
      options.document.body?.append(host);
      const remaining = Math.max(1, Math.ceil(((loaded.snoozeUntil ?? now()) - now()) / 60000));
      renderSnooze(host, loaded.theme, `Feed visible for about ${remaining} more minute${remaining === 1 ? '' : 's'}.`, () => {
        void options.store.update((current) => ({ ...current, snoozeUntil: null }));
      });
      cancelTimer(wakeTimer);
      wakeTimer = scheduleTimer(() => void refresh(), Math.max(1000, (loaded.snoozeUntil ?? now()) - now() + 50));
      return;
    }

    const regions = activeRegions(site, loaded, options.location.pathname);
    const placement = reminderRegion(regions);
    const decision = advanceCursor(loaded, pathKey, now(), Boolean(placement));
    const settings = decision.changed
      ? await options.store.update((latest) => advanceCursor(latest, pathKey, now(), Boolean(placement)).settings)
      : decision.settings;
    const reminders = collectReminders(settings);
    const reminder = reminderById(reminders, settings.cursor.reminderId) ?? reminders[0] ?? null;
    const css = buildPageCss(
      regions.map((region) => ({
        className: regionClass(site.id, region.id),
        selectors: region.selectors,
      })),
    );
    const signature = JSON.stringify({
      css,
      id: reminder?.id ?? null,
      theme: settings.theme,
      showTranslation: settings.showTranslation,
      favorite: reminder ? settings.favorites.includes(reminder.id) : false,
      compact: placement?.placement === 'compact',
      path: options.location.pathname,
    });

    let style = options.document.getElementById('ife-style') as HTMLStyleElement | null;
    if (!style) {
      style = options.document.createElement('style');
      style.id = 'ife-style';
      (options.document.head ?? options.document.documentElement).append(style);
    }
    if (style.textContent !== css) style.textContent = css;
    const html = options.document.documentElement;
    const desired = new Set(regions.map((region) => regionClass(site.id, region.id)));
    for (const className of [...html.classList]) {
      if (className.startsWith('ife-') && !desired.has(className)) html.classList.remove(className);
    }
    for (const className of desired) html.classList.add(className);
    options.document.getElementById('ife-snooze-host')?.remove();

    if (!placement) {
      options.document.getElementById('ife-reminder-host')?.remove();
      applied = signature;
      return;
    }

    const mount = findMount(options.document, placement);
    if (!mount) {
      options.document.getElementById('ife-reminder-host')?.remove();
      applied = '';
      return;
    }
    let host = options.document.getElementById('ife-reminder-host');
    if (!host) {
      host = options.document.createElement('div');
      host.id = 'ife-reminder-host';
    }
    if (host.parentElement !== mount) mount.prepend(host);
    if (applied === signature && host.isConnected) return;
    const path = pathKey;
    renderReminder(
      host,
      {
        reminder,
        showTranslation: settings.showTranslation,
        theme: settings.theme,
        favorite: reminder ? settings.favorites.includes(reminder.id) : false,
        compact: placement.placement === 'compact',
        emptyMessage: settings.favoritesOnly
          ? 'No favorite reminders yet. Save one from a reminder card, or turn off favorites-only in settings.'
          : 'No reminders match the categories you have enabled. Turn a category back on in the extension settings.',
      },
      {
        snoozeLabel: `Show feed for ${settings.snoozeMinutes} min`,
        onPrevious: () => void options.store.update((current) => moveCursor(current, 'previous', path, now())),
        onNext: () => void options.store.update((current) => moveCursor(current, 'next', path, now())),
        onRandom: () => void options.store.update((current) => moveCursor(current, 'random', path, now())),
        onToggleFavorite: () => {
          if (!reminder) return;
          void options.store.update((current) => toggleFavorite(current, reminder.id));
        },
        onToggleTranslation: () =>
          void options.store.update((current) => ({ ...current, showTranslation: !current.showTranslation })),
        onSnooze: () =>
          void options.store.update((current) => ({
            ...current,
            snoozeUntil: now() + current.snoozeMinutes * 60_000,
          })),
      },
    );
    applied = signature;
  };

  const schedule = () => {
    cancelTimer(refreshTimer);
    refreshTimer = scheduleTimer(() => void refresh(), 150);
  };

  const onPop = () => schedule();
  const onYouTube = () => schedule();
  target.addEventListener('popstate', onPop);
  target.addEventListener('yt-navigate-finish', onYouTube);
  const push = options.history.pushState?.bind(options.history);
  const replace = options.history.replaceState?.bind(options.history);
  if (push && replace) {
    options.history.pushState = ((...args: Parameters<History['pushState']>) => {
      const result = push(...args);
      schedule();
      return result;
    }) as History['pushState'];
    options.history.replaceState = ((...args: Parameters<History['replaceState']>) => {
      const result = replace(...args);
      schedule();
      return result;
    }) as History['replaceState'];
  }

  let observer: MutationObserver | null = null;
  let observerHref = options.location.href;
  const startObserver = () => {
    if (!options.document.body || typeof MutationObserver === 'undefined') return;
    observer = new MutationObserver(() => {
      const host = options.document.getElementById('ife-reminder-host');
      const href = options.location.href;
      if (host?.isConnected && href === observerHref) return;
      observerHref = href;
      schedule();
    });
    observer.observe(options.document.body, { childList: true, subtree: true });
  };

  const unsubscribe = options.store.subscribe(() => {
    applied = '';
    void refresh();
  });

  const ready = whenBody(options.document).then(async () => {
    startObserver();
    await refresh();
  });

  return {
    ready,
    refresh,
    stop() {
      stopped = true;
      unsubscribe();
      observer?.disconnect();
      cancelTimer(refreshTimer);
      cancelTimer(wakeTimer);
      target.removeEventListener('popstate', onPop);
      target.removeEventListener('yt-navigate-finish', onYouTube);
      if (push) options.history.pushState = push;
      if (replace) options.history.replaceState = replace;
      clearMarks(options.document);
    },
  };
}
