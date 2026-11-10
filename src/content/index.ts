import { startController } from './controller';
import { createSettingsStore } from '../shared/storage';

const BOOT = '__ifeControllerStarted';
const root = globalThis as typeof globalThis & { [BOOT]?: boolean };
if (!root[BOOT]) {
  root[BOOT] = true;
  void startController({
    document,
    location: window.location,
    history: window.history,
    store: createSettingsStore(),
    windowTarget: window,
  });
}
