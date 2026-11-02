import { SITE_IDS, type SiteId } from './sites/types';

export const TELEMETRY_ENDPOINT = 'https://ife-metrics.vercel.app/api/event';
export const TELEMETRY_STORAGE_KEY = 'ife-telemetry';

export const TELEMETRY_ACTIONS = ['next', 'previous', 'random', 'favorite', 'snooze'] as const;
export type TelemetryAction = (typeof TELEMETRY_ACTIONS)[number];

export type TelemetryEvent =
  | { name: 'install'; version: string }
  | { name: 'daily'; version: string }
  | { name: 'power'; on: boolean }
  | { name: 'action'; action: TelemetryAction }
  | { name: 'visible'; site: SiteId; ms: number };

export type TelemetryState = {
  installId: string;
  queue: TelemetryEvent[];
  lastDaily: string;
  lastFlush: number;
};

const MAX_QUEUE = 40;
const MAX_VISIBLE_MS = 30 * 60_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function utcDay(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function newInstallId(): string {
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  return `ife-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

export function sanitizeEvent(value: unknown): TelemetryEvent | null {
  if (!isRecord(value) || typeof value.name !== 'string') return null;
  if (value.name === 'install' || value.name === 'daily') {
    if (typeof value.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(value.version)) return null;
    return { name: value.name, version: value.version };
  }
  if (value.name === 'power') {
    if (typeof value.on !== 'boolean') return null;
    return { name: 'power', on: value.on };
  }
  if (value.name === 'action') {
    if (typeof value.action !== 'string' || !TELEMETRY_ACTIONS.includes(value.action as TelemetryAction)) return null;
    return { name: 'action', action: value.action as TelemetryAction };
  }
  if (value.name === 'visible') {
    if (typeof value.site !== 'string' || !SITE_IDS.includes(value.site as SiteId)) return null;
    if (typeof value.ms !== 'number' || !Number.isFinite(value.ms)) return null;
    const ms = Math.max(0, Math.min(MAX_VISIBLE_MS, Math.round(value.ms)));
    if (ms < 1000) return null;
    return { name: 'visible', site: value.site as SiteId, ms };
  }
  return null;
}

export function emptyTelemetryState(): TelemetryState {
  return { installId: newInstallId(), queue: [], lastDaily: '', lastFlush: 0 };
}

export function normalizeTelemetryState(value: unknown): TelemetryState {
  const fallback = emptyTelemetryState();
  if (!isRecord(value)) return fallback;
  const installId = typeof value.installId === 'string' && value.installId.length >= 8 ? value.installId : fallback.installId;
  const queue = Array.isArray(value.queue)
    ? value.queue.map(sanitizeEvent).filter((event): event is TelemetryEvent => event !== null).slice(0, MAX_QUEUE)
    : [];
  return {
    installId,
    queue,
    lastDaily: typeof value.lastDaily === 'string' ? value.lastDaily : '',
    lastFlush: typeof value.lastFlush === 'number' ? value.lastFlush : 0,
  };
}

export function enqueueEvent(state: TelemetryState, event: TelemetryEvent): TelemetryState {
  const clean = sanitizeEvent(event);
  if (!clean) return state;
  return { ...state, queue: [...state.queue, clean].slice(-MAX_QUEUE) };
}

export function track(event: TelemetryEvent): void {
  const runtime = globalThis.chrome?.runtime;
  if (!runtime?.sendMessage) return;
  try {
    void runtime.sendMessage({ type: 'ife-track', event });
  } catch {
    // The worker may be asleep; the next successful message flushes the queue.
  }
}

export function extensionVersion(): string {
  try {
    return globalThis.chrome?.runtime?.getManifest?.().version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}
