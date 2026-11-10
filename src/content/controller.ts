import { buildReportUrl } from '../shared/community/submission';
import { advanceCursor, citation, collectReminders, moveCursor, reminderById, toggleFavorite } from '../shared/reminders/engine';
import { hostMatches, pathMatches } from '../shared/paths';
import { isSnoozing, resolveCardTheme, type Settings } from '../shared/settings';
import { track } from '../shared/telemetry';
import type { SettingsStore } from '../shared/storage';
import { buildPageCss, regionClass } from '../shared/sites/css';
import { SITES } from '../shared/sites';
import type { RegionDefinition, SiteDefinition, SiteId } from '../shared/sites/types';
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

function hostHasCard(host: HTMLElement | null): boolean {
  if (!host?.isConnected) return false;
  return Boolean((host.shadowRoot ?? host).querySelector('.ife-card'));
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

function isVisiblyCurrent(element: Element): boolean {
  if (!isUsableMount(element) || isUnmeasured(element)) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width < 200 || rect.height < 160) return false;
  const viewportH = element.ownerDocument.defaultView?.innerHeight || 800;
  if (rect.bottom <= 96 || rect.top >= viewportH - 40) return false;
  return true;
}

function youtubeSearchOpen(doc: Document, pathname: string): boolean {
  if (pathMatches(pathname, ['/watch', '/watch/*', '/shorts', '/shorts/*'])) return false;
  if (pathMatches(pathname, ['/results', '/results/*', '/search', '/search/*'])) return true;
  const search =
    query(doc, 'ytd-search') ?? query(doc, 'ytd-two-column-search-results-renderer');
  if (!search || !isVisiblyCurrent(search)) return false;
  const home =
    query(doc, 'ytd-browse[page-subtype="home"] #primary') ?? query(doc, 'ytd-browse[page-subtype="home"]');
  if (home && isVisiblyCurrent(home)) return false;
  return true;
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
  '[data-pagelet="Feed"]',
  '[data-pagelet="FeedUnit"]',
  '[data-pagelet^="FeedUnit"]',
  '[aria-label="News Feed"]',
  '[data-pagelet="Stories"]',
  '[role="article"]',
  '[aria-posinset]',
  '[data-testid="mainFeed"]',
  '[data-view-name="feed-full-update"]',
  '.feed-shared-update-v2',
];

function queryAll(doc: ParentNode, selector: string): Element[] {
  try {
    return [...doc.querySelectorAll(selector)];
  } catch {
    return [];
  }
}

function area(element: Element): number {
  const rect = element.getBoundingClientRect();
  return Math.max(0, rect.width) * Math.max(0, rect.height);
}

function isUnmeasured(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.left === 0;
}

function isUsableMount(element: Element, allowComputedHide = false): boolean {
  if (!element.isConnected) return false;
  let node: Element | null = element;
  while (node) {
    if ((node as HTMLElement).hidden || node.hasAttribute('hidden')) return false;
    try {
      const style = node.ownerDocument.defaultView?.getComputedStyle?.(node);
      if (style && (style.display === 'none' || style.visibility === 'hidden')) {
        // Our hide CSS can target the same node we mount on. Keep it as an
        // anchor so the card is not dropped after the feed is hidden.
        if (!allowComputedHide || node !== element) return false;
      }
    } catch {
      // linkedom may omit computed style.
    }
    node = node.parentElement;
  }
  if (isUnmeasured(element) || allowComputedHide) return true;
  const rect = element.getBoundingClientRect();
  return rect.width >= 80 && rect.height >= 40;
}

/** Compact cards belong in the right-hand column, not the whole watch page. */
function isCompactColumn(element: Element): boolean {
  if (!element.isConnected) return false;
  if (element.id === 'secondary' || element.hasAttribute('data-ife-column')) return true;
  if (!isUsableMount(element)) return false;
  if (isUnmeasured(element)) return true;
  const rect = element.getBoundingClientRect();
  if (rect.width > 640) return false;
  const viewportW = element.ownerDocument.defaultView?.innerWidth ?? 0;
  return !viewportW || viewportW < 800 || rect.width <= viewportW * 0.45;
}

function pickMount(candidates: Element[], compact = false, allowComputedHide = false): Element | null {
  const unique = [...new Set(candidates)];
  const usable = unique.filter((item) => (compact ? isCompactColumn(item) : isUsableMount(item, allowComputedHide)));
  if (!usable.length) return null;
  if (compact) {
    return [...usable].sort((left, right) => right.getBoundingClientRect().left - left.getBoundingClientRect().left)[0] ?? null;
  }
  return [...usable].sort((left, right) => area(right) - area(left))[0] ?? null;
}

function findFeedColumn(root: Element): Element | null {
  for (const selector of FEED_ANCHORS) {
    try {
      if (root.matches(selector)) return root;
    } catch {
      // Invalid selector.
    }
    const anchor = root.querySelector(selector);
    if (!anchor) continue;
    let node: Element = anchor;
    while (node.parentElement && node.parentElement !== root) node = node.parentElement;
    if (node !== root) return node;
  }
  return null;
}

const HEADER_SELECTORS = ['#masthead-container', '#masthead', 'ytd-masthead', 'tp-yt-app-header', '#global-nav', 'header.global-nav', '[role="banner"]', 'header'];

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

function hiddenByRegion(element: Element, region: RegionDefinition): boolean {
  return region.selectors.some((selector) => {
    try {
      return element.matches(selector);
    } catch {
      return false;
    }
  });
}

function findMount(doc: Document, region: RegionDefinition): Element | null {
  const fromMount: Element[] = [];
  for (const selector of region.mountSelectors ?? []) {
    for (const found of queryAll(doc, selector)) {
      if (region.anchor === 'feed-column') {
        fromMount.push(findFeedColumn(found) ?? found);
      } else {
        fromMount.push(found);
      }
    }
  }
  const compact = region.placement === 'compact';
  const picked = pickMount(fromMount, compact, true);
  if (picked && (compact ? isCompactColumn(picked) : isUsableMount(picked, true))) return picked;
  const fromFeed: Element[] = [];
  for (const selector of region.selectors) {
    for (const found of queryAll(doc, selector)) {
      const parent = found.parentElement;
      if (!parent || hiddenByRegion(parent, region)) continue;
      fromFeed.push(parent);
    }
  }
  const fallback = pickMount(fromFeed, compact, true);
  if (fallback && (compact ? isCompactColumn(fallback) : isUsableMount(fallback, true))) return fallback;
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

function markColumn(column: HTMLElement, lock = true): void {
  if (lock) {
    const width = Math.round(columnBox(column).width);
    if (width >= 160) column.style.minWidth = `${width}px`;
    column.style.minHeight = '70vh';
  } else {
    column.style.minHeight = '';
  }
  column.setAttribute('data-ife-column', '');
}

/** How long the feed column must keep the same place and size before the card is shown. */
const SETTLE_MS = 400;
/** Show the card anyway if the site keeps changing the column for this long. */
const SETTLE_MAX_MS = 2500;

function boxKey(column: Element): string {
  const box = columnBox(column);
  const snap = (value: number) => Math.round(value / 24) * 24;
  return `${snap(box.left)}:${snap(box.top)}:${snap(box.width)}`;
}

function watchFreeLeft(doc: Document, viewportW: number): number {
  const video =
    query(doc, '#movie_player video') ??
    query(doc, '.html5-video-player video') ??
    query(doc, 'ytd-player video') ??
    query(doc, 'ytd-watch-flexy video');
  if (video) {
    const rect = video.getBoundingClientRect();
    if (rect.width >= 240 && rect.right < viewportW - 200) return Math.round(rect.right);
  }
  const primary = query(doc, '#primary') ?? query(doc, 'ytd-player') ?? query(doc, '#player');
  if (primary) {
    const rect = primary.getBoundingClientRect();
    if (rect.width >= 240 && rect.right < viewportW - 160) return Math.round(rect.right);
  }
  return Math.round(viewportW * 0.58);
}

function placeWatchRail(host: HTMLElement, doc: Document, _column: Element | null, lockKey: string | null): string {
  host.classList.add('ife-overlay', 'ife-sidebar');
  host.classList.remove('ife-pending', 'ife-settling');
  const viewportW = doc.defaultView?.innerWidth || 1200;
  const viewportH = doc.defaultView?.innerHeight || 800;
  const top = Math.max(headerBottom(doc), 56);
  const height = Math.max(viewportH - top, 240);
  const left = Math.max(0, watchFreeLeft(doc, viewportW));
  const width = Math.max(viewportW - left, 320);
  const key = `${viewportW}x${viewportH}`;
  if (lockKey === key && Number.parseFloat(host.style.width) >= 280 && host.style.left) {
    const prevLeft = Number.parseFloat(host.style.left);
    const prevWidth = Number.parseFloat(host.style.width);
    if (Math.abs(prevLeft - left) < 32 && Math.abs(prevWidth - width) < 32) {
      if (Math.abs(Number.parseFloat(host.style.top) - top) >= 8) {
        host.style.top = `${Math.round(top)}px`;
        host.style.height = `${Math.round(height)}px`;
        host.style.maxHeight = `${Math.round(height)}px`;
      }
      return key;
    }
  }
  host.style.left = `${Math.round(left)}px`;
  host.style.top = `${Math.round(top)}px`;
  host.style.width = `${Math.round(width)}px`;
  host.style.height = `${Math.round(height)}px`;
  host.style.maxHeight = `${Math.round(height)}px`;
  return key;
}

function placeOverlay(host: HTMLElement, column: Element, siteId: string, reveal = true): void {
  host.classList.add('ife-overlay');
  host.classList.remove('ife-sidebar');
  const rect = columnBox(column);
  if (rect.width < 160) {
    // The column can collapse for a frame while the site lays out. Keep a card
    // that is already showing where it was instead of hiding it.
    if (reveal && host.style.width && !host.classList.contains('ife-pending')) return;
    host.classList.add('ife-pending');
    return;
  }
  host.classList.toggle('ife-pending', !reveal);
  const doc = column.ownerDocument;
  const viewport = doc.defaultView?.innerHeight || 800;
  const headerGap = siteId === 'youtube' ? 48 : 12;
  const minimumTop = siteId === 'youtube' ? 104 : 12;
  const top = Math.max(rect.top, headerBottom(doc) + headerGap, minimumTop);
  const bottom = Math.min(rect.bottom, viewport - 16);
  const width = rect.width;
  host.style.left = `${Math.round(rect.left)}px`;
  host.style.top = `${Math.round(top)}px`;
  host.style.width = `${Math.round(width)}px`;
  host.style.height = '';
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
  let wantsHost = false;
  let activeSiteId = sites.find((item) => hostMatches(options.location.hostname, item.hosts))?.id ?? '';
  let refreshTimer: ReturnType<typeof setTimeout> | 0 = 0;
  let wakeTimer: ReturnType<typeof setTimeout> | 0 = 0;
  let applied = '';
  let renderedPath: string | null = null;
  let keptHost: HTMLElement | null = null;
  let settleMount: Element | null = null;
  let settleBox = '';
  let settleSince = 0;
  let settleStartedAt = 0;
  let settled = false;
  let settlePath: string | null = null;
  let settleTimer: ReturnType<typeof setTimeout> | 0 = 0;
  let visibleSince = 0;
  let visibleSite: SiteId | null = null;
  let hostObserver: MutationObserver | null = null;
  let railKey: string | null = null;
  const scheduleTimer = (callback: () => void, delay: number) => globalThis.setTimeout(callback, delay);
  const cancelTimer = (timer: ReturnType<typeof setTimeout> | 0) => globalThis.clearTimeout(timer);

  function dropHost(): void {
    wantsHost = false;
    hostObserver?.disconnect();
    hostObserver = null;
    railKey = null;
    settlePath = null;
    settled = false;
    settleMount = null;
    settleBox = '';
    const host = (options.document.getElementById('ife-reminder-host') as HTMLElement | null) ?? keptHost;
    host?.remove();
    keptHost = null;
  }

  let youtubeReloadArmed = false;
  function reloadYouTubeFeed(hadReminder: boolean, site: SiteDefinition | undefined): void {
    if (youtubeReloadArmed || !hadReminder || site?.id !== 'youtube') return;
    if (typeof options.location.reload !== 'function') return;
    youtubeReloadArmed = true;
    options.location.reload();
  }

  function overlayAllowedOnThisPage(): boolean {
    const site = sites.find((item) => hostMatches(options.location.hostname, item.hosts));
    if (!site) return false;
    return site.regions.some((region) => Boolean(region.overlay) && pathMatches(options.location.pathname, region.paths));
  }

  const flushVisible = (resume: boolean) => {
    if (!visibleSince || !visibleSite) {
      if (!resume) {
        visibleSince = 0;
        visibleSite = null;
      }
      return;
    }
    const ms = now() - visibleSince;
    const siteId = visibleSite;
    if (resume) visibleSince = now();
    else {
      visibleSince = 0;
      visibleSite = null;
    }
    if (ms >= 1000) track({ name: 'visible', site: siteId, ms });
  };

  const startVisible = (siteId: SiteId) => {
    if (options.document.visibilityState === 'hidden') {
      flushVisible(false);
      return;
    }
    if (visibleSite === siteId && visibleSince) return;
    flushVisible(false);
    visibleSite = siteId;
    visibleSince = now();
  };

  function applyHideCss(site: SiteDefinition, settings: Settings, pathname: string, placement: RegionDefinition | null): string {
    const regions = activeRegions(site, settings, pathname);
    const cssRegions = regions.filter((region) => region.placement === 'none' || Boolean(placement));
    const css = buildPageCss(
      cssRegions.map((region) => ({
        className: regionClass(site.id, region.id),
        selectors: region.selectors,
      })),
    );
    let style = options.document.getElementById('ife-style') as HTMLStyleElement | null;
    if (!style) {
      style = options.document.createElement('style');
      style.id = 'ife-style';
      (options.document.head ?? options.document.documentElement).append(style);
    }
    if (style.textContent !== css) style.textContent = css;
    const html = options.document.documentElement;
    const desired = new Set(cssRegions.map((region) => regionClass(site.id, region.id)));
    for (const className of [...html.classList]) {
      if (className.startsWith('ife-') && !desired.has(className)) html.classList.remove(className);
    }
    for (const className of desired) html.classList.add(className);
    return css;
  }

  async function paintEarly(): Promise<void> {
    if (stopped) return;
    const loaded = await options.store.load();
    const site = sites.find((item) => hostMatches(options.location.hostname, item.hosts));
    if (!site || !loaded.globalEnabled || !loaded.sites[site.id]?.enabled || isSnoozing(loaded, now())) return;
    const regions = activeRegions(site, loaded, options.location.pathname);
    let placement = reminderRegion(regions);
    if (site.id === 'youtube' && youtubeSearchOpen(options.document, options.location.pathname)) placement = null;
    applyHideCss(site, loaded, options.location.pathname, placement);
  }

  const refresh = async () => {
    // Another tab can write to storage before this page has a body. The ready
    // path runs the first real refresh once the body exists.
    if (stopped || !options.document.body) return;
    const loaded = await options.store.load();
    const site = sites.find((item) => hostMatches(options.location.hostname, item.hosts));
    activeSiteId = site?.id ?? '';
    const pathKey = `${options.location.hostname}${options.location.pathname}`;
    if (!site || !loaded.globalEnabled || !loaded.sites[site.id]?.enabled) {
      const hadReminder = Boolean(options.document.getElementById('ife-reminder-host') ?? keptHost);
      applied = '';
      wantsColumn = false;
      flushVisible(false);
      dropHost();
      clearMarks(options.document);
      // YouTube does not lay out a grid that stayed display:none. Reload so the
      // feed (and the card after enable) can come back.
      reloadYouTubeFeed(hadReminder, site);
      return;
    }

    if (isSnoozing(loaded, now())) {
      const hadReminder = Boolean(options.document.getElementById('ife-reminder-host') ?? keptHost);
      applied = '';
      wantsColumn = false;
      flushVisible(false);
      dropHost();
      clearMarks(options.document);
      cancelTimer(wakeTimer);
      wakeTimer = scheduleTimer(() => guard(refresh()), Math.max(1000, (loaded.snoozeUntil ?? now()) - now() + 50));
      reloadYouTubeFeed(hadReminder, site);
      return;
    }

    const regions = activeRegions(site, loaded, options.location.pathname);
    let placement = reminderRegion(regions);
    if (site.id === 'youtube' && youtubeSearchOpen(options.document, options.location.pathname)) {
      placement = null;
    }
    const existingHost = (options.document.getElementById('ife-reminder-host') as HTMLElement | null) ?? keptHost;
    const keepHost = hostHasCard(existingHost) && Boolean(existingHost?.isConnected);
    const keepInColumn = keepHost && !existingHost?.classList.contains('ife-overlay');
    const mount = placement ? findMount(options.document, placement) : null;
    const panel = Boolean(placement?.placement === 'compact');
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
            [site.id]: {
              reminderId: latest.cursor.reminderId,
              lastPath: pathKey,
              lastAdvancedAt: now(),
              seenIds: latest.cursor.seenIds ?? [],
              history: latest.cursor.history ?? [],
            },
          },
        };
      });
    }
    const reminders = collectReminders(settings);
    const reminder = reminderById(reminders, settings.cursors[site.id]?.reminderId ?? null) ?? reminders[0] ?? null;
    const css = applyHideCss(site, settings, options.location.pathname, placement);
    const cardTheme = resolveCardTheme(settings.theme, options.document);
    const signature = JSON.stringify({
      css,
      id: reminder?.id ?? null,
      theme: cardTheme,
      showTranslation: settings.showTranslation,
      favorite: reminder ? settings.favorites.includes(reminder.id) : false,
      compact: false,
      panel: placement?.placement === 'compact',
      path: options.location.pathname,
      snoozeMinutes: settings.snoozeMinutes,
    });
    options.document.getElementById('ife-snooze-host')?.remove();

    if (!placement) {
      wantsColumn = false;
      flushVisible(false);
      dropHost();
      clearColumn(options.document);
      applied = signature;
      return;
    }
    wantsColumn = Boolean(placement.replaceColumn || placement.insert === 'before');

    if (!mount) {
      if (keepInColumn && existingHost) {
        wantsHost = true;
        watchHost(existingHost);
        startVisible(site.id);
        applied = signature;
        return;
      }
      flushVisible(false);
      dropHost();
      clearColumn(options.document);
      applied = '';
      return;
    }
    wantsHost = true;
    // Facebook may drop the card while it rebuilds the feed. Reuse the same
    // element so it is moved back in place instead of drawn again.
    let host = (options.document.getElementById('ife-reminder-host') as HTMLElement | null) ?? keptHost;
    if (!host) {
      host = options.document.createElement('div');
      host.id = 'ife-reminder-host';
    }
    keptHost = host;
    const settle = Boolean(placement.replaceColumn && mount && !panel);
    if (settle && mount) {
      const at = now();
      if (settlePath !== pathKey) {
        settlePath = pathKey;
        settled = false;
        settleMount = null;
        settleBox = '';
        settleStartedAt = at;
      }
      const box = boxKey(mount);
      if (mount !== settleMount || box !== settleBox) {
        settleMount = mount;
        settleBox = box;
        settleSince = at;
      }
      if (!settled && (at - settleSince >= SETTLE_MS || at - settleStartedAt >= SETTLE_MAX_MS)) settled = true;
      if (!settled) {
        cancelTimer(settleTimer);
        settleTimer = scheduleTimer(() => {
          settleTimer = 0;
          runRefresh();
        }, SETTLE_MS);
      }
    }
    if (placement.replaceColumn && placement.overlay) {
      // Overlay sits on the page, not inside the column. Collapsing the
      // column with data-ife-column is what made YouTube jump on first load.
      clearColumn(options.document);
      host.classList.remove('ife-settling', 'ife-sidebar');
      if (host.parentElement !== options.document.body) {
        host.classList.add('ife-overlay', 'ife-pending');
        options.document.body?.append(host);
      }
      placeOverlay(host, mount, site.id, settled);
      watchColumn(mount);
    } else if (placement.replaceColumn) {
      const current = options.document.querySelector('[data-ife-column]');
      if (current && current !== mount) clearColumn(options.document);
      const lockColumn = Boolean(panel || !settle || settled);
      if (lockColumn) {
        markColumn(mount as HTMLElement, true);
      } else {
        const column = mount as HTMLElement;
        if (column.hasAttribute('data-ife-column')) {
          column.removeAttribute('data-ife-column');
          column.style.minWidth = '';
          column.style.minHeight = '';
        }
      }
      host.classList.toggle('ife-settling', Boolean(settle && !settled && !panel));
      host.classList.toggle('ife-sidebar', panel);
      host.classList.remove('ife-overlay', 'ife-pending');
      host.style.left = '';
      host.style.top = '';
      host.style.width = '';
      host.style.height = '';
      host.style.maxHeight = '';
      if (host.parentElement !== mount) mount.prepend(host);
      watchColumn(null);
    } else {
      clearColumn(options.document);
      watchColumn(null);
      host.classList.remove('ife-overlay', 'ife-sidebar', 'ife-pending', 'ife-settling');
      host.style.left = '';
      host.style.top = '';
      host.style.width = '';
      host.style.height = '';
      host.style.maxHeight = '';
      if (placement.insert === 'before') {
        if (host.nextElementSibling !== mount) mount.before(host);
      } else if (host.parentElement !== mount) {
        mount.prepend(host);
      }
    }
    if (applied === signature && hostHasCard(host)) return;
    const path = pathKey;
    renderReminder(
      host,
      {
        reminder,
        showTranslation: settings.showTranslation,
        theme: cardTheme,
        favorite: reminder ? settings.favorites.includes(reminder.id) : false,
        compact: false,
        panel,
        emptyMessage: settings.favoritesOnly
          ? 'No favorite reminders yet. Save one from a reminder card, or turn off favorites-only in settings.'
          : 'No reminders match the categories you have enabled. Turn a category back on in the extension settings.',
      },
      {
        onPrevious: () => {
          track({ name: 'action', action: 'previous' });
          guard(options.store.update((current) => moveCursor(current, 'previous', path, now(), undefined, site.id)));
        },
        onNext: () => {
          track({ name: 'action', action: 'next' });
          guard(options.store.update((current) => moveCursor(current, 'next', path, now(), undefined, site.id)));
        },
        onToggleFavorite: () => {
          if (!reminder) return;
          track({ name: 'action', action: 'favorite' });
          guard(options.store.update((current) => toggleFavorite(current, reminder.id)));
        },
        onToggleTranslation: () =>
          guard(options.store.update((current) => ({ ...current, showTranslation: !current.showTranslation }))),
        onReport: (note) => {
          if (!reminder || reminder.category === 'personal') return;
          globalThis.open(buildReportUrl(reminder.id, citation(reminder), note), '_blank', 'noopener');
        },
        onOpenSettings: () => guard(Promise.resolve(globalThis.chrome?.runtime?.sendMessage({ type: 'ife-open-settings' }))),
      },
    );
    applied = signature;
    watchHost(host);
    startVisible(site.id);
  };

  const schedule = () => {
    cancelTimer(refreshTimer);
    refreshTimer = scheduleTimer(() => guard(refresh()), 150);
  };

  let lastPath = `${options.location.pathname}${options.location.search}`;
  const currentPath = () => `${options.location.pathname}${options.location.search}`;
  const scheduleIfMoved = () => {
    const next = currentPath();
    if (next === lastPath) return;
    lastPath = next;
    applied = '';
    railKey = null;
    schedule();
  };
  // The path is part of the card signature, so a real page change redraws the
  // card on its own. Load events that keep the same page only re-place it.
  const onNavigate = () => {
    lastPath = currentPath();
    railKey = null;
    schedule();
  };

  const onPop = () => {
    lastPath = currentPath();
    applied = '';
    railKey = null;
    settled = false;
    settlePath = null;
    schedule();
  };
  // YouTube fires these many times while the home grid lays out. A full
  // refresh each time is what makes the card jump before it settles.
  const onSoftLayout = () => {
    const next = currentPath();
    if (next !== lastPath) {
      lastPath = next;
      applied = '';
      railKey = null;
      settled = false;
      settlePath = null;
      schedule();
      return;
    }
    if (settled) reposition();
  };
  target.addEventListener('popstate', onPop);
  target.addEventListener('yt-navigate-finish', onSoftLayout);
  target.addEventListener('yt-page-data-updated', onSoftLayout);
  target.addEventListener('pageshow', onSoftLayout);
  options.document.addEventListener('yt-navigate-finish', onSoftLayout);
  options.document.addEventListener('yt-page-data-updated', onSoftLayout);
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
  let sizeObserver: ResizeObserver | null = null;
  let watchedColumn: Element | null = null;
  const reposition = () => {
    if (frame || typeof requestAnimationFrame !== 'function') return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const host = options.document.getElementById('ife-reminder-host') as HTMLElement | null;
      if (!host?.classList.contains('ife-overlay')) return;
      if (host.classList.contains('ife-pending') || host.classList.contains('ife-settling')) return;
      if (host.classList.contains('ife-sidebar')) {
        railKey = placeWatchRail(host, options.document, options.document.querySelector('[data-ife-column]'), railKey);
        return;
      }
      const column = watchedColumn ?? options.document.querySelector('[data-ife-column]');
      if (column) placeOverlay(host, column, activeSiteId, settled);
    });
  };
  options.document.addEventListener('scroll', reposition, true);
  target.addEventListener('resize', reposition);
  const onVisibility = () => {
    if (options.document.visibilityState === 'hidden') flushVisible(false);
    else if (hostHasCard(options.document.getElementById('ife-reminder-host') as HTMLElement | null) && activeSiteId) {
      startVisible(activeSiteId as SiteId);
    }
  };
  options.document.addEventListener('visibilitychange', onVisibility);
  const visibleTimer = globalThis.setInterval(() => {
    if (visibleSince && visibleSite) flushVisible(true);
  }, 30_000);
  (visibleTimer as { unref?: () => void }).unref?.();

  // The feed column changes size while the site finishes loading. Follow it so
  // the card never sits at a stale position or width.
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

  function watchHost(host: HTMLElement): void {
    hostObserver?.disconnect();
    const body = options.document.body;
    if (!body || typeof MutationObserver === 'undefined') return;
    // Sites can drop the card along with a whole section of the page. Put it
    // back straight away so it does not vanish until the next check.
    hostObserver = new MutationObserver(() => {
      if (stopped || !wantsHost || host.isConnected) return;
      if (!settled && settlePath) return;
      if (host.classList.contains('ife-overlay')) {
        options.document.body?.append(host);
      } else {
        options.document.querySelector('[data-ife-column]')?.prepend(host);
      }
      runRefresh();
    });
    hostObserver.observe(body, { childList: true, subtree: true });
  }

  const retryDelays = [100, 300, 800, 1600, 3200, 6000];
  const retryTimers: Array<ReturnType<typeof setTimeout>> = [];
  const watchTimer = globalThis.setInterval(() => {
    if (stopped) return;
    scheduleIfMoved();
    const host = options.document.getElementById('ife-reminder-host') as HTMLElement | null;
    if ((!settled && settlePath) || host?.classList.contains('ife-pending') || host?.classList.contains('ife-settling')) {
      return;
    }
    if (hostHasCard(host) && host?.classList.contains('ife-sidebar') && host.parentElement) return;
    if (hostHasCard(host) && host?.classList.contains('ife-overlay')) {
      if (host.classList.contains('ife-sidebar')) {
        if (!overlayAllowedOnThisPage() || youtubeSearchOpen(options.document, options.location.pathname)) runRefresh();
        return;
      }
      const overlayStale =
        !overlayAllowedOnThisPage() ||
        youtubeSearchOpen(options.document, options.location.pathname) ||
        (watchedColumn !== null && !isUsableMount(watchedColumn)) ||
        Number.parseFloat(host.style.width) < 160;
      if (overlayStale) runRefresh();
      return;
    }
    const mountParent = host?.parentElement;
    if (hostHasCard(host) && mountParent && isUsableMount(mountParent)) return;
    runRefresh();
  }, 400);
  (watchTimer as { unref?: () => void }).unref?.();

  const ready = paintEarly()
    .then(() => whenBody(options.document))
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
      cancelTimer(settleTimer);
      for (const timer of retryTimers) cancelTimer(timer);
      globalThis.clearInterval(watchTimer);
      globalThis.clearInterval(visibleTimer);
      flushVisible(false);
      dropHost();
      watchColumn(null);
      if (frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
      options.document.removeEventListener('scroll', reposition, true);
      options.document.removeEventListener('visibilitychange', onVisibility);
      options.document.removeEventListener('yt-navigate-finish', onSoftLayout);
      options.document.removeEventListener('yt-page-data-updated', onSoftLayout);
      target.removeEventListener('resize', reposition);
      target.removeEventListener('popstate', onPop);
      target.removeEventListener('yt-navigate-finish', onSoftLayout);
      target.removeEventListener('yt-page-data-updated', onSoftLayout);
      target.removeEventListener('pageshow', onSoftLayout);
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
