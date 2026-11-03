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
    '#ife-reminder-host{all:initial;display:block;width:100%;box-sizing:border-box;opacity:1;transition:opacity 160ms ease;}',
    '#ife-reminder-host.ife-settling{opacity:0;pointer-events:none;transition:none;}',
    '#ife-reminder-host.ife-overlay{position:fixed;z-index:2019;pointer-events:auto;display:flex;justify-content:center;align-items:flex-start;width:auto;min-width:18rem;max-width:100vw;overflow:auto;overscroll-behavior:contain;opacity:1;transition:opacity 160ms ease;}',
    '#ife-reminder-host.ife-sidebar{display:flex;align-items:center;justify-content:center;width:100%;min-height:70vh;padding:1.25rem 1rem;box-sizing:border-box;}',
    '#ife-reminder-host.ife-overlay.ife-sidebar{align-items:center;justify-content:center;min-height:0;width:auto;padding:1.5rem 1.25rem;background:var(--yt-spec-base-background,#0f0f0f);}',
    '#ife-reminder-host.ife-pending{opacity:0;pointer-events:none;transition:none;}',
    '[data-ife-column]{box-sizing:border-box;}',
    '[data-ife-column]>:not(#ife-reminder-host){display:none !important;}',
    '#ife-snooze-host{all:initial;}',
  ];
  for (const region of regions) {
    const selectors = region.selectors.filter(assertSafeSelector);
    if (!selectors.length) continue;
    const scoped = selectors.map((selector) => `html.${region.className} ${selector}:not(#ife-reminder-host)`).join(',');
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
