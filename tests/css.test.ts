import { describe, expect, it } from 'vitest';
import { buildPageCss } from '../src/shared/sites/css';

describe('page css', () => {
  it('scopes hide rules to the region class and drops unsafe selectors', () => {
    const css = buildPageCss([
      { className: 'ife-r-youtube-home-feed', selectors: ['ytd-rich-grid-renderer', 'div{color:red}'] },
    ]);
    expect(css).toContain('html.ife-r-youtube-home-feed ytd-rich-grid-renderer{display:none !important;}');
    expect(css).not.toContain('color:red');
    expect(css).toContain('#ife-reminder-host.ife-overlay{position:fixed;z-index:2019;pointer-events:none;');
    expect(css).toContain('[data-ife-column]>:not(#ife-reminder-host){display:none !important;}');
  });
});
