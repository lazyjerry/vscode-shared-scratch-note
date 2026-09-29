import * as vscode from 'vscode';

import type { Disposable as StorageDisposable, NoteStorage } from './noteStorage';

interface WebviewMessage {
  type: 'ready' | 'input' | 'refresh' | 'save' | 'export';
  content?: unknown;
}

export class NoteViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  static readonly viewType = 'sharedScratchNote.note';

  private view: vscode.WebviewView | undefined;
  private readonly storageSubscriptions: StorageDisposable[];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly storage: NoteStorage,
  ) {
    this.storageSubscriptions = [
      storage.onDidChangeContent((content) => {
        void this.postContent(content);
      }),
      storage.onDidChangeConflict((conflict) => {
        void this.postConflict(conflict);
      }),
    ];
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    const mediaUri = vscode.Uri.joinPath(this.extensionUri, 'media');

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [mediaUri],
    };
    webviewView.webview.html = this.getHtml(webviewView.webview, mediaUri);

    webviewView.webview.onDidReceiveMessage((message: WebviewMessage) => {
      switch (message.type) {
        case 'ready':
          void this.postContent(this.storage.getContent());
          void this.postConflict(this.storage.hasConflict());
          return;
        case 'input':
          if (typeof message.content === 'string') {
            this.storage.scheduleWrite(message.content);
          }
          return;
        case 'refresh':
          void this.storage.reloadShared().catch(showError);
          return;
        case 'save':
          void this.save().catch(showError);
          return;
        case 'export':
          void this.exportToEditor().catch(showError);
          return;
      }
    });

    webviewView.onDidDispose(() => {
      if (this.view === webviewView) {
        this.view = undefined;
      }
    });
  }

  dispose(): void {
    for (const subscription of this.storageSubscriptions) {
      subscription.dispose();
    }
    this.view = undefined;
  }

  private async save(): Promise<void> {
    if (this.storage.hasConflict()) {
      const overwrite = 'Overwrite';
      const choice = await vscode.window.showWarningMessage(
        'The shared note was changed elsewhere. Overwrite it with the content in this window?',
        { modal: true, detail: 'Changes made elsewhere will be lost. Use Export first if you want to keep a copy.' },
        overwrite,
      );
      if (choice !== overwrite) {
        return;
      }
    }

    await this.storage.forceSave();
  }

  private async exportToEditor(): Promise<void> {
    const document = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: this.storage.getContent(),
    });
    await vscode.window.showTextDocument(document);
  }

  private async postContent(content: string): Promise<void> {
    await this.view?.webview.postMessage({ type: 'content', content });
  }

  private async postConflict(conflict: boolean): Promise<void> {
    await this.view?.webview.postMessage({ type: 'conflict', conflict });
  }

  private getHtml(webview: vscode.Webview, mediaUri: vscode.Uri): string {
    const nonce = createNonce();
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'main.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'styles.css'));

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${styleUri}">
  <title>Nooote</title>
</head>
<body>
  <div class="toolbar" role="toolbar" aria-label="Shared scratch note actions">
    <button type="button" id="refresh" title="Discard the content in this window and load the shared note">Refresh</button>
    <span id="conflict-warning" class="warning" role="alert" hidden>
      ⚠ The shared note was changed elsewhere, so auto-save is paused. Refresh loads the shared version and discards this window's edits; Save overwrites the shared version.
    </span>
    <span class="spacer"></span>
    <button type="button" id="save" title="Write the content in this window to the shared note now">Save</button>
    <button type="button" id="export" title="Open the content in this window as a new unsaved editor">Export</button>
  </div>
  <textarea id="note" aria-label="Shared scratch note" placeholder="Write a Markdown note…" spellcheck="true"></textarea>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function showError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  void vscode.window.showErrorMessage(`Nooote: ${message}`);
}

function createNonce(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let index = 0; index < 32; index += 1) {
    nonce += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return nonce;
}
