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
    expect(document.getElementById('ife-snooze-host')).toBeTruthy();
    expect(document.documentElement.className).not.toContain('ife-r-');
    await store.update((current) => ({ ...current, snoozeUntil: null }));
    await controller.refresh();
    expect(document.getElementById('ife-reminder-host')).toBeTruthy();
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
