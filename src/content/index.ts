import { startController } from './controller';
import { createSettingsStore } from '../shared/storage';

void startController({
  document,
  location: window.location,
  history: window.history,
  store: createSettingsStore(),
  windowTarget: window,
});
