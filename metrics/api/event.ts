import { put } from '@vercel/blob';

const SITES = ['youtube', 'facebook', 'linkedin', 'instagram'] as const;
const ACTIONS = ['next', 'previous', 'random', 'favorite', 'snooze'] as const;
const NAMES = ['install', 'daily', 'power', 'action', 'visible'] as const;

type Incoming = {
  installId?: unknown;
  events?: unknown;
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitize(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value) || typeof value.name !== 'string') return null;
  if (!NAMES.includes(value.name as (typeof NAMES)[number])) return null;
  if (value.name === 'install' || value.name === 'daily') {
    if (typeof value.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(value.version)) return null;
    return { name: value.name, version: value.version };
  }
  if (value.name === 'power') {
    if (typeof value.on !== 'boolean') return null;
    return { name: 'power', on: value.on };
  }
  if (value.name === 'action') {
    if (typeof value.action !== 'string' || !ACTIONS.includes(value.action as (typeof ACTIONS)[number])) return null;
    return { name: 'action', action: value.action };
  }
  if (value.name === 'visible') {
    if (typeof value.site !== 'string' || !SITES.includes(value.site as (typeof SITES)[number])) return null;
    if (typeof value.ms !== 'number' || !Number.isFinite(value.ms)) return null;
    const ms = Math.max(1000, Math.min(30 * 60_000, Math.round(value.ms)));
    return { name: 'visible', site: value.site, ms };
  }
  return null;
}

export async function POST(request: Request): Promise<Response> {
  let body: Incoming;
  try {
    body = (await request.json()) as Incoming;
  } catch {
    return json(400, { ok: false });
  }
  const installId = typeof body.installId === 'string' ? body.installId.trim() : '';
  if (installId.length < 8 || installId.length > 80) return json(400, { ok: false });
  if (!Array.isArray(body.events) || body.events.length === 0 || body.events.length > 40) {
    return json(400, { ok: false });
  }
  const events = body.events.map(sanitize).filter((event): event is Record<string, unknown> => event !== null);
  if (!events.length) return json(400, { ok: false });

  const day = new Date().toISOString().slice(0, 10);
  const key = `events/${day}/${Date.now()}-${crypto.randomUUID()}.json`;
  await put(
    key,
    JSON.stringify({ installId, t: Date.now(), events }),
    { access: 'private', addRandomSuffix: false, contentType: 'application/json' },
  );
  return new Response(null, { status: 204 });
}
