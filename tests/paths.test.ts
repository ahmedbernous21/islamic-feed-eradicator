import { describe, expect, it } from 'vitest';
import { hostMatches, normalizePath, pathMatches } from '../src/shared/paths';

describe('paths', () => {
  it('normalizes trailing slashes', () => {
    expect(normalizePath('/feed/')).toBe('/feed');
    expect(normalizePath('/')).toBe('/');
  });

  it('matches exact paths and prefixes', () => {
    expect(pathMatches('/', ['/'])).toBe(true);
    expect(pathMatches('/watch', ['/'])).toBe(false);
    expect(pathMatches('/shorts/abc', ['/shorts/*'])).toBe(true);
    expect(pathMatches('/shorts', ['/shorts/*'])).toBe(true);
    expect(pathMatches('/feed/subscriptions', '*')).toBe(true);
  });

  it('matches hosts exactly', () => {
    expect(hostMatches('www.youtube.com', ['www.youtube.com', 'youtube.com'])).toBe(true);
    expect(hostMatches('music.youtube.com', ['www.youtube.com'])).toBe(false);
  });
});
