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
};

export type SiteDefinition = {
  id: SiteId;
  title: string;
  hosts: string[];
  regions: RegionDefinition[];
};
