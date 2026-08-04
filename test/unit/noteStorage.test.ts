import * as assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ensureNoteFile, noteFilePath } from '../../src/noteStorage';

suite('note file', () => {
  let directory: string;

  setup(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'shared-scratch-note-test-'));
  });

  teardown(async () => {
    await fs.rm(directory, { recursive: true, force: true });
  });

  test('creates an empty note under the storage directory', async () => {
    const nested = path.join(directory, 'globalStorage');
    const filePath = await ensureNoteFile(nested);

    assert.equal(filePath, noteFilePath(nested));
    assert.equal(await fs.readFile(filePath, 'utf8'), '');
  });

  test('keeps existing content untouched', async () => {
    await fs.writeFile(noteFilePath(directory), 'persisted', 'utf8');
    const filePath = await ensureNoteFile(directory);

    assert.equal(await fs.readFile(filePath, 'utf8'), 'persisted');
  });

  test('is idempotent', async () => {
    await ensureNoteFile(directory);
    await fs.writeFile(noteFilePath(directory), 'kept', 'utf8');
    await ensureNoteFile(directory);

    assert.equal(await fs.readFile(noteFilePath(directory), 'utf8'), 'kept');
  });
});
