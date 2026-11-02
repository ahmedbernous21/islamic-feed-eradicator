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
      replaceColumn: true,
      anchor: 'feed-column',
      mountSelectors: ['[role="main"]'],
      selectors: [
        '[role="main"] [role="feed"]',
        '[role="main"] [data-pagelet="FeedUnit"]',
        '[role="main"] [data-pagelet^="FeedUnit"]',
        '[role="main"] [aria-label="News Feed"]',
      ],
    },
    {
      id: 'reels',
      title: 'Reels',
      description: 'Replaces the Reels viewer. Messages, search, profiles, and the rest of navigation stay available.',
      defaultEnabled: true,
      paths: ['/reel', '/reel/*', '/reels'],
      placement: 'primary',
      replaceColumn: true,
      mountSelectors: ['[role="main"]'],
      selectors: [
        '[role="main"] video',
        '[role="main"] [data-video-id]',
        'div[data-pagelet*="Reel"]',
        '[aria-label="Reels"] video',
      ],
    },
    {
      id: 'stories',
      title: 'Stories',
      description: 'Hides the stories tray on the home page.',
      defaultEnabled: true,
      paths: ['/', '/home.php'],
      placement: 'none',
      selectors: ['[role="main"] [data-pagelet="Stories"]', '[role="main"] [aria-label="Stories"]'],
    },
    {
      id: 'groups-feed',
      title: 'Groups feed',
      description: 'Replaces the groups feed. Off by default so groups remain usable.',
      defaultEnabled: false,
      paths: ['/groups/feed', '/groups/feed/*'],
      placement: 'primary',
      replaceColumn: true,
      anchor: 'feed-column',
      mountSelectors: ['[role="main"]'],
      selectors: ['[role="main"] [role="feed"]'],
    },
  ],
};

export default site;
