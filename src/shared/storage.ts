import { defaultSettings, normalizeSettings, type Settings } from './settings';

export const SETTINGS_KEY = 'ife-settings';

export type SettingsStore = {
  load(): Promise<Settings>;
  save(settings: Settings): Promise<void>;
  update(mutator: (current: Settings) => Settings): Promise<Settings>;
  subscribe(listener: (settings: Settings) => void): () => void;
};

type ChromeStorage = {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  onChanged(listener: () => void): () => void;
};

function chromeArea(): ChromeStorage | null {
  const storage = globalThis.chrome?.storage?.local;
  const onChanged = globalThis.chrome?.storage?.onChanged;
  if (!storage || !onChanged) return null;
  return {
    get: (keys) => storage.get(keys),
    set: (items) => storage.set(items),
    onChanged: (listener) => {
      const wrapped = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
        if (area === 'local' && changes[SETTINGS_KEY]) listener();
      };
      onChanged.addListener(wrapped);
      return () => onChanged.removeListener(wrapped);
    },
  };
}

export function createMemoryStore(initial?: Settings): SettingsStore {
  let current = initial ?? defaultSettings();
  const listeners = new Set<(settings: Settings) => void>();
  let queue: Promise<unknown> = Promise.resolve();
  return {
    async load() {
      return current;
    },
    async save(settings) {
      current = normalizeSettings(settings);
      listeners.forEach((listener) => listener(current));
    },
    update(mutator) {
      const run = queue.then(async () => {
        current = normalizeSettings(mutator(current));
        listeners.forEach((listener) => listener(current));
        return current;
      });
      queue = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function createSettingsStore(): SettingsStore {
  const area = chromeArea();
  if (!area) return createLocalStorageStore();
  let queue: Promise<unknown> = Promise.resolve();
  const load = async () => {
    const stored = await area.get([SETTINGS_KEY]);
    return normalizeSettings(stored[SETTINGS_KEY]);
  };
  const save = async (settings: Settings) => {
    await area.set({ [SETTINGS_KEY]: normalizeSettings(settings) });
  };
  return {
    load,
    save,
    update(mutator) {
      const run = queue.then(async () => {
        const next = normalizeSettings(mutator(await load()));
        await save(next);
        return next;
      });
      queue = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
    subscribe(listener) {
      return area.onChanged(() => {
        void load().then(listener);
      });
    },
  };
}

function createLocalStorageStore(): SettingsStore {
  const memory = createMemoryStore(readLocal());
  const save = memory.save.bind(memory);
  memory.save = async (settings) => {
    await save(settings);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  };
  const update = memory.update.bind(memory);
  memory.update = async (mutator) => {
    const next = await update(mutator);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    return next;
  };
  return memory;
}

function readLocal(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? normalizeSettings(JSON.parse(raw)) : defaultSettings();
  } catch {
    return defaultSettings();
  }
}
