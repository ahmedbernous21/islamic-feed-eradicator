import { createSettingsStore } from '../shared/storage';
import {
  TELEMETRY_ENDPOINT,
  TELEMETRY_STORAGE_KEY,
  enqueueEvent,
  extensionVersion,
  normalizeTelemetryState,
  sanitizeEvent,
  utcDay,
  type TelemetryEvent,
  type TelemetryState,
} from '../shared/telemetry';

const FLUSH_MS = 20_000;

function area(): chrome.storage.StorageArea | null {
  return globalThis.chrome?.storage?.local ?? null;
}

async function readState(): Promise<TelemetryState> {
  const storage = area();
  if (!storage) return normalizeTelemetryState(null);
  const stored = await storage.get(TELEMETRY_STORAGE_KEY);
  return normalizeTelemetryState(stored[TELEMETRY_STORAGE_KEY]);
}

async function writeState(state: TelemetryState): Promise<void> {
  const storage = area();
  if (!storage) return;
  await storage.set({ [TELEMETRY_STORAGE_KEY]: state });
}

export async function recordEvent(event: unknown): Promise<void> {
  const clean = sanitizeEvent(event);
  if (!clean) return;
  const settings = await createSettingsStore().load();
  if (!settings.telemetry) return;
  const state = enqueueEvent(await readState(), clean);
  await writeState(state);
  if (state.queue.length >= 8) await flushTelemetry();
}

export async function markDaily(): Promise<void> {
  const settings = await createSettingsStore().load();
  if (!settings.telemetry) return;
  const today = utcDay();
  const state = await readState();
  if (state.lastDaily === today) return;
  state.lastDaily = today;
  const next = enqueueEvent(state, { name: 'daily', version: extensionVersion() });
  await writeState(next);
}

export async function markInstall(): Promise<void> {
  const settings = await createSettingsStore().load();
  if (!settings.telemetry) return;
  const state = enqueueEvent(await readState(), { name: 'install', version: extensionVersion() });
  state.lastDaily = utcDay();
  await writeState(state);
  await flushTelemetry();
}

export async function flushTelemetry(): Promise<void> {
  const settings = await createSettingsStore().load();
  if (!settings.telemetry) return;
  const state = await readState();
  if (!state.queue.length) return;
  if (Date.now() - state.lastFlush < 4000) return;
  const payload = {
    installId: state.installId,
    events: state.queue,
  };
  try {
    const response = await fetch(TELEMETRY_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok && response.status !== 204) return;
    await writeState({ ...state, queue: [], lastFlush: Date.now() });
  } catch {
    // Stay queued until the next alarm.
  }
}

export async function dropQueuedEvents(): Promise<void> {
  const state = await readState();
  if (!state.queue.length) return;
  await writeState({ ...state, queue: [] });
}

export function startTelemetry(): void {
  const alarms = globalThis.chrome?.alarms;
  if (alarms?.create) {
    void alarms.create('ife-telemetry', { periodInMinutes: 5 });
    alarms.onAlarm.addListener((alarm) => {
      if (alarm.name !== 'ife-telemetry') return;
      void markDaily().then(() => flushTelemetry());
    });
  } else {
    globalThis.setInterval(() => {
      void markDaily().then(() => flushTelemetry());
    }, FLUSH_MS);
  }
}
