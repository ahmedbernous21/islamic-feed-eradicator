import widgetCss from './widget.css?inline';
import type { Reminder } from '../shared/reminders/types';
import { categoryLabel, citation } from '../shared/reminders/engine';
import type { Theme } from '../shared/settings';

export type ReminderView = {
  reminder: Reminder | null;
  showTranslation: boolean;
  theme: Theme;
  favorite: boolean;
  compact: boolean;
  emptyMessage: string;
};

export type ReminderActions = {
  onPrevious: () => void;
  onNext: () => void;
  onRandom: () => void;
  onToggleFavorite: () => void;
  onToggleTranslation: () => void;
  onSnooze?: () => void;
  snoozeLabel?: string;
};

function keepMarksWithWords(text: string): string {
  return text.replace(/ ([\u06D6-\u06ED])/g, '\u2060$1');
}

function fontCss(): string {
  const runtime = globalThis.chrome?.runtime;
  if (!runtime?.getURL) return '';
  try {
    const regular = runtime.getURL('fonts/amiri-arabic-400.woff2');
    const bold = runtime.getURL('fonts/amiri-arabic-700.woff2');
    return `@font-face{font-family:"Amiri";src:url("${regular}") format("woff2");font-weight:400;font-display:swap;}@font-face{font-family:"Amiri";src:url("${bold}") format("woff2");font-weight:700;font-display:swap;}`;
  } catch {
    return '';
  }
}

function mountRoot(host: HTMLElement): ParentNode {
  if (host.shadowRoot) return host.shadowRoot;
  try {
    return host.attachShadow({ mode: 'open' });
  } catch {
    return host;
  }
}

function button(doc: Document, label: string, onClick: () => void, attrs: Record<string, string> = {}): HTMLButtonElement {
  const node = doc.createElement('button');
  node.type = 'button';
  node.textContent = label;
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  node.addEventListener('click', onClick);
  return node;
}

export function renderReminder(host: HTMLElement, view: ReminderView, actions: ReminderActions): void {
  const doc = host.ownerDocument;
  const root = mountRoot(host);
  root.replaceChildren();
  const style = doc.createElement('style');
  style.textContent = `${fontCss()}\n${widgetCss}`;
  const card = doc.createElement('article');
  card.className = view.compact ? 'ife-card is-compact' : 'ife-card';
  card.dataset.theme = view.theme;
  card.tabIndex = 0;
  card.setAttribute('aria-label', 'Islamic reminder');
  card.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      actions.onNext();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      actions.onPrevious();
    } else if (event.key === 'r' || event.key === 'R') {
      actions.onRandom();
    } else if (event.key === 'f' || event.key === 'F') {
      actions.onToggleFavorite();
    }
  });

  const reminder = view.reminder;
  if (!reminder) {
    const empty = doc.createElement('p');
    empty.className = 'ife-empty';
    empty.textContent = view.emptyMessage;
    card.append(empty);
  } else {
    const kicker = doc.createElement('p');
    kicker.className = 'ife-kicker';
    const kind = doc.createElement('span');
    kind.textContent = categoryLabel(reminder);
    const keys = doc.createElement('span');
    keys.textContent = '← →  R  F';
    kicker.append(kind, keys);

    if (reminder.category === 'personal') {
      const text = doc.createElement('p');
      text.className = 'ife-translation';
      text.textContent = reminder.text;
      card.append(kicker, text);
    } else {
      const arabic = doc.createElement('p');
      arabic.className = 'ife-arabic';
      arabic.lang = 'ar';
      arabic.dir = 'rtl';
      arabic.textContent = keepMarksWithWords(reminder.arabic);
      card.append(kicker, arabic);
      if (view.showTranslation) {
        const translation = doc.createElement('p');
        translation.className = 'ife-translation';
        translation.lang = 'en';
        translation.dir = 'ltr';
        translation.textContent = reminder.translation;
        card.append(translation);
      }
    }

    const source = doc.createElement('p');
    source.className = 'ife-source';
    source.dir = 'ltr';
    source.textContent = citation(reminder);
    card.append(source);

    if (reminder.category === 'hadith') {
      const grade = doc.createElement('p');
      grade.className = 'ife-grade';
      grade.textContent = `${reminder.authenticity}. ${reminder.authenticityBasis}`;
      card.append(grade);
    }
    if (reminder.category === 'scholar') {
      const status = doc.createElement('p');
      status.className = 'ife-grade';
      status.textContent = reminder.verificationNote;
      card.append(status);
    }
    if (reminder.category !== 'personal' && reminder.category !== 'scholar' && reminder.note) {
      const note = doc.createElement('p');
      note.className = 'ife-note';
      note.textContent = reminder.note;
      card.append(note);
    }
    if (reminder.category === 'hadith') {
      const details = doc.createElement('details');
      details.className = 'ife-details';
      const summary = doc.createElement('summary');
      summary.textContent = 'Full entry';
      const full = doc.createElement('p');
      full.className = 'ife-full';
      full.lang = 'ar';
      full.dir = 'rtl';
      full.textContent = keepMarksWithWords(reminder.arabicFull);
      details.append(summary, full);
      card.append(details);
    }
  }

  const rule = doc.createElement('hr');
  rule.className = 'ife-rule';
  const actionsRow = doc.createElement('div');
  actionsRow.className = 'ife-actions';
  actionsRow.append(
    button(doc, 'Previous', actions.onPrevious),
    button(doc, 'Next', actions.onNext),
    button(doc, 'Random', actions.onRandom),
    button(doc, view.favorite ? 'Favorited' : 'Favorite', actions.onToggleFavorite, {
      'aria-pressed': view.favorite ? 'true' : 'false',
    }),
    button(doc, view.showTranslation ? 'Hide translation' : 'Show translation', actions.onToggleTranslation),
  );
  if (actions.onSnooze && actions.snoozeLabel) {
    actionsRow.append(button(doc, actions.snoozeLabel, actions.onSnooze));
  }
  card.append(rule, actionsRow);
  root.append(style, card);
}
