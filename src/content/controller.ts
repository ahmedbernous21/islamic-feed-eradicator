import { advanceCursor, collectReminders, moveCursor, reminderById, toggleFavorite } from '../shared/reminders/engine';
import { hostMatches, pathMatches } from '../shared/paths';
import { isSnoozing, type Settings } from '../shared/settings';
import type { SettingsStore } from '../shared/storage';
import { buildPageCss, regionClass } from '../shared/sites/css';
import { SITES } from '../shared/sites';
import type { RegionDefinition, SiteDefinition } from '../shared/sites/types';
import { renderReminder } from './widget';

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

function isStaleContext(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Extension context invalidated') || message.includes('message port closed');
}

function guard(work: Promise<unknown>): void {
  void work.catch((error: unknown) => {
    if (!isStaleContext(error)) throw error;
  });
}

function whenBody(doc: Document): Promise<void> {
  if (doc.body) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      if (!doc.body) return;
      observer?.disconnect();
      resolve();
    };
    let observer: MutationObserver | null = null;
    try {
      observer = new MutationObserver(finish);
      if (doc.documentElement) observer.observe(doc.documentElement, { childList: true });
      else observer.observe(doc, { childList: true, subtree: true });
    } catch {
      const timer = globalThis.setInterval(() => {
        if (!doc.body) return;
        globalThis.clearInterval(timer);
        resolve();
      }, 50);
    }
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

function clearColumn(doc: Document): void {
  for (const node of doc.querySelectorAll<HTMLElement>('[data-ife-column]')) {
    node.removeAttribute('data-ife-column');
    node.style.minWidth = '';
    node.style.minHeight = '';
  }
}

const FEED_ANCHORS = [
  '[role="feed"]',
  '[data-pagelet="FeedUnit"]',
  '[data-pagelet^="FeedUnit"]',
  '[data-pagelet="Stories"]',
  '[role="article"]',
  '[aria-posinset]',
];

function findFeedColumn(root: Element): Element | null {
  for (const selector of FEED_ANCHORS) {
    const anchor = root.querySelector(selector);
    if (!anchor) continue;
    let node: Element = anchor;
    while (node.parentElement && node.parentElement !== root) node = node.parentElement;
    if (node !== root) return node;
  }
  return null;
}

const HEADER_SELECTORS = ['#masthead-container', '#masthead', 'ytd-masthead', 'tp-yt-app-header', '[role="banner"]', 'header.global-nav', 'header'];
const FACEBOOK_CHAT_SELECTORS = ['[data-pagelet="ChatTab"]', '[data-pagelet="MWChatTabHeader"]', '[aria-label="Chat"]', '[aria-label="Chats"]', '[aria-label="Messenger"]'];

/** Bottom edge of any fixed or sticky header so the card never slides under it. */
function headerBottom(doc: Document): number {
  const view = doc.defaultView;
  let bottom = 0;
  for (const selector of HEADER_SELECTORS) {
    const element = query(doc, selector);
    if (!element) continue;
    const rect = element.getBoundingClientRect();
    if (rect.height === 0 || rect.top > 8) continue;
    const position = view && typeof view.getComputedStyle === 'function' ? view.getComputedStyle(element).position : '';
    if (position !== 'fixed' && position !== 'sticky' && rect.top !== 0) continue;
    bottom = Math.max(bottom, rect.bottom);
  }
  return bottom;
}

function findMount(doc: Document, region: RegionDefinition): Element | null {
  for (const selector of region.mountSelectors ?? []) {
    const found = query(doc, selector);
    if (!found) continue;
    if (region.anchor === 'feed-column') {
      const column = findFeedColumn(found);
      if (column) return column;
      continue;
    }
    return found;
  }
  if (region.anchor === 'feed-column') return null;
  for (const selector of region.selectors) {
    const found = query(doc, selector);
    if (found?.parentElement) return found.parentElement;
  }
  return null;
}

function columnBox(column: Element): { left: number; top: number; bottom: number; width: number } {
  const rect = column.getBoundingClientRect();
  if (rect.width >= 160) return { left: rect.left, top: rect.top, bottom: rect.bottom, width: rect.width };
  const parent = column.parentElement?.getBoundingClientRect();
  if (parent && parent.width >= 160) {
    return { left: parent.left, top: rect.top || parent.top, bottom: rect.bottom || parent.bottom, width: parent.width };
  }
  return { left: rect.left, top: rect.top, bottom: rect.bottom, width: rect.width };
}

function markColumn(column: HTMLElement): void {
  const width = Math.round(columnBox(column).width);
  if (width >= 160) column.style.minWidth = `${width}px`;
  column.style.minHeight = '70vh';
  column.setAttribute('data-ife-column', '');
}

function considerChatBox(
  box: DOMRect,
  left: number,
  right: number,
  viewport: number,
  limits: { bottom: number; clipRight: number },
): void {
  if (box.width < 48 || box.height < 24 || box.bottom < viewport - 4) return;
  if (box.right < left + 16 || box.left > right - 16) return;
  if (box.height <= 120) {
    limits.bottom = Math.min(limits.bottom, box.top - 8);
    return;
  }
  if (box.left > left + 200) limits.clipRight = Math.min(limits.clipRight, box.left - 12);
}

/** Keeps the card above Facebook's bottom chat dock, and to the left of an open chat. */
function facebookChatLimit(doc: Document, left: number, width: number, viewport: number): { bottom: number; width: number } {
  const right = left + width;
  const limits = { bottom: viewport - 88, clipRight: right };
  for (const selector of FACEBOOK_CHAT_SELECTORS) {
    let nodes: NodeListOf<Element>;
    try {
      nodes = doc.querySelectorAll(selector);
    } catch {
      continue;
    }
    for (const element of nodes) considerChatBox(element.getBoundingClientRect(), left, right, viewport, limits);
  }
  const view = doc.defaultView;
  if (view && typeof view.getComputedStyle === 'function' && typeof doc.elementsFromPoint === 'function') {
    for (const x of [left + width / 2, right - 24]) {
      for (const element of doc.elementsFromPoint(x, viewport - 12)) {
        if (element.id === 'ife-reminder-host') continue;
        const position = view.getComputedStyle(element).position;
        if (position !== 'fixed' && position !== 'sticky') continue;
        considerChatBox(element.getBoundingClientRect(), left, right, viewport, limits);
      }
    }
  }
  return { bottom: limits.bottom, width: Math.min(width, Math.max(200, limits.clipRight - left)) };
}

function placeOverlay(host: HTMLElement, column: Element, siteId: string): void {
  host.classList.add('ife-overlay');
  const rect = columnBox(column);
  if (rect.width < 160) {
    host.classList.add('ife-pending');
    return;
  }
  host.classList.remove('ife-pending');
  const doc = column.ownerDocument;
  const viewport = doc.defaultView?.innerHeight || 800;
  const headerGap = siteId === 'youtube' ? 48 : 12;
  const minimumTop = siteId === 'youtube' ? 104 : 12;
  const top = Math.max(rect.top, headerBottom(doc) + headerGap, minimumTop);
  let bottom = Math.min(rect.bottom, viewport - 16);
  let width = rect.width;
  if (siteId === 'facebook') {
    const chat = facebookChatLimit(doc, rect.left, width, viewport);
    bottom = Math.min(bottom, chat.bottom);
    width = chat.width;
  }
  host.style.left = `${Math.round(rect.left)}px`;
  host.style.top = `${Math.round(top)}px`;
  host.style.width = `${Math.round(width)}px`;
  host.style.maxHeight = `${Math.round(Math.max(bottom - top, 0))}px`;
}

function clearMarks(doc: Document): void {
  const html = doc.documentElement;
  for (const className of [...html.classList]) {
    if (className.startsWith('ife-')) html.classList.remove(className);
  }
  doc.getElementById('ife-style')?.remove();
  doc.getElementById('ife-reminder-host')?.remove();
  doc.getElementById('ife-snooze-host')?.remove();
  clearColumn(doc);
}

export function startController(options: ControllerOptions): { ready: Promise<void>; refresh: () => Promise<void>; stop: Stop } {
  const sites = options.sites ?? SITES;
  const now = () => options.now?.() ?? Date.now();
  const target = options.windowTarget ?? window;
  let stopped = false;
  let wantsColumn = false;
  let activeSiteId = sites.find((item) => hostMatches(options.location.hostname, item.hosts))?.id ?? '';
  let refreshTimer: ReturnType<typeof setTimeout> | 0 = 0;
  let wakeTimer: ReturnType<typeof setTimeout> | 0 = 0;
  let applied = '';
  let renderedPath: string | null = null;
  const scheduleTimer = (callback: () => void, delay: number) => globalThis.setTimeout(callback, delay);
  const cancelTimer = (timer: ReturnType<typeof setTimeout> | 0) => globalThis.clearTimeout(timer);

  const refresh = async () => {
    // Another tab can write to storage before this page has a body. The ready
    // path runs the first real refresh once the body exists.
    if (stopped || !options.document.body) return;
    const loaded = await options.store.load();
    const site = sites.find((item) => hostMatches(options.location.hostname, item.hosts));
    activeSiteId = site?.id ?? '';
    const pathKey = `${options.location.hostname}${options.location.pathname}`;
    if (!site || !loaded.globalEnabled || !loaded.sites[site.id]?.enabled) {
      applied = '';
      wantsColumn = false;
      clearMarks(options.document);
      return;
    }

    if (isSnoozing(loaded, now())) {
      applied = '';
      wantsColumn = false;
      clearMarks(options.document);
      cancelTimer(wakeTimer);
      wakeTimer = scheduleTimer(() => guard(refresh()), Math.max(1000, (loaded.snoozeUntil ?? now()) - now() + 50));
      return;
    }

    const regions = activeRegions(site, loaded, options.location.pathname);
    const placement = reminderRegion(regions);
    const navigated = renderedPath !== pathKey;
    renderedPath = pathKey;
    const decision = advanceCursor(loaded, pathKey, now(), Boolean(placement), navigated, site.id);
    let settings = decision.changed
      ? await options.store.update((latest) => advanceCursor(latest, pathKey, now(), Boolean(placement), navigated, site.id).settings)
      : decision.settings;
    // The popup has no site of its own. Apply its Next only on the tab the user is looking at.
    if (
      settings.cursor.lastPath === 'popup' &&
      settings.cursor.reminderId &&
      settings.cursor.reminderId !== settings.cursors[site.id]?.reminderId &&
      options.document.visibilityState !== 'hidden'
    ) {
      settings = await options.store.update((latest) => {
        if (latest.cursor.lastPath !== 'popup' || !latest.cursor.reminderId) return latest;
        if (options.document.visibilityState === 'hidden') return latest;
        if (latest.cursors[site.id]?.reminderId === latest.cursor.reminderId) return latest;
        return {
          ...latest,
          cursors: {
            ...latest.cursors,
            [site.id]: { reminderId: latest.cursor.reminderId, lastPath: pathKey, lastAdvancedAt: now() },
          },
        };
      });
    }
    const reminders = collectReminders(settings);
    const reminder = reminderById(reminders, settings.cursors[site.id]?.reminderId ?? null) ?? reminders[0] ?? null;
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
      wantsColumn = false;
      options.document.getElementById('ife-reminder-host')?.remove();
      clearColumn(options.document);
      applied = signature;
      return;
    }
    wantsColumn = Boolean(placement.replaceColumn);

    const mount = findMount(options.document, placement);
    if (!mount) {
      options.document.getElementById('ife-reminder-host')?.remove();
      clearColumn(options.document);
      applied = '';
      return;
    }
    let host = options.document.getElementById('ife-reminder-host') as HTMLElement | null;
    if (!host) {
      host = options.document.createElement('div');
      host.id = 'ife-reminder-host';
    }
    if (placement.replaceColumn) {
      const current = options.document.querySelector('[data-ife-column]');
      if (current && current !== mount) clearColumn(options.document);
      markColumn(mount as HTMLElement);
      if (host.parentElement !== options.document.body) {
        host.classList.add('ife-overlay', 'ife-pending');
        options.document.body?.append(host);
      }
      placeOverlay(host, mount, site.id);
      watchColumn(mount);
    } else {
      clearColumn(options.document);
      watchColumn(null);
      host.classList.remove('ife-overlay', 'ife-pending');
      host.style.left = '';
      host.style.top = '';
      host.style.width = '';
      host.style.maxHeight = '';
      if (host.parentElement !== mount) mount.prepend(host);
    }
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
        onPrevious: () => guard(options.store.update((current) => moveCursor(current, 'previous', path, now(), undefined, site.id))),
        onNext: () => guard(options.store.update((current) => moveCursor(current, 'next', path, now(), undefined, site.id))),
        onRandom: () => guard(options.store.update((current) => moveCursor(current, 'random', path, now(), undefined, site.id))),
        onToggleFavorite: () => {
          if (!reminder) return;
          guard(options.store.update((current) => toggleFavorite(current, reminder.id)));
        },
        onToggleTranslation: () =>
          guard(options.store.update((current) => ({ ...current, showTranslation: !current.showTranslation }))),
      },
    );
    applied = signature;
  };

  const schedule = () => {
    cancelTimer(refreshTimer);
    refreshTimer = scheduleTimer(() => guard(refresh()), 150);
  };

  let lastPath = `${options.location.pathname}${options.location.search}`;
  const scheduleIfMoved = () => {
    const next = `${options.location.pathname}${options.location.search}`;
    if (next === lastPath) return;
    lastPath = next;
    schedule();
  };

  const onPop = () => scheduleIfMoved();
  const onYouTube = () => scheduleIfMoved();
  target.addEventListener('popstate', onPop);
  target.addEventListener('yt-navigate-finish', onYouTube);
  const push = options.history.pushState?.bind(options.history);
  const replace = options.history.replaceState?.bind(options.history);
  try {
    if (push && replace) {
      options.history.pushState = ((...args: Parameters<History['pushState']>) => {
        const result = push(...args);
        scheduleIfMoved();
        return result;
      }) as History['pushState'];
      options.history.replaceState = ((...args: Parameters<History['replaceState']>) => {
        const result = replace(...args);
        scheduleIfMoved();
        return result;
      }) as History['replaceState'];
    }
  } catch {
    // Some pages lock history. Navigation is still picked up by the events below.
  }

  let frame = 0;
  const reposition = () => {
    if (frame || typeof requestAnimationFrame !== 'function') return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const host = options.document.getElementById('ife-reminder-host');
      const column = options.document.querySelector('[data-ife-column]');
      if (host && column) placeOverlay(host, column, activeSiteId);
    });
  };
  options.document.addEventListener('scroll', reposition, true);
  target.addEventListener('resize', reposition);

  // The feed column changes size while the site finishes loading. Follow it so
  // the card never sits at a stale position or width.
  let sizeObserver: ResizeObserver | null = null;
  let watchedColumn: Element | null = null;
  function watchColumn(column: Element | null): void {
    if (column === watchedColumn) return;
    sizeObserver?.disconnect();
    sizeObserver = null;
    watchedColumn = column;
    if (!column || typeof ResizeObserver === 'undefined') return;
    sizeObserver = new ResizeObserver(() => reposition());
    sizeObserver.observe(column);
    if (column.parentElement) sizeObserver.observe(column.parentElement);
    sizeObserver.observe(options.document.documentElement);
  }

  const runRefresh = () => guard(refresh());

  const unsubscribe = options.store.subscribe(() => {
    applied = '';
    runRefresh();
  });

  const retryDelays = [400, 1200, 2500, 5000];
  const retryTimers: Array<ReturnType<typeof setTimeout>> = [];
  const watchTimer = globalThis.setInterval(() => {
    if (stopped || !wantsColumn) return;
    const host = options.document.getElementById('ife-reminder-host');
    const column = options.document.querySelector('[data-ife-column]');
    const placed = host?.classList.contains('ife-overlay') && Number.parseFloat(host.style.width) >= 160;
    if (host?.isConnected && column && placed) {
      const path = `${options.location.pathname}${options.location.search}`;
      if (path === lastPath) return;
      lastPath = path;
    }
    runRefresh();
  }, 2000);
  (watchTimer as { unref?: () => void }).unref?.();

  const ready = whenBody(options.document)
    .then(async () => {
      await refresh();
      for (const delay of retryDelays) {
        const timer = scheduleTimer(() => runRefresh(), delay);
        (timer as { unref?: () => void }).unref?.();
        retryTimers.push(timer);
      }
    })
    .catch((error: unknown) => {
      if (!isStaleContext(error)) throw error;
    });

  return {
    ready,
    refresh,
    stop() {
      stopped = true;
      unsubscribe();
      cancelTimer(refreshTimer);
      cancelTimer(wakeTimer);
      for (const timer of retryTimers) cancelTimer(timer);
      globalThis.clearInterval(watchTimer);
      watchColumn(null);
      if (frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
      options.document.removeEventListener('scroll', reposition, true);
      target.removeEventListener('resize', reposition);
      target.removeEventListener('popstate', onPop);
      target.removeEventListener('yt-navigate-finish', onYouTube);
      try {
        if (push) options.history.pushState = push;
        if (replace) options.history.replaceState = replace;
      } catch {
        // The page may already have replaced these methods.
      }
      clearMarks(options.document);
    },
  };
}
