import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';

suite('Shared Scratch Note extension', () => {
  test('opens the note as a native text editor and saves it automatically', async () => {
    const extension = vscode.extensions.getExtension('workjerry.shared-scratch-note');
    assert.ok(extension);

    await extension.activate();
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('sharedScratchNote.open'));

    await vscode.commands.executeCommand('sharedScratchNote.open');
    const editor = vscode.window.activeTextEditor;
    assert.ok(editor);
    assert.ok(editor.document.uri.fsPath.endsWith('shared-note.md'));
    assert.equal(editor.document.languageId, 'markdown');

    await editor.edit((builder) => {
      builder.insert(new vscode.Position(0, 0), 'hello');
    });
    assert.ok(editor.document.isDirty);

    await waitFor(() => !editor.document.isDirty, 5_000);
    assert.equal(editor.document.getText(), 'hello');
  });
});

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error(`Timed out after ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
