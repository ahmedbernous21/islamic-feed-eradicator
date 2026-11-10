import { findSite } from '../shared/sites';

export const CONTENT_SCRIPT_FILE = 'content.js';
export const INJECT_SESSION_KEY = 'ife-injected-open-tabs';

export const OPEN_TAB_URLS = [
  'https://www.youtube.com/*',
  'https://youtube.com/*',
  'https://www.facebook.com/*',
  'https://web.facebook.com/*',
  'https://facebook.com/*',
  'https://www.linkedin.com/*',
  'https://linkedin.com/*',
  'https://www.instagram.com/*',
  'https://instagram.com/*',
] as const;

export type TabInfo = { id?: number; url?: string; pendingUrl?: string };

export type TabQuery = {
  url?: string[];
  active?: boolean;
  currentWindow?: boolean;
  lastFocusedWindow?: boolean;
};

export type InjectChrome = {
  tabs: {
    query: (queryInfo: TabQuery) => Promise<TabInfo[]>;
  };
  scripting?: {
    executeScript: (injection: {
      target: { tabId: number };
      files: string[];
      injectImmediately?: boolean;
    }) => Promise<unknown>;
  };
  storage?: {
    session?: {
      get: (key: string) => Promise<Record<string, unknown>>;
      set: (items: Record<string, unknown>) => Promise<void>;
    };
  };
};

export function hostFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host || null;
  } catch {
    return null;
  }
}

export function hostFromTab(tab: TabInfo | null | undefined): string | null {
  return hostFromUrl(tab?.url) ?? hostFromUrl(tab?.pendingUrl);
}

function isSupportedTab(tab: TabInfo): boolean {
  const host = hostFromTab(tab);
  return Boolean(host && findSite(host));
}

async function queryTabs(api: InjectChrome, queryInfo: TabQuery): Promise<TabInfo[]> {
  try {
    return await api.tabs.query(queryInfo);
  } catch {
    return [];
  }
}

/** Edge often treats the popup as currentWindow, so lastFocusedWindow is first. */
export async function queryActiveTab(api: InjectChrome): Promise<TabInfo | null> {
  const queries: TabQuery[] = [
    { active: true, lastFocusedWindow: true },
    { active: true, currentWindow: true },
    { active: true },
  ];
  for (const query of queries) {
    const tabs = await queryTabs(api, query);
    const match = tabs.find((tab) => typeof tab.id === 'number') ?? tabs[0];
    if (match) return match;
  }
  return null;
}

export async function injectContentIntoTab(api: InjectChrome, tabId: number, host?: string | null): Promise<boolean> {
  if (host && !findSite(host)) return false;
  const execute = api.scripting?.executeScript;
  if (!execute) return false;
  try {
    await execute({
      target: { tabId },
      files: [CONTENT_SCRIPT_FILE],
      injectImmediately: true,
    });
    return true;
  } catch {
    try {
      await execute({
        target: { tabId },
        files: [CONTENT_SCRIPT_FILE],
      });
      return true;
    } catch {
      return false;
    }
  }
}

async function listSiteTabs(api: InjectChrome): Promise<TabInfo[]> {
  const byUrl = await queryTabs(api, { url: [...OPEN_TAB_URLS] });
  if (byUrl.length) return byUrl;
  return (await queryTabs(api, {})).filter(isSupportedTab);
}

/** Put the content script back on already-open site tabs after enable or update. */
export async function injectContentIntoOpenTabs(api: InjectChrome): Promise<number> {
  const tabs = await listSiteTabs(api);
  let injected = 0;
  for (const tab of tabs) {
    if (typeof tab.id !== 'number') continue;
    if (await injectContentIntoTab(api, tab.id, hostFromTab(tab))) injected += 1;
  }
  return injected;
}

/**
 * Chrome and Edge do not always re-run content scripts when the user turns the
 * extension back on. Do that once per browser session; later worker wakes skip it.
 */
export async function injectOpenTabsOncePerSession(api: InjectChrome, retryMs = 1500): Promise<void> {
  const session = api.storage?.session;
  if (session) {
    try {
      const stored = await session.get(INJECT_SESSION_KEY);
      if (stored[INJECT_SESSION_KEY]) return;
      await session.set({ [INJECT_SESSION_KEY]: true });
    } catch {
      // Older browsers can omit session storage. Inject anyway.
    }
  }
  await injectContentIntoOpenTabs(api);
  if (retryMs > 0) {
    globalThis.setTimeout(() => {
      void injectContentIntoOpenTabs(api);
    }, retryMs);
  }
}
