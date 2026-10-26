import { describe, expect, it } from 'vitest';
import { defaultSettings, normalizeSettings } from '../src/shared/settings';
import { SITES } from '../src/shared/sites';

describe('settings', () => {
  it('fills missing regions and ignores unknown values', () => {
    const settings = normalizeSettings({
      globalEnabled: false,
      theme: 'nope',
      rotation: { mode: 'interval', intervalMinutes: 9000 },
      sites: { youtube: { enabled: false, regions: { 'home-feed': false } } },
      personalNotes: [{ id: 'personal-1', text: '  remember  ', createdAt: 1 }, { id: '', text: 'x' }],
    });
    expect(settings.globalEnabled).toBe(false);
    expect(settings.theme).toBe('system');
    expect(settings.rotation.intervalMinutes).toBe(720);
    expect(settings.sites.youtube.enabled).toBe(false);
    expect(settings.sites.youtube.regions['home-feed']).toBe(false);
    expect(settings.sites.youtube.regions.shorts).toBe(true);
    expect(settings.personalNotes).toEqual([{ id: 'personal-1', text: 'remember', createdAt: 1 }]);
    expect(settings.sites.facebook.enabled).toBe(true);
  });

  it('enables the main feed regions by default and leaves optional distractions off', () => {
    const settings = defaultSettings();
    expect(settings.sites.youtube.regions['home-feed']).toBe(true);
    expect(settings.sites.youtube.regions['watch-suggestions']).toBe(false);
    expect(settings.sites.youtube.regions.comments).toBe(false);
    expect(settings.sites.facebook.regions['groups-feed']).toBe(false);
    expect(settings.sites.instagram.regions.explore).toBe(false);
    for (const site of SITES) expect(settings.sites[site.id].enabled).toBe(true);
  });
});
