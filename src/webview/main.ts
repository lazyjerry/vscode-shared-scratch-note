import {
  continueList,
  indentList,
  insertLink,
  pasteUrlOverSelection,
  wrapSelection,
  type EditResult,
} from './markdownEditing';
import { findMatches, matchIndexFrom, replaceMatches, type TextMatch } from './findReplace';

interface VsCodeApi {
  postMessage(message: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();
const note = requireElement<HTMLTextAreaElement>('#note');
const conflictWarning = requireElement<HTMLElement>('#conflict-warning');
const refreshButton = requireElement<HTMLButtonElement>('#refresh');
const highlights = requireElement<HTMLElement>('#highlights');
const findInput = requireElement<HTMLInputElement>('#find');
const replaceInput = requireElement<HTMLInputElement>('#replace');
const findCount = requireElement<HTMLElement>('#find-count');
const matchCaseButton = requireElement<HTMLButtonElement>('#match-case');

for (const action of ['refresh', 'save', 'export'] as const) {
  document.querySelector<HTMLButtonElement>(`#${action}`)?.addEventListener('click', () => {
    vscode.postMessage({ type: action });
    if (action !== 'export') {
      note.focus();
    }
  });
}

note.addEventListener('input', () => {
  vscode.postMessage({ type: 'input', content: note.value });
});

note.addEventListener('keydown', (event) => {
  if (event.isComposing) {
    return;
  }

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    openFind();
    return;
  }

  let edit: EditResult | undefined;
  if (event.key === 'Enter' && note.selectionStart === note.selectionEnd) {
    edit = continueList(note.value, note.selectionStart);
  } else if (event.key === 'Tab') {
    edit = indentList(note.value, note.selectionStart, note.selectionEnd, event.shiftKey);
  } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
    edit = wrapSelection(note.value, note.selectionStart, note.selectionEnd, '**', '**');
  } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'i') {
    edit = wrapSelection(note.value, note.selectionStart, note.selectionEnd, '*', '*');
  } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    edit = insertLink(note.value, note.selectionStart, note.selectionEnd);
  }

  if (!edit) {
    return;
  }

  event.preventDefault();
  applyEdit(note, edit);
});

note.addEventListener('paste', (event) => {
  const clipboardText = event.clipboardData?.getData('text/plain');
  if (!clipboardText) {
    return;
  }

  const edit = pasteUrlOverSelection(
    note.value,
    note.selectionStart,
    note.selectionEnd,
    clipboardText,
  );
  if (!edit) {
    return;
  }

  event.preventDefault();
  applyEdit(note, edit);
});

window.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (isConflictMessage(event.data)) {
    conflictWarning.hidden = !event.data.conflict;
    // Refresh only changes anything during a conflict; the host shows a toast when clicked otherwise.
    refreshButton.setAttribute('aria-disabled', String(!event.data.conflict));
    refreshButton.title = event.data.conflict
      ? 'Discard the content in this window and load the shared note'
      : 'Already in sync with the shared note';
    return;
  }

  if (!isContentMessage(event.data) || event.data.content === note.value) {
    return;
  }

  const selectionStart = Math.min(note.selectionStart, event.data.content.length);
  const selectionEnd = Math.min(note.selectionEnd, event.data.content.length);
  note.value = event.data.content;
  note.setSelectionRange(selectionStart, selectionEnd);
  refreshFind();
});

let matches: TextMatch[] = [];
let currentMatch = 0;
let matchCase = false;

findInput.addEventListener('input', () => {
  refreshFind(note.selectionStart);
});

findInput.addEventListener('keydown', (event) => {
  if (event.isComposing) {
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    moveMatch(event.shiftKey ? -1 : 1);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    closeFind();
  }
});

replaceInput.addEventListener('keydown', (event) => {
  if (event.isComposing) {
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    if (event.metaKey || event.ctrlKey) {
      replaceAll();
    } else {
      replaceCurrent();
    }
  } else if (event.key === 'Escape') {
    event.preventDefault();
    closeFind();
  }
});

matchCaseButton.addEventListener('click', () => {
  matchCase = !matchCase;
  matchCaseButton.setAttribute('aria-pressed', String(matchCase));
  refreshFind(note.selectionStart);
});

document.querySelector('#find-previous')?.addEventListener('click', () => moveMatch(-1));
document.querySelector('#find-next')?.addEventListener('click', () => moveMatch(1));
document.querySelector('#replace-one')?.addEventListener('click', replaceCurrent);
document.querySelector('#replace-all')?.addEventListener('click', replaceAll);

note.addEventListener('input', () => {
  refreshFind();
});

note.addEventListener('scroll', () => {
  highlights.scrollTop = note.scrollTop;
});

new ResizeObserver(() => {
  if (matches.length > 0) {
    renderHighlights();
  }
}).observe(note);

vscode.postMessage({ type: 'ready' });

function applyEdit(note: HTMLTextAreaElement, edit: EditResult): void {
  note.value = edit.value;
  note.setSelectionRange(edit.selectionStart, edit.selectionEnd);
  vscode.postMessage({ type: 'input', content: edit.value });
}

function isContentMessage(value: unknown): value is { type: 'content'; content: string } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const message = value as { type?: unknown; content?: unknown };
  return message.type === 'content' && typeof message.content === 'string';
}

function isConflictMessage(value: unknown): value is { type: 'conflict'; conflict: boolean } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const message = value as { type?: unknown; conflict?: unknown };
  return message.type === 'conflict' && typeof message.conflict === 'boolean';
}

function openFind(): void {
  const selected = note.value.slice(note.selectionStart, note.selectionEnd);
  if (selected !== '' && !selected.includes('\n')) {
    findInput.value = selected;
    refreshFind(note.selectionStart);
  }
  findInput.focus();
  findInput.select();
}

function closeFind(): void {
  const match = matches[currentMatch];
  findInput.value = '';
  refreshFind();
  note.focus();
  if (match) {
    note.setSelectionRange(match.start, match.end);
  }
}

/** Recomputes matches; `preferStart` picks the first match at or after it as the current one. */
function refreshFind(preferStart?: number): void {
  matches = findMatches(note.value, findInput.value, matchCase);
  if (preferStart !== undefined) {
    currentMatch = matchIndexFrom(matches, preferStart);
  } else if (currentMatch >= matches.length) {
    currentMatch = 0;
  }
  renderHighlights();
  if (preferStart !== undefined) {
    revealCurrentMatch();
  }
}

function moveMatch(step: number): void {
  if (matches.length === 0) {
    return;
  }

  currentMatch = (currentMatch + step + matches.length) % matches.length;
  renderHighlights();
  revealCurrentMatch();
}

function replaceCurrent(): void {
  const match = matches[currentMatch];
  if (!match) {
    return;
  }

  replaceRange(match.start, match.end, replaceInput.value);
  refreshFind(match.start + replaceInput.value.length);
}

function replaceAll(): void {
  const first = matches[0];
  const last = matches[matches.length - 1];
  if (!first || !last) {
    return;
  }

  // Replace only the span covering the matches so the whole edit is a single undo step.
  const value = replaceMatches(note.value, matches, replaceInput.value);
  const replacedEnd = value.length - (note.value.length - last.end);
  replaceRange(first.start, last.end, value.slice(first.start, replacedEnd));
  refreshFind();
}

function replaceRange(start: number, end: number, text: string): void {
  const focused = document.activeElement;
  note.focus();
  note.setSelectionRange(start, end);
  // insertText keeps the edit in the textarea's undo stack and fires the input event that saves it.
  if (!document.execCommand('insertText', false, text)) {
    const value = note.value.slice(0, start) + text + note.value.slice(end);
    applyEdit(note, { value, selectionStart: start + text.length, selectionEnd: start + text.length });
  }
  if (focused instanceof HTMLElement && focused !== note) {
    focused.focus();
  }
}

function renderHighlights(): void {
  findCount.textContent =
    findInput.value === ''
      ? ''
      : matches.length === 0
        ? 'No results'
        : `${currentMatch + 1} of ${matches.length}`;

  highlights.replaceChildren();
  highlights.hidden = matches.length === 0;
  if (matches.length === 0) {
    return;
  }

  // Mirror the textarea's content box so the marks line up with the text drawn on top of them.
  highlights.style.width = `${note.clientWidth}px`;
  highlights.style.height = `${note.clientHeight}px`;
  let cursor = 0;
  matches.forEach((match, index) => {
    highlights.append(document.createTextNode(note.value.slice(cursor, match.start)));
    const mark = document.createElement('mark');
    mark.textContent = note.value.slice(match.start, match.end);
    if (index === currentMatch) {
      mark.className = 'current';
    }
    highlights.append(mark);
    cursor = match.end;
  });
  // The trailing space keeps a final empty line, which the textarea always renders.
  highlights.append(document.createTextNode(`${note.value.slice(cursor)} `));
  highlights.scrollTop = note.scrollTop;
}

function revealCurrentMatch(): void {
  const mark = highlights.querySelector<HTMLElement>('mark.current');
  if (!mark) {
    return;
  }

  const top = mark.offsetTop;
  const bottom = top + mark.offsetHeight;
  if (top < note.scrollTop || bottom > note.scrollTop + note.clientHeight) {
    note.scrollTop = Math.max(0, top - note.clientHeight / 3);
    highlights.scrollTop = note.scrollTop;
  }
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error('Nooote elements were not found.');
  }
  return element;
}
