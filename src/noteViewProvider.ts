import * as vscode from 'vscode';

import type { Disposable as StorageDisposable, NoteStorage } from './noteStorage';

interface WebviewMessage {
  type: 'ready' | 'input';
  content?: unknown;
}

export class NoteViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  static readonly viewType = 'sharedScratchNote.note';

  private view: vscode.WebviewView | undefined;
  private readonly storageSubscription: StorageDisposable;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly storage: NoteStorage,
  ) {
    this.storageSubscription = storage.onDidChangeContent((content) => {
      void this.postContent(content);
    });
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
      if (message.type === 'ready') {
        void this.postContent(this.storage.getContent());
        return;
      }

      if (message.type === 'input' && typeof message.content === 'string') {
        this.storage.scheduleWrite(message.content);
      }
    });

    webviewView.onDidDispose(() => {
      if (this.view === webviewView) {
        this.view = undefined;
      }
    });
  }

  dispose(): void {
    this.storageSubscription.dispose();
    this.view = undefined;
  }

  private async postContent(content: string): Promise<void> {
    await this.view?.webview.postMessage({ type: 'content', content });
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
  <title>Shared Scratch Note</title>
</head>
<body>
  <textarea id="note" aria-label="Shared scratch note" placeholder="Write a Markdown note…" spellcheck="true"></textarea>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function createNonce(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let index = 0; index < 32; index += 1) {
    nonce += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return nonce;
}
