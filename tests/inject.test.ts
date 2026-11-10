import { describe, expect, it } from 'vitest';
import {
  CONTENT_SCRIPT_FILE,
  INJECT_SESSION_KEY,
  hostFromTab,
  injectContentIntoOpenTabs,
  injectContentIntoTab,
  injectOpenTabsOncePerSession,
  queryActiveTab,
  type InjectChrome,
  type TabInfo,
  type TabQuery,
} from '../src/background/inject';

function fakeChrome(tabIds: number[], session: Record<string, unknown> = {}): InjectChrome & { injected: number[] } {
  const injected: number[] = [];
  return {
    injected,
    tabs: {
      async query() {
        return tabIds.map((id) => ({ id }));
      },
    },
    scripting: {
      async executeScript(injection) {
        injected.push(injection.target.tabId);
        expect(injection.files).toEqual([CONTENT_SCRIPT_FILE]);
      },
    },
    storage: {
      session: {
        async get(key) {
          return { [key]: session[key] };
        },
        async set(items) {
          Object.assign(session, items);
        },
      },
    },
  };
}

describe('open-tab inject', () => {
  it('injects the content script into matching open tabs', async () => {
    const api = fakeChrome([11, 22]);
    await expect(injectContentIntoOpenTabs(api)).resolves.toBe(2);
    expect(api.injected).toEqual([11, 22]);
  });

  it('reads Instagram from the last focused tab when the popup is the current window', async () => {
    const api: InjectChrome = {
      tabs: {
        async query(info: TabQuery) {
          if (info.lastFocusedWindow) {
            return [{ id: 9, pendingUrl: 'https://www.instagram.com/' }];
          }
          return [];
        },
      },
    };
    const tab = await queryActiveTab(api);
    expect(hostFromTab(tab)).toBe('www.instagram.com');
  });

  it('still injects when injectImmediately is not supported', async () => {
    const injected: number[] = [];
    const api: InjectChrome = {
      tabs: { async query() { return []; } },
      scripting: {
        async executeScript(injection) {
          if (injection.injectImmediately) throw new Error('unsupported');
          injected.push(injection.target.tabId);
        },
      },
    };
    await expect(injectContentIntoTab(api, 4, 'www.instagram.com')).resolves.toBe(true);
    expect(injected).toEqual([4]);
  });

  it('finds site tabs when a url-filtered query returns nothing', async () => {
    const injected: number[] = [];
    const api: InjectChrome = {
      tabs: {
        async query(info: TabQuery) {
          if (info.url) return [];
          return [{ id: 3, url: 'https://www.instagram.com/' }] satisfies TabInfo[];
        },
      },
      scripting: {
        async executeScript(injection) {
          injected.push(injection.target.tabId);
        },
      },
    };
    await expect(injectContentIntoOpenTabs(api)).resolves.toBe(1);
    expect(injected).toEqual([3]);
  });

  it('runs once per session so a worker wake does not inject again', async () => {
    const session: Record<string, unknown> = {};
    const first = fakeChrome([5], session);
    await injectOpenTabsOncePerSession(first, 0);
    expect(first.injected).toEqual([5]);
    expect(session[INJECT_SESSION_KEY]).toBe(true);
    const second = fakeChrome([5, 6], session);
    await injectOpenTabsOncePerSession(second, 0);
    expect(second.injected).toEqual([]);
  });
});
