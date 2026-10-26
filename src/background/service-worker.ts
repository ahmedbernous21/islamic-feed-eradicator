import { createSettingsStore } from '../shared/storage';

const store = createSettingsStore();

async function syncBadge(): Promise<void> {
  const settings = await store.load();
  const text = settings.globalEnabled ? '' : 'OFF';
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color: '#0e3b2e' });
}

chrome.runtime.onInstalled.addListener(() => {
  void syncBadge();
});

chrome.runtime.onStartup.addListener(() => {
  void syncBadge();
});

store.subscribe(() => {
  void syncBadge();
});

void syncBadge();
