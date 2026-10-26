import type { SiteDefinition } from './types';

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
      paths: ['/', '/feed'],
      placement: 'primary',
      mountSelectors: ['.scaffold-layout__main', 'main'],
      selectors: [
        '.scaffold-finite-scroll',
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
      paths: ['/', '/feed'],
      placement: 'none',
      selectors: [
        '#feed-news-module',
        '[data-view-name="news-module"]',
        'aside .news-module',
      ],
    },
  ],
};

export default site;
