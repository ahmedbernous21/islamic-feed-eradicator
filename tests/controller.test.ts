import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';
import { startController } from '../src/content/controller';
import { defaultSettings, startSnooze } from '../src/shared/settings';
import { createMemoryStore } from '../src/shared/storage';
import youtube from '../src/shared/sites/youtube';
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
    const host = document.getElementById('ife-reminder-host');
    const arabic = host?.shadowRoot?.querySelector('.ife-arabic') ?? host?.querySelector('.ife-arabic');
    expect(arabic?.textContent?.length).toBeGreaterThan(5);
    const labels = [...(host?.shadowRoot ?? host)?.querySelectorAll('button') ?? []].map((button) => button.textContent);
    expect(labels).not.toContain('Show feed for 10 min');
    expect(labels).toContain('Settings');

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

  it('puts the reminder back after a search page', async () => {
    const { document, window, location, history } = page('/');
    const controller = startController({
      document,
      location,
      history,
      store: createMemoryStore(defaultSettings()),
      sites: [site],
      windowTarget: window,
      now: () => 1_000,
    });
    await controller.ready;
    expect(document.getElementById('ife-reminder-host')).toBeTruthy();
    location.pathname = '/results';
    await controller.refresh();
    expect(document.getElementById('ife-reminder-host')).toBeNull();
    location.pathname = '/';
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
          regions: [{ ...site.regions[0], replaceColumn: true, overlay: true, mountSelectors: ['ytd-browse[page-subtype="home"] #primary'] }],
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

  it('shows the YouTube feed after snooze is started from settings', async () => {
    const { document, window } = parseHTML(
      '<!doctype html><html><body><ytd-browse page-subtype="home"><div id="primary"><div class="posts">A video</div></div></ytd-browse></body></html>',
    );
    stubBox(document.getElementById('primary'), 860, 240);
    let reloads = 0;
    const location = {
      hostname: 'www.youtube.com',
      pathname: '/',
      href: 'https://www.youtube.com/',
      reload() {
        reloads += 1;
      },
    } as Location;
    const history = { pushState() {}, replaceState() {} } as unknown as History;
    const store = createMemoryStore(defaultSettings());
    const controller = startController({
      document,
      location,
      history,
      store,
      sites: [
        {
          ...site,
          regions: [{ ...site.regions[0], replaceColumn: true, overlay: true, mountSelectors: ['ytd-browse[page-subtype="home"] #primary'] }],
        },
      ],
      windowTarget: window,
      now: () => 1_000,
    });
    await controller.ready;
    expect(document.getElementById('ife-reminder-host')).toBeTruthy();
    const labels = [
      ...(document.getElementById('ife-reminder-host')?.shadowRoot ?? document.getElementById('ife-reminder-host'))?.querySelectorAll('button') ?? [],
    ].map((node) => node.textContent);
    expect(labels).not.toContain('Show feed for 10 min');
    await store.update((current) => startSnooze(current, 10, 1_000));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.getElementById('ife-reminder-host')).toBeNull();
    expect(document.documentElement.className).not.toContain('ife-r-');
    expect(document.querySelector('.posts')?.textContent).toBe('A video');
    expect(reloads).toBe(1);
    controller.stop();
  });

  it('does not keep the YouTube overlay floating on search results', async () => {
    const { document, window } = parseHTML(
      '<!doctype html><html><body><ytd-masthead id="masthead"></ytd-masthead><ytd-browse page-subtype="home"><div id="primary"><div class="posts">A video</div></div></ytd-browse></body></html>',
    );
    stubBox(document.getElementById('primary'), 860, 240);
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
          regions: [{ ...site.regions[0], replaceColumn: true, overlay: true, mountSelectors: ['ytd-browse[page-subtype="home"] #primary'] }],
        },
      ],
      windowTarget: window,
      now: () => 1_000,
    });
    await controller.ready;
    const host = document.getElementById('ife-reminder-host');
    expect(host?.classList.contains('ife-overlay')).toBe(true);

    location.pathname = '/results';
    location.href = 'https://www.youtube.com/results?search_query=amjad';
    await controller.refresh();
    expect(document.getElementById('ife-reminder-host')).toBeNull();

    if (host) document.body.append(host);
    await controller.refresh();
    expect(document.getElementById('ife-reminder-host')).toBeNull();

    host?.remove();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(document.getElementById('ife-reminder-host')).toBeNull();
    controller.stop();
  });

  it('keeps the YouTube overlay when a leftover search view is still in the DOM', async () => {
    const { document, window } = parseHTML(
      '<!doctype html><html><body><ytd-browse page-subtype="home"><div id="primary"><div class="posts">A video</div></div></ytd-browse></body></html>',
    );
    stubBox(document.getElementById('primary'), 860, 240);
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
          regions: [{ ...site.regions[0], replaceColumn: true, overlay: true, mountSelectors: ['ytd-browse[page-subtype="home"] #primary'] }],
        },
      ],
      windowTarget: window,
      now: () => 1_000,
    });
    await controller.ready;
    expect(document.getElementById('ife-reminder-host')).toBeTruthy();

    const search = document.createElement('ytd-search');
    document.body.append(search);
    stubBox(search, 900, 240);
    await controller.refresh();
    expect(document.getElementById('ife-reminder-host')).toBeTruthy();
    expect(document.documentElement.classList.contains('ife-r-youtube-home-feed')).toBe(true);
    controller.stop();
  });

  it('hides the YouTube overlay when the search view is showing', async () => {
    const { document, window } = parseHTML(
      '<!doctype html><html><body><ytd-browse page-subtype="home" hidden><div id="primary"><div class="posts">A video</div></div></ytd-browse></body></html>',
    );
    stubBox(document.getElementById('primary'), 860, 240);
    const location = { hostname: 'www.youtube.com', pathname: '/', href: 'https://www.youtube.com/' } as Location;
    const history = { pushState() {}, replaceState() {} } as unknown as History;
    const search = document.createElement('ytd-search');
    document.body.append(search);
    stubBox(search, 900, 240);
    const controller = startController({
      document,
      location,
      history,
      store: createMemoryStore(defaultSettings()),
      sites: [
        {
          ...site,
          regions: [{ ...site.regions[0], replaceColumn: true, overlay: true, mountSelectors: ['ytd-browse[page-subtype="home"] #primary'] }],
        },
      ],
      windowTarget: window,
      now: () => 1_000,
    });
    await controller.ready;
    expect(document.getElementById('ife-reminder-host')).toBeNull();
    expect(document.documentElement.classList.contains('ife-r-youtube-home-feed')).toBe(false);
    controller.stop();
  });

  it('drops the YouTube overlay when the home browse is hidden', async () => {
    const { document, window } = parseHTML(
      '<!doctype html><html><body><ytd-browse page-subtype="home"><div id="primary"><div class="posts">A video</div></div></ytd-browse></body></html>',
    );
    stubBox(document.getElementById('primary'), 860, 240);
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
          regions: [{ ...site.regions[0], replaceColumn: true, overlay: true, mountSelectors: ['ytd-browse[page-subtype="home"] #primary'] }],
        },
      ],
      windowTarget: window,
      now: () => 1_000,
    });
    await controller.ready;
    expect(document.getElementById('ife-reminder-host')).toBeTruthy();
    document.querySelector('ytd-browse')?.setAttribute('hidden', '');
    await controller.refresh();
    expect(document.getElementById('ife-reminder-host')).toBeNull();
    expect(document.documentElement.classList.contains('ife-r-youtube-home-feed')).toBe(false);
    controller.stop();
  });

  it('shows the YouTube reminder once the column settles and does not redraw it on load events', async () => {
    const { document, window } = parseHTML(
      '<!doctype html><html><body><ytd-browse page-subtype="home"><div id="primary"><div class="posts">A video</div></div></ytd-browse></body></html>',
    );
    stubBox(document.getElementById('primary'), 860, 240);
    const location = { hostname: 'www.youtube.com', pathname: '/', href: 'https://www.youtube.com/' } as Location;
    const history = { pushState() {}, replaceState() {} } as unknown as History;
    let clock = 1_000;
    const controller = startController({
      document,
      location,
      history,
      store: createMemoryStore(defaultSettings()),
      sites: [
        {
          ...site,
          regions: [{ ...site.regions[0], replaceColumn: true, overlay: true, mountSelectors: ['ytd-browse[page-subtype="home"] #primary'] }],
        },
      ],
      windowTarget: window,
      now: () => clock,
    });
    await controller.ready;
    const host = document.getElementById('ife-reminder-host');
    expect(host?.classList.contains('ife-pending')).toBe(true);
    const card = (host?.shadowRoot ?? host)?.querySelector('.ife-card');
    expect(card).toBeTruthy();

    clock += 500;
    await controller.refresh();
    expect(host?.classList.contains('ife-pending')).toBe(false);

    window.dispatchEvent(new window.Event('pageshow'));
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect((host?.shadowRoot ?? host)?.querySelector('.ife-card')).toBe(card);
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
    expect(host?.parentElement).toBe(column);
    expect(host?.classList.contains('ife-overlay')).toBe(false);
    expect(column?.firstElementChild).toBe(host);
    expect(document.getElementById('chat')?.textContent).toBe('Chat');
    expect(column?.getAttribute('data-ife-column')).toBe('');
    expect(document.getElementById('rail')?.getAttribute('data-ife-column')).toBeNull();
    expect(document.getElementById('composer')?.textContent).toBe('What is on your mind');
    expect(column?.contains(host)).toBe(true);
    controller.stop();
  });

  it('keeps the Facebook reminder hidden until the feed column stops changing and reuses it', async () => {
    const { document, window } = parseHTML(
      '<!doctype html><html><body><div role="main"><div id="column"><div role="feed"><div class="posts">A post</div></div></div></div></body></html>',
    );
    const column = stubBox(document.getElementById('column'), 620, 360) as HTMLElement;
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    const location = { hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/' } as Location;
    const history = { pushState() {}, replaceState() {} } as unknown as History;
    let clock = 1_000;
    const store = createMemoryStore(defaultSettings());
    const controller = startController({
      document,
      location,
      history,
      store,
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
      now: () => clock,
    });
    await controller.ready;
    const host = document.getElementById('ife-reminder-host');
    expect(host?.classList.contains('ife-settling')).toBe(true);
    expect(column.style.minWidth).toBe('');

    const card = (host?.shadowRoot ?? host)?.querySelector('.ife-card');
    expect(card).toBeTruthy();

    clock += 500;
    await controller.refresh();
    expect(host?.classList.contains('ife-settling')).toBe(false);
    expect(column.style.minWidth).toBe('620px');

    host?.remove();
    await controller.refresh();
    const again = document.getElementById('ife-reminder-host');
    expect(again).toBe(host);
    expect((again?.shadowRoot ?? again)?.querySelector('.ife-card')).toBe(card);
    controller.stop();
  });

  it('turns on for LinkedIn For you and sits before the feed', async () => {
    const { document, window } = parseHTML(
      '<!doctype html><html><body><main><div id="layout"><div componentkey="container-update-list_mainFeed" id="feed"><div class="posts">A post</div></div></div></main></body></html>',
    );
    const location = {
      hostname: 'www.linkedin.com',
      pathname: '/feed/foryou',
      href: 'https://www.linkedin.com/feed/foryou/',
    } as Location;
    const history = { pushState() {}, replaceState() {} } as unknown as History;
    const controller = startController({
      document,
      location,
      history,
      store: createMemoryStore(defaultSettings()),
      windowTarget: window,
      now: () => 1_000,
    });
    await controller.ready;
    const host = document.getElementById('ife-reminder-host');
    const feed = document.getElementById('feed');
    expect(host?.nextElementSibling).toBe(feed);
    expect(host?.classList.contains('ife-overlay')).toBe(false);
    expect(feed?.textContent).toBe('A post');
    expect((host?.shadowRoot ?? host)?.querySelector('.ife-card')).toBeTruthy();
    host?.remove();
    await controller.refresh();
    const restored = document.getElementById('ife-reminder-host');
    expect(restored?.nextElementSibling).toBe(feed);
    expect((restored?.shadowRoot ?? restored)?.querySelector('.ife-card')).toBeTruthy();
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
        facebook: {
          reminderId: 'facebook-reminder',
          lastPath: 'www.facebook.com/',
          lastAdvancedAt: 2_000,
          seenIds: [],
          history: [],
        },
      },
    }));
    await controller.refresh();
    const after = await store.load();
    expect(after.cursors.youtube?.reminderId).toBe(shown);
    expect(after.cursors.facebook?.reminderId).toBe('facebook-reminder');
    expect(after.cursors.facebook?.lastPath).toBe('www.facebook.com/');
    controller.stop();
  });

  it('puts the Facebook reminder on the live home column after search', async () => {
    const { document, window } = parseHTML(
      '<!doctype html><html><body><div role="main" id="stale" hidden><div role="feed">search hits</div></div><div role="main" id="home"><div id="column"><div role="feed"><div class="posts">A post</div></div></div></div></body></html>',
    );
    stubBox(document.getElementById('stale'), 10, 0);
    stubBox(document.getElementById('home'), 900, 200);
    const column = stubBox(document.getElementById('column'), 620, 360);
    const location = {
      hostname: 'www.facebook.com',
      pathname: '/search/top',
      href: 'https://www.facebook.com/search/top',
    } as Location;
    const history = { pushState() {}, replaceState() {} } as unknown as History;
    const controller = startController({
      document,
      location,
      history,
      store: createMemoryStore(defaultSettings()),
      windowTarget: window,
      now: () => 1_000,
    });
    await controller.ready;
    expect(document.getElementById('ife-reminder-host')).toBeNull();
    location.pathname = '/';
    location.href = 'https://www.facebook.com/';
    await controller.refresh();
    const host = document.getElementById('ife-reminder-host');
    expect(host?.parentElement).toBe(column);
    expect(document.getElementById('stale')?.contains(host)).toBe(false);
    expect((host?.shadowRoot ?? host)?.querySelector('.ife-card')).toBeTruthy();
    location.pathname = '/search/top';
    location.href = 'https://www.facebook.com/search/top';
    await controller.refresh();
    expect(document.getElementById('ife-reminder-host')).toBeNull();
    if (host) document.body.append(host);
    await controller.refresh();
    expect(document.getElementById('ife-reminder-host')).toBeNull();
    controller.stop();
  });

  it('still places the Facebook reminder when the feed column is aria-hidden', async () => {
    const { document, window } = parseHTML(
      '<!doctype html><html><body><div role="main" aria-hidden="true"><div id="column"><div role="feed"><div class="posts">A post</div></div></div></div></body></html>',
    );
    const column = stubBox(document.getElementById('column'), 620, 360);
    const location = { hostname: 'www.facebook.com', pathname: '/', href: 'https://www.facebook.com/' } as Location;
    const history = { pushState() {}, replaceState() {} } as unknown as History;
    const controller = startController({
      document,
      location,
      history,
      store: createMemoryStore(defaultSettings()),
      windowTarget: window,
      now: () => 1_000,
    });
    await controller.ready;
    const host = document.getElementById('ife-reminder-host');
    expect(host?.parentElement).toBe(column);
    expect(document.documentElement.classList.contains('ife-r-facebook-home-feed')).toBe(true);
    controller.stop();
  });

  it('replaces Facebook Reels and Instagram Reels with the reminder', async () => {
    const { document, window } = parseHTML(
      '<!doctype html><html><body><div role="navigation">Nav</div><div role="main" id="main"><video></video><div>A reel</div></div></body></html>',
    );
    stubBox(document.getElementById('main'), 480, 200);
    const location = {
      hostname: 'www.facebook.com',
      pathname: '/reel/123',
      href: 'https://www.facebook.com/reel/123',
    } as Location;
    const history = { pushState() {}, replaceState() {} } as unknown as History;
    const facebook = startController({
      document,
      location,
      history,
      store: createMemoryStore(defaultSettings()),
      windowTarget: window,
      now: () => 1_000,
    });
    await facebook.ready;
    const facebookHost = document.getElementById('ife-reminder-host');
    expect(facebookHost?.parentElement).toBe(document.getElementById('main'));
    expect((facebookHost?.shadowRoot ?? facebookHost)?.querySelector('.ife-card')).toBeTruthy();
    facebook.stop();

    const instagramPage = parseHTML(
      '<!doctype html><html><body><nav>Nav</nav><main id="main" role="main"><video></video><div>A reel</div></main></body></html>',
    );
    stubBox(instagramPage.document.getElementById('main'), 420, 80);
    const instagramLocation = {
      hostname: 'www.instagram.com',
      pathname: '/reels',
      href: 'https://www.instagram.com/reels/',
    } as Location;
    const instagram = startController({
      document: instagramPage.document,
      location: instagramLocation,
      history,
      store: createMemoryStore(defaultSettings()),
      windowTarget: instagramPage.window,
      now: () => 1_000,
    });
    await instagram.ready;
    const instagramHost = instagramPage.document.getElementById('ife-reminder-host');
    expect(instagramHost?.parentElement).toBe(instagramPage.document.getElementById('main'));
    expect((instagramHost?.shadowRoot ?? instagramHost)?.querySelector('.ife-card')).toBeTruthy();
    instagram.stop();
  });

  it('does not keep a LinkedIn reminder on search', async () => {
    const { document, window } = parseHTML(
      '<!doctype html><html><body><main><div id="layout"><div componentkey="container-update-list_mainFeed" id="feed"><div class="posts">A post</div></div></div></main></body></html>',
    );
    const location = {
      hostname: 'www.linkedin.com',
      pathname: '/feed',
      href: 'https://www.linkedin.com/feed/',
    } as Location;
    const history = { pushState() {}, replaceState() {} } as unknown as History;
    const controller = startController({
      document,
      location,
      history,
      store: createMemoryStore(defaultSettings()),
      windowTarget: window,
      now: () => 1_000,
    });
    await controller.ready;
    const host = document.getElementById('ife-reminder-host');
    expect(host).toBeTruthy();
    location.pathname = '/search/results/all';
    location.href = 'https://www.linkedin.com/search/results/all/?keywords=test';
    await controller.refresh();
    expect(document.getElementById('ife-reminder-host')).toBeNull();
    if (host) document.body.append(host);
    await controller.refresh();
    expect(document.getElementById('ife-reminder-host')).toBeNull();
    controller.stop();
  });

  it('keeps the watch-suggestion reminder on the right', async () => {
    const { document, window } = parseHTML(
      '<!doctype html><html><body><ytd-watch-flexy><div id="primary"><div class="player">A video</div></div><div id="secondary"><div id="related">Suggested</div></div></ytd-watch-flexy></body></html>',
    );
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    stubBox(document.querySelector('ytd-watch-flexy'), 1280, 0);
    stubBox(document.getElementById('primary'), 860, 0);
    stubBox(document.getElementById('secondary'), 400, 860);
    stubBox(document.getElementById('related'), 400, 860);
    const settings = defaultSettings();
    settings.sites.youtube.regions['watch-suggestions'] = true;
    const controller = startController({
      document,
      location: { hostname: 'www.youtube.com', pathname: '/watch', href: 'https://www.youtube.com/watch?v=1' } as Location,
      history: { pushState() {}, replaceState() {} } as unknown as History,
      store: createMemoryStore(settings),
      sites: [youtube],
      windowTarget: window,
      now: () => 1_000,
    });
    await controller.ready;
    const host = document.getElementById('ife-reminder-host');
    expect(host).toBeTruthy();
    expect(host?.parentElement?.id).toBe('secondary');
    expect(host?.classList.contains('ife-overlay')).toBe(false);
    expect(host?.classList.contains('ife-sidebar')).toBe(true);
    expect(host?.style.left).toBe('');
    expect(host?.shadowRoot?.querySelector('.ife-card')?.classList.contains('is-panel')).toBe(true);
    expect(document.querySelector('#primary .player')?.textContent).toBe('A video');
    controller.stop();
  });

  it('still shows the watch-suggestion reminder when a leftover search view is in the DOM', async () => {
    const { document, window } = parseHTML(
      '<!doctype html><html><body><ytd-search></ytd-search><ytd-watch-flexy><div id="primary"><div class="player">A video</div></div><div id="secondary"><div id="related">Suggested</div></div></ytd-watch-flexy></body></html>',
    );
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    stubBox(document.querySelector('ytd-search'), 1280, 0);
    stubBox(document.querySelector('ytd-watch-flexy'), 1280, 0);
    stubBox(document.getElementById('primary'), 860, 0);
    stubBox(document.getElementById('secondary'), 400, 860);
    const settings = defaultSettings();
    settings.sites.youtube.regions['watch-suggestions'] = true;
    const controller = startController({
      document,
      location: { hostname: 'www.youtube.com', pathname: '/watch', href: 'https://www.youtube.com/watch?v=1' } as Location,
      history: { pushState() {}, replaceState() {} } as unknown as History,
      store: createMemoryStore(settings),
      sites: [youtube],
      windowTarget: window,
      now: () => 1_000,
    });
    await controller.ready;
    const host = document.getElementById('ife-reminder-host');
    expect(host?.parentElement?.id).toBe('secondary');
    expect(host?.classList.contains('ife-overlay')).toBe(false);
    expect(document.querySelector('#primary .player')?.textContent).toBe('A video');
    controller.stop();
  });

  it('puts a removed watch-suggestion reminder back in the suggestions column', async () => {
    const { document, window } = parseHTML(
      '<!doctype html><html><body><ytd-watch-flexy><div id="primary"><div class="player">A video</div></div><div id="secondary"><div id="related">Suggested</div></div></ytd-watch-flexy></body></html>',
    );
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    stubBox(document.querySelector('ytd-watch-flexy'), 1280, 0);
    stubBox(document.getElementById('primary'), 860, 0);
    stubBox(document.getElementById('secondary'), 400, 860);
    const settings = defaultSettings();
    settings.sites.youtube.regions['watch-suggestions'] = true;
    const controller = startController({
      document,
      location: { hostname: 'www.youtube.com', pathname: '/watch', href: 'https://www.youtube.com/watch?v=1' } as Location,
      history: { pushState() {}, replaceState() {} } as unknown as History,
      store: createMemoryStore(settings),
      sites: [youtube],
      windowTarget: window,
      now: () => 1_000,
    });
    await controller.ready;
    const host = document.getElementById('ife-reminder-host');
    expect(host?.parentElement?.id).toBe('secondary');
    host?.remove();
    await controller.refresh();
    const again = document.getElementById('ife-reminder-host');
    expect(again?.parentElement?.id).toBe('secondary');
    expect(again?.classList.contains('ife-overlay')).toBe(false);
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
