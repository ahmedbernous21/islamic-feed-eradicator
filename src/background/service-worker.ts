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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'ife-open-settings') return;
  const page = chrome.runtime.getURL('src/options/index.html');
  const opened = chrome.runtime.openOptionsPage?.();
  const fallback = () => chrome.tabs.create({ url: page });
  if (opened && typeof opened.then === 'function') {
    void opened.then(() => sendResponse({ ok: true })).catch(() => {
      void fallback().then(() => sendResponse({ ok: true }));
    });
  } else {
    void fallback().then(() => sendResponse({ ok: true }));
  }
  return true;
});

store.subscribe(() => {
  void syncBadge();
});

void syncBadge();
