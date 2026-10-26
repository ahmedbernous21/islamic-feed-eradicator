import type { SiteDefinition } from './types';

const site: SiteDefinition = {
  id: 'facebook',
  title: 'Facebook',
  hosts: ['www.facebook.com', 'web.facebook.com', 'facebook.com'],
  regions: [
    {
      id: 'home-feed',
      title: 'Home feed',
      description: 'Replaces the main news feed. Messages, notifications, search, profiles, and groups stay available.',
      defaultEnabled: true,
      paths: ['/', '/home.php'],
      placement: 'primary',
      mountSelectors: ['[role="main"]'],
      selectors: [
        '[role="main"] [role="feed"]',
        '[data-pagelet="FeedUnit"]',
        'div.x1hc1fzr.x1unhpq9.x6o7n8i',
      ],
    },
    {
      id: 'stories',
      title: 'Stories',
      description: 'Hides the stories tray on the home page.',
      defaultEnabled: true,
      paths: ['/', '/home.php'],
      placement: 'none',
      selectors: ['[data-pagelet="Stories"]', '[aria-label="Stories"]', 'div.x193iq5w.xgmub6v.x1ceravr.x1v0nzow'],
    },
    {
      id: 'groups-feed',
      title: 'Groups feed',
      description: 'Replaces the groups feed. Off by default so groups remain usable.',
      defaultEnabled: false,
      paths: ['/groups/feed', '/groups/feed/*'],
      placement: 'primary',
      mountSelectors: ['[role="main"]'],
      selectors: ['[role="main"] [role="feed"]'],
    },
  ],
};

export default site;
