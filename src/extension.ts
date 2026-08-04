import * as vscode from 'vscode';

import { ensureNoteFile, noteFileName } from './noteStorage';

const openCommand = 'sharedScratchNote.open';
const autoSaveDelayMs = 500;

let noteUri: vscode.Uri | undefined;
let saveTimer: NodeJS.Timeout | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  await ensureNoteFile(context.globalStorageUri.fsPath);
  noteUri = vscode.Uri.joinPath(context.globalStorageUri, noteFileName);

  context.subscriptions.push(
    vscode.commands.registerCommand(openCommand, openNote),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (isNote(event.document) && event.contentChanges.length > 0) {
        scheduleSave(event.document);
      }
    }),
    new vscode.Disposable(cancelScheduledSave),
  );
}

export async function deactivate(): Promise<void> {
  cancelScheduledSave();
  await saveNote();
  noteUri = undefined;
}

async function openNote(): Promise<void> {
  if (!noteUri) {
    return;
  }

  try {
    const document = await vscode.workspace.openTextDocument(noteUri);
    await vscode.window.showTextDocument(document, { preview: false });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(
      `Shared Scratch Note could not open ${noteUri.fsPath}: ${message}`,
    );
  }
}

function isNote(document: vscode.TextDocument): boolean {
  return noteUri !== undefined && document.uri.toString() === noteUri.toString();
}

function scheduleSave(document: vscode.TextDocument): void {
  cancelScheduledSave();
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    if (document.isClosed || !document.isDirty) {
      return;
    }

    void Promise.resolve(document.save()).then(undefined, (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      void vscode.window.showErrorMessage(`Shared Scratch Note could not save: ${message}`);
    });
  }, autoSaveDelayMs);
}

function cancelScheduledSave(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
  }
}

async function saveNote(): Promise<void> {
  const document = vscode.workspace.textDocuments.find(isNote);
  if (document?.isDirty) {
    await document.save();
  }
}
