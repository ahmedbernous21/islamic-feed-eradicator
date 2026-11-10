import { describe, expect, it } from 'vitest';
import { clearSnooze, defaultSettings, isSnoozing, normalizeSettings, resolveCardTheme, snoozeButtonLabel, snoozeRemainingClock, snoozeRemainingLabel, startSnooze, toggleRegion, toggleSite } from '../src/shared/settings';
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
    expect(settings.sites.facebook.regions.reels).toBe(true);
    expect(settings.sites.instagram.regions.reels).toBe(true);
    expect(settings.sites.instagram.regions.explore).toBe(false);
    for (const site of SITES) expect(settings.sites[site.id].enabled).toBe(true);
  });

  it('keeps an explicit theme and reads a dark page as dark', () => {
    expect(resolveCardTheme('light')).toBe('light');
    expect(resolveCardTheme('dark')).toBe('dark');
    const darkPage = {
      defaultView: {
        getComputedStyle: () => ({ colorScheme: 'dark', backgroundColor: 'rgb(24, 24, 24)' }),
      },
      documentElement: {},
      body: {},
    } as unknown as Document;
    expect(resolveCardTheme('system', darkPage)).toBe('dark');
  });

  it('starts and clears a snooze from the preset durations', () => {
    const now = 1_000_000;
    const snoozed = startSnooze(defaultSettings(), 60, now);
    expect(snoozed.snoozeMinutes).toBe(60);
    expect(snoozed.snoozeUntil).toBe(now + 60 * 60_000);
    expect(isSnoozing(snoozed, now)).toBe(true);
    expect(isSnoozing(clearSnooze(snoozed), now)).toBe(false);
    expect(snoozeButtonLabel(10)).toBe('Show feed for 10 min');
    expect(snoozeButtonLabel(60)).toBe('Show feed for 1 hour');
    expect(snoozeRemainingLabel(snoozed, now)).toBe('60 min');
    expect(snoozeRemainingLabel(snoozed, now + 59 * 60_000)).toBe('1 min');
    expect(snoozeRemainingClock(snoozed, now)).toBe('60:00');
    expect(snoozeRemainingClock(snoozed, now + 90_000)).toBe('58:30');
  });

  it('toggles a site and a region without touching the others', () => {
    const off = toggleSite(defaultSettings(), 'youtube');
    expect(off.sites.youtube.enabled).toBe(false);
    expect(off.sites.facebook.enabled).toBe(true);
    const region = toggleRegion(off, 'youtube', 'comments');
    expect(region.sites.youtube.regions.comments).toBe(true);
    expect(region.sites.youtube.regions['home-feed']).toBe(true);
    expect(toggleRegion(region, 'youtube', 'comments').sites.youtube.regions.comments).toBe(false);
  });
});
