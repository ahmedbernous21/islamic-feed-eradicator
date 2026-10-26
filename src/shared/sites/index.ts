import type { SiteDefinition, SiteId } from './types';
import facebook from './facebook';
import instagram from './instagram';
import linkedin from './linkedin';
import youtube from './youtube';
import { hostMatches } from '../paths';

export const SITES: SiteDefinition[] = [youtube, facebook, linkedin, instagram];

export function findSite(hostname: string): SiteDefinition | null {
  return SITES.find((site) => hostMatches(hostname, site.hosts)) ?? null;
}

export function siteById(id: SiteId): SiteDefinition {
  const site = SITES.find((item) => item.id === id);
  if (!site) throw new Error(`Unknown site ${id}`);
  return site;
}
