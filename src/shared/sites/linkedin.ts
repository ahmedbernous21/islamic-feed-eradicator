import type { SiteDefinition } from './types';

const FEED_PATHS = ['/', '/feed', '/feed/foryou', '/feed/following', '/feed/recent', '/feed/network', '/feed/all'];

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
        '[data-testid="mainFeed"]',
        'div[componentkey^="container-update-list_mainFeed"]',
        'div[componentkey^="container-update-list_NetworkFeedListCollection"]',
        'main .scaffold-finite-scroll__content',
        'main .scaffold-finite-scroll',
      ],
      selectors: [
        '[data-testid="mainFeed"] [data-view-name="feed-full-update"]',
        '[data-testid="mainFeed"] [role="listitem"]',
        '[data-view-name="feed-full-update"]',
        '[role="listitem"]:has([data-view-name="feed-full-update"])',
        '[data-id^="urn:li:activity"]',
        '[data-urn^="urn:li:activity"]',
        'div[componentkey*="FeedType_MAIN_FEED"]',
        'div[componentkey^="container-update-list_mainFeed"]',
        'div[componentkey^="container-update-list_NetworkFeedListCollection"]',
        '.feed-shared-update-v2',
        '.occludable-update',
        'main[aria-label="Main Feed"] .scaffold-finite-scroll',
        'main .scaffold-finite-scroll',
        'main .scaffold-finite-scroll__content',
        'main .scaffold-finite-scroll__loader',
        '[data-testid="mainFeed"] .scaffold-finite-scroll',
        '[data-finite-scroll-hotkey-context="FEED"]',
        '[data-testid="mainFeed"] .artdeco-loader',
        '[data-testid="mainFeed"] .artdeco-spinner',
        '[data-testid="mainFeed"] [role="progressbar"]',
        'main .artdeco-loader',
        'main .feed-shared-skeleton',
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
        'aside .news-module',
      ],
    },
  ],
};

export default site;
