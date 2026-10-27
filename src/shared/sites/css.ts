import type { RegionDefinition } from './types';

const SAFE_SELECTOR = /^[^<>{}]+$/;

export function assertSafeSelector(selector: string): boolean {
  return selector.trim().length > 0 && SAFE_SELECTOR.test(selector);
}

export function regionClass(siteId: string, regionId: string): string {
  return `ife-r-${siteId}-${regionId}`;
}

export function buildPageCss(regions: { className: string; selectors: string[] }[]): string {
  const lines = [
    '#ife-reminder-host{all:initial;display:block;width:100%;box-sizing:border-box;position:relative;z-index:2;}',
    '#ife-reminder-host.ife-overlay{position:fixed;z-index:5;display:flex;justify-content:center;align-items:flex-start;width:auto;min-width:18rem;max-width:100vw;overflow:auto;overscroll-behavior:contain;opacity:1;transition:opacity 160ms ease;}',
    '#ife-reminder-host.ife-pending{opacity:0;pointer-events:none;transition:none;}',
    '[data-ife-column]{box-sizing:border-box;}',
    '[data-ife-column]>*{display:none !important;}',
    '#ife-snooze-host{all:initial;}',
  ];
  for (const region of regions) {
    const selectors = region.selectors.filter(assertSafeSelector);
    if (!selectors.length) continue;
    const scoped = selectors.map((selector) => `html.${region.className} ${selector}`).join(',');
    lines.push(`${scoped}{display:none !important;}`);
  }
  return lines.join('\n');
}

export function activeRegionClasses(
  siteId: string,
  regions: RegionDefinition[],
  enabled: Record<string, boolean>,
  pathname: string,
  pathMatches: (pathname: string, paths: RegionDefinition['paths']) => boolean,
): { className: string; selectors: string[] }[] {
  return regions
    .filter((region) => enabled[region.id] !== false && pathMatches(pathname, region.paths))
    .map((region) => ({
      className: regionClass(siteId, region.id),
      selectors: region.selectors,
    }));
}
