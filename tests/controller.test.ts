import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';
import { startController } from '../src/content/controller';
import { defaultSettings } from '../src/shared/settings';
import { createMemoryStore } from '../src/shared/storage';
import type { SiteDefinition } from '../src/shared/sites/types';

const site: SiteDefinition = {
  id: 'youtube',
  title: 'YouTube',
  hosts: ['www.youtube.com'],
  regions: [
    {
      id: 'home-feed',
      title: 'Home',
      description: 'Home feed',
      defaultEnabled: true,
      paths: ['/'],
      placement: 'primary',
      mountSelectors: ['#feed'],
      selectors: ['.posts'],
    },
  ],
};

function stubBox(element: Element | null, width: number, left: number): Element {
  if (!element) throw new Error('missing column');
  element.getBoundingClientRect = () =>
    ({ x: left, y: 80, left, top: 80, right: left + width, bottom: 900, width, height: 820, toJSON() {} }) as DOMRect;
  return element;
}

function page(pathname: string) {
  const { document, window } = parseHTML(
    '<!doctype html><html><head></head><body><div id="feed"><div class="posts">A video</div></div></body></html>',
  );
  const location = {
    hostname: 'www.youtube.com',
    pathname,
    href: `https://www.youtube.com${pathname}`,
  } as Location;
  const history = {
    pushState() {},
    replaceState() {},
  } as unknown as History;
  return { document, window, location, history };
}

describe('feed controller', () => {
  it('hides the feed with css, keeps the post in the dom, and restores it when disabled', async () => {
    const { document, window, location, history } = page('/');
    const store = createMemoryStore(defaultSettings());
    const controller = startController({
      document,
      location,
      history,
      store,
      sites: [site],
      windowTarget: window,
      now: () => 1_000,
    });
    await controller.ready;
    expect(document.documentElement.classList.contains('ife-r-youtube-home-feed')).toBe(true);
    expect(document.getElementById('ife-style')?.textContent).toContain('.posts');
    expect(document.querySelector('.posts')?.textContent).toBe('A video');
    expect(document.getElementById('ife-reminder-host')).toBeTruthy();
    const arabic = document.getElementById('ife-reminder-host')?.shadowRoot?.querySelector('.ife-arabic')
      ?? document.getElementById('ife-reminder-host')?.querySelector('.ife-arabic');
    expect(arabic?.textContent?.length).toBeGreaterThan(5);

    await store.update((current) => ({ ...current, globalEnabled: false }));
    await controller.refresh();
    expect(document.documentElement.classList.contains('ife-r-youtube-home-feed')).toBe(false);
    expect(document.getElementById('ife-reminder-host')).toBeNull();
    expect(document.querySelector('.posts')).toBeTruthy();
    controller.stop();
  });

  it('shows the feed again during snooze and can resume', async () => {
    const { document, window, location, history } = page('/');
    const settings = defaultSettings();
    settings.snoozeUntil = 5_000;
    const store = createMemoryStore(settings);
    const controller = startController({
      document,
      location,
      history,
      store,
      sites: [site],
      windowTarget: window,
      now: () => 1_000,
    });
    await controller.ready;
    expect(document.getElementById('ife-reminder-host')).toBeNull();
    expect(document.getElementById('ife-snooze-host')).toBeNull();
    expect(document.querySelector('.posts')?.textContent).toBe('A video');
    expect(document.documentElement.className).not.toContain('ife-r-');
    await store.update((current) => ({ ...current, snoozeUntil: null }));
    await controller.refresh();
    expect(document.getElementById('ife-reminder-host')).toBeTruthy();
    controller.stop();
  });

  it('floats the YouTube reminder over the feed column instead of the browse grid', async () => {
    const { document, window } = parseHTML(
      '<!doctype html><html><body><ytd-masthead id="masthead"></ytd-masthead><ytd-browse page-subtype="home"><div id="primary"><div class="posts">A video</div></div></ytd-browse></body></html>',
    );
    const masthead = document.getElementById('masthead');
    if (masthead) {
      masthead.getBoundingClientRect = () =>
        ({ x: 0, y: 0, left: 0, top: 0, right: 1280, bottom: 56, width: 1280, height: 56, toJSON() {} }) as DOMRect;
    }
    const column = stubBox(document.getElementById('primary'), 860, 240);
    const location = { hostname: 'www.youtube.com', pathname: '/', href: 'https://www.youtube.com/' } as Location;
    const history = { pushState() {}, replaceState() {} } as unknown as History;
    const controller = startController({
      document,
      location,
      history,
      store: createMemoryStore(defaultSettings()),
      sites: [
        {
          ...site,
          regions: [{ ...site.regions[0], replaceColumn: true, mountSelectors: ['ytd-browse[page-subtype="home"] #primary'] }],
        },
      ],
      windowTarget: window,
      now: () => 1_000,
    });
    await controller.ready;
    const host = document.getElementById('ife-reminder-host');
    expect(host?.parentElement).toBe(document.body);
    expect(host?.classList.contains('ife-overlay')).toBe(true);
    expect(host?.style.width).toBe('860px');
    expect(Number.parseFloat(host?.style.top ?? '0')).toBeGreaterThanOrEqual(104);
    expect(column?.getAttribute('data-ife-column')).toBe('');
    expect(document.querySelector('.posts')?.textContent).toBe('A video');
    controller.stop();
  });

  it('places the Facebook reminder on the feed column and leaves the side rail alone', async () => {
    const { document, window } = parseHTML(
      '<!doctype html><html><body><div role="main"><div id="column"><div id="composer">What is on your mind</div><div role="feed"><div class="posts">A post</div></div></div><div id="rail">Sponsored</div></div><div id="chat" data-pagelet="ChatTab">Chat</div></body></html>',
    );
    const column = stubBox(document.getElementById('column'), 620, 360);
    const chat = document.getElementById('chat');
    if (chat) {
      chat.getBoundingClientRect = () =>
        ({ x: 360, y: 740, left: 360, top: 740, right: 980, bottom: 800, width: 620, height: 60, toJSON() {} }) as DOMRect;
    }
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    const location = { hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/' } as Location;
    const history = { pushState() {}, replaceState() {} } as unknown as History;
    const controller = startController({
      document,
      location,
      history,
      store: createMemoryStore(defaultSettings()),
      sites: [
        {
          id: 'facebook',
          title: 'Facebook',
          hosts: ['www.facebook.com'],
          regions: [
            {
              id: 'home-feed',
              title: 'Home',
              description: 'Home feed',
              defaultEnabled: true,
              paths: ['/'],
              placement: 'primary',
              replaceColumn: true,
              anchor: 'feed-column',
              mountSelectors: ['[role="main"]'],
              selectors: ['[role="main"] [role="feed"]'],
            },
          ],
        },
      ],
      windowTarget: window,
      now: () => 1_000,
    });
    await controller.ready;
    const host = document.getElementById('ife-reminder-host');
    expect(host?.parentElement).toBe(document.body);
    expect(host?.style.width).toBe('620px');
    expect(host?.style.left).toBe('360px');
    const cardBottom = Number.parseFloat(host?.style.top ?? '0') + Number.parseFloat(host?.style.maxHeight ?? '0');
    expect(cardBottom).toBeGreaterThan(740);
    expect(document.getElementById('chat')?.textContent).toBe('Chat');
    expect(column?.getAttribute('data-ife-column')).toBe('');
    expect(document.getElementById('rail')?.getAttribute('data-ife-column')).toBeNull();
    expect(document.getElementById('composer')?.textContent).toBe('What is on your mind');
    expect(column?.contains(host)).toBe(false);
    controller.stop();
  });

  it('keeps the same reminder when another tab writes to storage', async () => {
    const { document, window, location, history } = page('/');
    const store = createMemoryStore(defaultSettings());
    const controller = startController({
      document,
      location,
      history,
      store,
      sites: [site],
      windowTarget: window,
      now: () => 1_000,
    });
    await controller.ready;
    const shown = (await store.load()).cursors.youtube?.reminderId;
    expect(shown).toBeTruthy();
    await store.update((current) => ({
      ...current,
      cursors: {
        ...current.cursors,
        facebook: { reminderId: 'facebook-reminder', lastPath: 'www.facebook.com/', lastAdvancedAt: 2_000 },
      },
    }));
    await controller.refresh();
    const after = await store.load();
    expect(after.cursors.youtube?.reminderId).toBe(shown);
    expect(after.cursors.facebook?.reminderId).toBe('facebook-reminder');
    expect(after.cursors.facebook?.lastPath).toBe('www.facebook.com/');
    controller.stop();
  });

  it('leaves the home feed alone on a watch URL', async () => {
    const { document, window, location, history } = page('/watch');
    const store = createMemoryStore(defaultSettings());
    const controller = startController({
      document,
      location,
      history,
      store,
      sites: [site],
      windowTarget: window,
      now: () => 1_000,
    });
    await controller.ready;
    expect(document.documentElement.classList.contains('ife-r-youtube-home-feed')).toBe(false);
    expect(document.getElementById('ife-reminder-host')).toBeNull();
    expect(document.querySelector('.posts')?.textContent).toBe('A video');
    controller.stop();
  });
});
