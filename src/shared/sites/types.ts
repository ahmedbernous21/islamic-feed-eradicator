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
   * Hide the contents of the feed column and float the reminder over that column.
   * The reminder is not inserted into the site's own tree, which those sites would
   * otherwise delete on every update.
   */
  replaceColumn?: boolean;
  /** Walk up from the feed to the column inside the first mount selector. */
  anchor?: 'feed-column';
};

export type SiteDefinition = {
  id: SiteId;
  title: string;
  hosts: string[];
  regions: RegionDefinition[];
};
