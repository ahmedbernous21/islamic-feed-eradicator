import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';
import { renderReminder } from '../src/content/widget';
import { libraryReminders } from '../src/shared/reminders/engine';

const reminder = libraryReminders.find((item) => item.id === 'quran-3-173');
if (!reminder) throw new Error('missing verse');

const actions = {
  onPrevious: () => undefined,
  onNext: () => undefined,
  onRandom: () => undefined,
  onToggleFavorite: () => undefined,
  onToggleTranslation: () => undefined,
};

describe('reminder card', () => {
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
