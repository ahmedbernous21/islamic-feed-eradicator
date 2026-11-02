import { get, list } from '@vercel/blob';

const SITES = ['youtube', 'facebook', 'linkedin', 'instagram'] as const;
type Site = (typeof SITES)[number];

type Batch = {
  installId: string;
  t: number;
  events: Array<Record<string, unknown>>;
};

type DayRow = {
  active: Set<string>;
  installs: Set<string>;
  next: number;
  visibleMs: Record<Site, number>;
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

function authorized(request: Request): boolean {
  const token = (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.METRICS_TOKEN;
  if (!token) return false;
  const header = request.headers.get('authorization') ?? '';
  const query = new URL(request.url).searchParams.get('token') ?? '';
  return header === `Bearer ${token}` || query === token;
}

function emptyVisible(): Record<Site, number> {
  return { youtube: 0, facebook: 0, linkedin: 0, instagram: 0 };
}

function emptyUsers(): Record<Site, Set<string>> {
  return {
    youtube: new Set(),
    facebook: new Set(),
    linkedin: new Set(),
    instagram: new Set(),
  };
}

function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function daysAgo(n: number, now = Date.now()): string {
  return dayKey(now - n * 86_400_000);
}

async function streamText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const merged = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(merged);
}

async function loadBatches(sinceDay: string): Promise<{ batches: Batch[]; files: number }> {
  const batches: Batch[] = [];
  let files = 0;
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: 'events/', cursor, limit: 1000 });
    files += page.blobs.length;
    for (const blob of page.blobs) {
      const day = blob.pathname.split('/')[1] ?? '';
      if (day < sinceDay) continue;
      const body = await get(blob.pathname, { access: 'private', useCache: false });
      if (body?.statusCode !== 200 || !body.stream) continue;
      const parsed = JSON.parse(await streamText(body.stream)) as Batch;
      if (parsed?.installId && Array.isArray(parsed.events)) batches.push(parsed);
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return { batches, files };
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) return json(401, { error: 'unauthorized' });
  try {
  const now = Date.now();
  const since = daysAgo(28, now);
  const { batches, files } = await loadBatches(since);

  const installs = new Set<string>();
  const firstSeen = new Map<string, number>();
  const lastSeen = new Map<string, number>();
  const lastPower = new Map<string, boolean>();
  const actionCounts = { next: 0, previous: 0, random: 0, favorite: 0, snooze: 0 };
  const actionUsers = {
    next: new Set<string>(),
    previous: new Set<string>(),
    random: new Set<string>(),
    favorite: new Set<string>(),
    snooze: new Set<string>(),
  };
  const visibleMs = emptyVisible();
  const visibleUsers = emptyUsers();
  const days = new Map<string, DayRow>();

  const ensureDay = (day: string): DayRow => {
    let row = days.get(day);
    if (!row) {
      row = { active: new Set(), installs: new Set(), next: 0, visibleMs: emptyVisible() };
      days.set(day, row);
    }
    return row;
  };

  for (const batch of batches) {
    const seen = batch.t || now;
    lastSeen.set(batch.installId, Math.max(lastSeen.get(batch.installId) ?? 0, seen));
    const row = ensureDay(dayKey(seen));
    row.active.add(batch.installId);
    for (const event of batch.events) {
      if (event.name === 'install') {
        installs.add(batch.installId);
        row.installs.add(batch.installId);
        firstSeen.set(batch.installId, Math.min(firstSeen.get(batch.installId) ?? seen, seen));
      }
      if (event.name === 'power' && typeof event.on === 'boolean') lastPower.set(batch.installId, event.on);
      if (event.name === 'action' && typeof event.action === 'string' && event.action in actionCounts) {
        const action = event.action as keyof typeof actionCounts;
        actionCounts[action] += 1;
        actionUsers[action].add(batch.installId);
        if (action === 'next') row.next += 1;
      }
      if (event.name === 'visible' && typeof event.site === 'string' && typeof event.ms === 'number') {
        const site = event.site as Site;
        if (!SITES.includes(site)) continue;
        visibleMs[site] += event.ms;
        visibleUsers[site].add(batch.installId);
        row.visibleMs[site] += event.ms;
      }
    }
  }

  const weekStart = now - 7 * 86_400_000;
  const dayStart = now - 86_400_000;
  const wau = [...lastSeen.entries()].filter(([, ts]) => ts >= weekStart).map(([id]) => id);
  const dau = [...lastSeen.entries()].filter(([, ts]) => ts >= dayStart).map(([id]) => id);
  const wauSet = new Set(wau);
  const disabled = wau.filter((id) => lastPower.get(id) === false);
  const sawReminder = new Set([...visibleUsers.youtube, ...visibleUsers.facebook, ...visibleUsers.linkedin, ...visibleUsers.instagram]);
  const liveMinutes = Object.values(visibleMs).reduce((sum, ms) => sum + ms, 0) / 60_000;

  const series = [...Array(14)].map((_, index) => {
    const day = daysAgo(13 - index, now);
    const row = days.get(day);
    return {
      day,
      dau: row?.active.size ?? 0,
      installs: row?.installs.size ?? 0,
      next: row?.next ?? 0,
      liveMinutes: row ? Object.values(row.visibleMs).reduce((sum, ms) => sum + ms, 0) / 60_000 : 0,
    };
  });

  return json(200, {
    generatedAt: now,
    windowDays: 28,
    ingestedFiles: files,
    kpis: {
      installs: installs.size || firstSeen.size,
      dau: dau.length,
      wau: wau.length,
      stillActive: installs.size ? wau.length / installs.size : 0,
      disabledNow: disabled.length,
      disableRate: wau.length ? disabled.length / wau.length : 0,
      activated: sawReminder.size,
      activationRate: (installs.size || wau.length) ? sawReminder.size / (installs.size || wau.length) : 0,
      nextClicks: actionCounts.next,
      nextUsers: actionUsers.next.size,
      nextRate: sawReminder.size ? actionUsers.next.size / sawReminder.size : 0,
      liveMinutes,
      liveMinutesPerWau: wau.length ? liveMinutes / wau.length : 0,
    },
    actions: {
      counts: actionCounts,
      users: {
        next: actionUsers.next.size,
        previous: actionUsers.previous.size,
        random: actionUsers.random.size,
        favorite: actionUsers.favorite.size,
        snooze: actionUsers.snooze.size,
      },
    },
    sites: Object.fromEntries(
      SITES.map((site) => [
        site,
        {
          liveMinutes: visibleMs[site] / 60_000,
          users: visibleUsers[site].size,
        },
      ]),
    ),
    series,
    notes: {
      uninstalls: 'Uninstalls are only in the Chrome Web Store dashboard. A silent user here may have uninstalled, or simply not opened Chrome.',
      weeklyUsers: 'Chrome Web Store weekly users counts browsers that loaded the extension, including disabled copies. WAU here counts browsers that sent an anonymous usage ping.',
    },
  });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'kpi failed';
    return json(500, { error: message });
  }
}
