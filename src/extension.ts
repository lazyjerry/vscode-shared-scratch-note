import * as vscode from 'vscode';

import { NoteStorage } from './noteStorage';
import { NoteViewProvider } from './noteViewProvider';

const openCommand = 'sharedScratchNote.open';
const viewFocusCommand = 'sharedScratchNote.note.focus';

let activeStorage: NoteStorage | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const storage = new NoteStorage(context.globalStorageUri.fsPath);
  activeStorage = storage;
  await storage.initialize();

  const provider = new NoteViewProvider(context.extensionUri, storage);
  const errorSubscription = storage.onDidError((error) => {
    void vscode.window.showErrorMessage(`Shared Scratch Note could not save: ${error.message}`);
  });

  context.subscriptions.push(
    storage,
    provider,
    errorSubscription,
    vscode.window.registerWebviewViewProvider(NoteViewProvider.viewType, provider),
    vscode.commands.registerCommand(openCommand, async () => {
      await vscode.commands.executeCommand(viewFocusCommand);
    }),
  );
}

export async function deactivate(): Promise<void> {
  await activeStorage?.flush();
  activeStorage?.dispose();
  activeStorage = undefined;
}
