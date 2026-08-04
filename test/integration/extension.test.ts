import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';

suite('Shared Scratch Note extension', () => {
  test('activates and registers its Panel view and open command', async () => {
    const extension = vscode.extensions.getExtension('workjerry.shared-scratch-note');
    assert.ok(extension);

    await extension.activate();
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('sharedScratchNote.open'));
    assert.ok(commands.includes('sharedScratchNote.note.focus'));

    const contributions = extension.packageJSON.contributes as {
      views?: Record<string, Array<{ id: string }>>;
      viewsContainers?: { panel?: Array<{ id: string }> };
    };
    assert.equal(contributions.viewsContainers?.panel?.[0]?.id, 'sharedScratchNote');
    assert.equal(contributions.views?.sharedScratchNote?.[0]?.id, 'sharedScratchNote.note');

    await vscode.commands.executeCommand('sharedScratchNote.open');
  });
});
