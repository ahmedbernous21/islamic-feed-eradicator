import { describe, expect, it } from 'vitest';
import { enqueueEvent, emptyTelemetryState, sanitizeEvent } from '../src/shared/telemetry';

describe('telemetry', () => {
  it('keeps only the allowed events and drops short visibility pings', () => {
    expect(sanitizeEvent({ name: 'next' })).toBeNull();
    expect(sanitizeEvent({ name: 'action', action: 'next' })).toEqual({ name: 'action', action: 'next' });
    expect(sanitizeEvent({ name: 'visible', site: 'facebook', ms: 200 })).toBeNull();
    expect(sanitizeEvent({ name: 'visible', site: 'facebook', ms: 1500 })).toEqual({
      name: 'visible',
      site: 'facebook',
      ms: 1500,
    });
    expect(sanitizeEvent({ name: 'visible', site: 'tiktok', ms: 4000 })).toBeNull();
    expect(sanitizeEvent({ name: 'power', on: false })).toEqual({ name: 'power', on: false });
  });

  it('queues a capped list of clean events', () => {
    let state = emptyTelemetryState();
    state = enqueueEvent(state, { name: 'action', action: 'next' });
    state = enqueueEvent(state, { name: 'visible', site: 'youtube', ms: 50 });
    expect(state.queue).toEqual([{ name: 'action', action: 'next' }]);
  });
});
