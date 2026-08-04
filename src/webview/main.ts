import {
  continueList,
  indentList,
  insertLink,
  pasteUrlOverSelection,
  wrapSelection,
  type EditResult,
} from './markdownEditing';

interface VsCodeApi {
  postMessage(message: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();
const note = document.querySelector<HTMLTextAreaElement>('#note');

if (!note) {
  throw new Error('Shared Scratch Note textarea was not found.');
}

note.addEventListener('input', () => {
  vscode.postMessage({ type: 'input', content: note.value });
});

note.addEventListener('keydown', (event) => {
  if (event.isComposing) {
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
  if (!isContentMessage(event.data) || event.data.content === note.value) {
    return;
  }

  const selectionStart = Math.min(note.selectionStart, event.data.content.length);
  const selectionEnd = Math.min(note.selectionEnd, event.data.content.length);
  note.value = event.data.content;
  note.setSelectionRange(selectionStart, selectionEnd);
});

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
