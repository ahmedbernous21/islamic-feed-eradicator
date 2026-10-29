export const SITE_IDS = ['youtube', 'facebook', 'linkedin', 'instagram'] as const;

export type SiteId = (typeof SITE_IDS)[number];

export type Placement = 'primary' | 'compact' | 'none';

export type RegionDefinition = {
  id: string;
  title: string;
  description: string;
  defaultEnabled: boolean;
  /** '*' or exact paths. A path ending in /* also matches that prefix. */
  paths: '*' | string[];
  selectors: string[];
  placement: Placement;
  /** Element that should contain the reminder. Falls back to the hidden node's parent. */
  mountSelectors?: string[];
  /**
   * Hide the other contents of the feed column and show the reminder there.
   * The reminder is placed in the column, so the site's own menus and chats stay above it.
   */
  replaceColumn?: boolean;
  /** Pin the reminder over the column. YouTube's grid removes an in-column node. */
  overlay?: boolean;
  /** Place the reminder as a sibling before the feed, the way LinkedIn keeps its composer. */
  insert?: 'before';
  /** Walk up from the feed to the column inside the first mount selector. */
  anchor?: 'feed-column';
};

export type SiteDefinition = {
  id: SiteId;
  title: string;
  hosts: string[];
  regions: RegionDefinition[];
};
