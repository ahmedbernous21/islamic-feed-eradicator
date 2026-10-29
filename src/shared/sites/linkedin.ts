import type { SiteDefinition } from './types';

const FEED_PATHS = ['/', '/feed', '/feed/foryou', '/feed/network'];

const site: SiteDefinition = {
  id: 'linkedin',
  title: 'LinkedIn',
  hosts: ['www.linkedin.com', 'linkedin.com'],
  regions: [
    {
      id: 'home-feed',
      title: 'Home feed',
      description: 'Replaces the main feed. Jobs, messaging, search, notifications, and profiles stay available.',
      defaultEnabled: true,
      paths: FEED_PATHS,
      placement: 'primary',
      insert: 'before',
      mountSelectors: [
        'main > div.relative > .scaffold-finite-scroll',
        'div[componentkey^="container-update-list_mainFeed"]',
        'div[componentkey^="container-update-list_NetworkFeedListCollection"]',
        '[data-testid="mainFeed"]',
      ],
      selectors: [
        'div[componentkey^="container-update-list_mainFeed"]',
        'div[componentkey^="container-update-list_NetworkFeedListCollection"]',
        'main > div.relative > .scaffold-finite-scroll',
        '[data-testid="mainFeed"] [data-view-name="feed-full-update"]',
        '[data-testid="mainFeed"] [role="listitem"]',
        '[data-view-name="feed-full-update"]',
        '[data-id^="urn:li:activity"]',
        '[data-urn^="urn:li:activity"]',
        'div[componentkey^="container-update-list"]',
        '.feed-shared-update-v2',
        '.occludable-update',
      ],
    },
    {
      id: 'news-sidebar',
      title: 'News sidebar',
      description: 'Hides the LinkedIn News module on the feed.',
      defaultEnabled: true,
      paths: FEED_PATHS,
      placement: 'none',
      selectors: [
        '#feed-news-module',
        '[data-view-name="news-module"]',
        '[data-testid="news-module"]',
        'div:has(> div > div[data-view-name="news-module"])',
        'aside .news-module',
      ],
    },
  ],
};

export default site;
