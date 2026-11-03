import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';
import { renderReminder } from '../src/content/widget';
import { libraryReminders } from '../src/shared/reminders/engine';

const reminder = libraryReminders.find((item) => item.id === 'quran-3-173');
if (!reminder) throw new Error('missing verse');

const actions = {
  onPrevious: () => undefined,
  onNext: () => undefined,
  onToggleFavorite: () => undefined,
  onToggleTranslation: () => undefined,
};

describe('reminder card', () => {
  it('shows the hadith without an Arabic speaker line and links the source', () => {
    const hadith = libraryReminders.find((item) => item.id === 'hadith-bukhari-54');
    if (!hadith || hadith.category !== 'hadith') throw new Error('missing hadith');
    const { document } = parseHTML('<!doctype html><html><body><div id="host"></div></body></html>');
    const host = document.getElementById('host');
    if (!host) throw new Error('missing host');
    renderReminder(
      host,
      {
        reminder: hadith,
        showTranslation: true,
        theme: 'light',
        favorite: false,
        compact: false,
        emptyMessage: '',
      },
      actions,
    );
    const root = host.shadowRoot ?? host;
    expect(root.querySelector('.ife-kicker')?.textContent).toContain('Hadith');
    expect(root.querySelector('.ife-speaker')).toBeNull();
    expect(root.querySelector('.ife-card')?.textContent).not.toContain('قال رسول الله');
    expect(root.querySelector('.ife-narrator')).toBeNull();
    expect(root.querySelector('.ife-speaker-en')?.textContent).toMatch(/The Prophet/);
    expect(root.querySelector('.ife-speaker-en')?.textContent).not.toContain('Narrated by');
    const link = root.querySelector('.ife-source-link');
    expect(link?.getAttribute('href')).toBe('https://sunnah.com/bukhari:54');
    expect(link?.textContent).toContain('Sahih al-Bukhari');
    expect(root.querySelector('.ife-arabic')?.textContent).toBe(hadith.arabic);
  });

  it('does not present a scholar quotation as a prophetic hadith', () => {
    const scholar = libraryReminders.find((item) => item.id === 'scholar-abu-hurayrah-heart');
    if (!scholar) throw new Error('missing scholar');
    const { document } = parseHTML('<!doctype html><html><body><div id="host"></div></body></html>');
    const host = document.getElementById('host');
    if (!host) throw new Error('missing host');
    renderReminder(
      host,
      {
        reminder: scholar,
        showTranslation: true,
        theme: 'light',
        favorite: false,
        compact: false,
        emptyMessage: '',
      },
      actions,
    );
    const root = host.shadowRoot ?? host;
    expect(root.querySelector('.ife-kicker')?.textContent).toContain('Scholar quotation');
    expect(root.querySelector('.ife-speaker')).toBeNull();
    expect(root.querySelector('.ife-source-link')).toBeNull();
    expect(root.querySelector('.ife-arabic')?.textContent).toBe(scholar.arabic);
  });

  it('hides the English source and the rendering note with the translation', () => {
    const { document } = parseHTML('<!doctype html><html><body><div id="host"></div></body></html>');
    const host = document.getElementById('host');
    if (!host) throw new Error('missing host');
    renderReminder(
      host,
      {
        reminder,
        showTranslation: false,
        theme: 'dark',
        favorite: false,
        compact: false,
        emptyMessage: '',
      },
      actions,
    );
    const root = host.shadowRoot ?? host;
    expect(root.querySelector('.ife-arabic-source')?.textContent).toContain('آل عمران');
    expect(root.querySelector('.ife-translation')).toBeNull();
    expect(root.querySelector('.ife-source')).toBeNull();
    expect(root.querySelector('.ife-note')).toBeNull();
    const text = root.querySelector('.ife-card')?.textContent ?? '';
    expect(text).not.toContain('English rendering prepared');
    expect(text).not.toContain('Al Imran');
  });

  it('opens a report box and sends the note', () => {
    const { document } = parseHTML('<!doctype html><html><body><div id="host"></div></body></html>');
    const host = document.getElementById('host');
    if (!host) throw new Error('missing host');
    let note = '';
    renderReminder(
      host,
      {
        reminder,
        showTranslation: true,
        theme: 'light',
        favorite: false,
        compact: false,
        emptyMessage: '',
      },
      { ...actions, onReport: (value) => { note = value; } },
    );
    const root = host.shadowRoot ?? host;
    const report = [...root.querySelectorAll('button')].find((node) => node.textContent === 'Report');
    report?.dispatchEvent(new document.defaultView!.Event('click'));
    const field = root.querySelector('textarea');
    const submit = [...root.querySelectorAll('button')].find((node) => node.textContent === 'Submit');
    if (!field || !submit) throw new Error('missing report form');
    expect(submit.textContent).toBe('Submit');
    field.value = 'This wording is wrong';
    root.querySelector('form')?.dispatchEvent(new document.defaultView!.Event('submit', { bubbles: true, cancelable: true }));
    expect(note).toBe('This wording is wrong');
  });
});
