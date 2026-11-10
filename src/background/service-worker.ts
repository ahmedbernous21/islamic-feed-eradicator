import { createSettingsStore } from '../shared/storage';
import { injectContentIntoOpenTabs, injectOpenTabsOncePerSession } from './inject';
import { dropQueuedEvents, flushTelemetry, markDaily, markInstall, recordEvent, startTelemetry } from './telemetry';

const store = createSettingsStore();
let lastEnabled: boolean | undefined;

const injectApi = chrome as unknown as Parameters<typeof injectContentIntoOpenTabs>[0];

async function syncBadge(): Promise<void> {
  const settings = await store.load();
  const text = settings.globalEnabled ? '' : 'OFF';
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color: '#0e3b2e' });
}

chrome.runtime.onInstalled.addListener((details) => {
  void syncBadge();
  if (details.reason === 'install') void markInstall();
  else void markDaily().then(() => flushTelemetry());
  void injectContentIntoOpenTabs(injectApi);
});

chrome.runtime.onStartup.addListener(() => {
  void syncBadge();
  void markDaily().then(() => flushTelemetry());
  void injectContentIntoOpenTabs(injectApi);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'ife-track') {
    void recordEvent(message.event).then(() => sendResponse({ ok: true }));
    return true;
  }
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

store.subscribe((settings) => {
  void syncBadge();
  if (!settings.telemetry) void dropQueuedEvents();
  if (lastEnabled === undefined) {
    lastEnabled = settings.globalEnabled;
    return;
  }
  if (lastEnabled === settings.globalEnabled) return;
  lastEnabled = settings.globalEnabled;
  void recordEvent({ name: 'power', on: settings.globalEnabled });
});

startTelemetry();
void syncBadge();
void markDaily();
void injectOpenTabsOncePerSession(injectApi);
