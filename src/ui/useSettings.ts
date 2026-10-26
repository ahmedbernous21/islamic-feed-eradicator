import { useEffect, useMemo, useState } from 'react';
import { createSettingsStore, type SettingsStore } from '../shared/storage';
import type { Settings } from '../shared/settings';

export function useSettings(): { settings: Settings | null; store: SettingsStore } {
  const store = useMemo(() => createSettingsStore(), []);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    let live = true;
    void store.load().then((value) => {
      if (live) setSettings(value);
    });
    const stop = store.subscribe((value) => {
      if (live) setSettings(value);
    });
    return () => {
      live = false;
      stop();
    };
  }, [store]);

  return { settings, store };
}
