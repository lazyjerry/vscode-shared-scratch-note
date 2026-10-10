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
          void this.refresh().catch(showError);
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

  private async refresh(): Promise<void> {
    // Without a conflict, auto-save keeps this window and the shared note in sync both ways.
    if (!this.storage.hasConflict()) {
      void vscode.window.showInformationMessage('Nooote: The note is already in sync with the shared note.');
      return;
    }

    await this.storage.reloadShared();
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
    <button type="button" id="refresh" class="icon-button" aria-disabled="true" aria-label="Refresh" title="Already in sync with the shared note">${icon('M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7')}</button>
    <span id="conflict-warning" class="warning" role="alert" hidden>
      ⚠ The shared note was changed elsewhere, so auto-save is paused. Refresh loads the shared version and discards this window's edits; Save overwrites the shared version.
    </span>
    <span class="spacer"></span>
    <div class="find" role="search">
      <input type="text" id="find" aria-label="Find" placeholder="Find" spellcheck="false">
      <span id="find-count" class="find-count" aria-live="polite"></span>
      <button type="button" id="match-case" class="icon-button text-icon" aria-pressed="false" aria-label="Match Case" title="Match Case">Aa</button>
      <button type="button" id="find-previous" class="icon-button" aria-label="Previous Match" title="Previous Match (Shift+Enter)">${icon('M12 19V5M6 11l6-6 6 6')}</button>
      <button type="button" id="find-next" class="icon-button" aria-label="Next Match" title="Next Match (Enter)">${icon('M12 5v14M6 13l6 6 6-6')}</button>
      <input type="text" id="replace" aria-label="Replace" placeholder="Replace" spellcheck="false">
      <button type="button" id="replace-one" class="icon-button" aria-label="Replace" title="Replace (Enter)">${icon('M4 7h12m-3-3 3 3-3 3M20 17H8m3-3-3 3 3 3')}</button>
      <button type="button" id="replace-all" class="icon-button" aria-label="Replace All" title="Replace All (Ctrl/Cmd+Enter)">${icon('M3 6h11m-3-3 3 3-3 3M3 15h11m-3-3 3 3-3 3M19 4v16M3 20h11')}</button>
    </div>
    <button type="button" id="save" class="icon-button" aria-label="Save" title="Write the content in this window to the shared note now">${icon('M5 3h11l3 3v15H5zM8 3v5h7V3M8 21v-7h8v7')}</button>
    <button type="button" id="export" class="icon-button" aria-label="Export" title="Open the content in this window as a new unsaved editor">${icon('M14 4h6v6M20 4l-9 9M18 14v6H4V6h6')}</button>
  </div>
  <div class="editor">
    <div id="highlights" class="highlights" aria-hidden="true"></div>
    <textarea id="note" aria-label="Shared scratch note" placeholder="Write a Markdown note…" spellcheck="true"></textarea>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function showError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  void vscode.window.showErrorMessage(`Nooote: ${message}`);
}

function icon(path: string): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
}

function createNonce(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let index = 0; index < 32; index += 1) {
    nonce += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return nonce;
}
