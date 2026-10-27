import type { SiteDefinition } from './types';

const site: SiteDefinition = {
  id: 'instagram',
  title: 'Instagram',
  hosts: ['www.instagram.com', 'instagram.com'],
  regions: [
    {
      id: 'home-feed',
      title: 'Home feed',
      description: 'Replaces the home feed. Direct messages, search, profiles, and the rest of navigation stay available.',
      defaultEnabled: true,
      paths: ['/'],
      placement: 'primary',
      replaceColumn: true,
      mountSelectors: ['main[role="main"]', 'main'],
      selectors: ['main article', 'main > :nth-child(1) > div[style]'],
    },
    {
      id: 'stories',
      title: 'Stories',
      description: 'Hides the stories row on the home page. Instagram changes this markup often.',
      defaultEnabled: true,
      paths: ['/'],
      placement: 'none',
      selectors: ['main div[role="presentation"] ul', 'section > main div.xw7yly9 > div.xmnaoh6'],
    },
    {
      id: 'suggestions',
      title: 'Suggested accounts',
      description: 'Hides suggested-account blocks on the home feed.',
      defaultEnabled: true,
      paths: ['/'],
      placement: 'none',
      selectors: ['div:has(> div > a[href="/explore/people/"])', 'a[href="/explore/people/"]'],
    },
    {
      id: 'explore',
      title: 'Explore grid',
      description: 'Hides the Explore recommendation grid. Off by default because Instagram also uses Explore for search.',
      defaultEnabled: false,
      paths: ['/explore', '/explore/*'],
      placement: 'primary',
      mountSelectors: ['main'],
      selectors: ['main div:has(> div > div > a[href^="/p/"])'],
    },
  ],
};

export default site;
