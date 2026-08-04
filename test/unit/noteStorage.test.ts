import * as assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { NoteStorage } from '../../src/noteStorage';

suite('NoteStorage', () => {
  let directory: string;
  const storages: NoteStorage[] = [];

  setup(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'shared-scratch-note-test-'));
  });

  teardown(async () => {
    for (const storage of storages) {
      await storage.flush();
      storage.dispose();
    }
    storages.length = 0;
    await fs.rm(directory, { recursive: true, force: true });
  });

  test('starts empty and persists content, including an empty note', async () => {
    const storage = createStorage();
    assert.equal(await storage.initialize(), '');

    storage.scheduleWrite('hello');
    await storage.flush();
    assert.equal(await fs.readFile(storage.filePath, 'utf8'), 'hello');

    storage.scheduleWrite('');
    await storage.flush();
    assert.equal(await fs.readFile(storage.filePath, 'utf8'), '');
  });

  test('loads persisted content after restart', async () => {
    await fs.writeFile(path.join(directory, 'shared-note.md'), 'persisted', 'utf8');
    const storage = createStorage();
    assert.equal(await storage.initialize(), 'persisted');
  });

  test('synchronizes two instances that share a storage directory', async () => {
    const first = createStorage();
    const second = createStorage();
    await Promise.all([first.initialize(), second.initialize()]);

    const changed = new Promise<string>((resolve) => second.onDidChangeContent(resolve));
    first.scheduleWrite('from another window');
    await first.flush();

    assert.equal(await withTimeout(changed, 2_000), 'from another window');
    assert.equal(second.getContent(), 'from another window');
  });

  test('uses the last completed write when two instances edit', async () => {
    const first = createStorage();
    const second = createStorage();
    await Promise.all([first.initialize(), second.initialize()]);

    first.scheduleWrite('first');
    await first.flush();
    second.scheduleWrite('second');
    await second.flush();

    await waitFor(() => first.getContent() === 'second', 2_000);
    assert.equal(await fs.readFile(first.filePath, 'utf8'), 'second');
  });

  function createStorage(): NoteStorage {
    const storage = new NoteStorage(directory, 10, 20);
    storages.push(storage);
    return storage;
  }
});

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error(`Timed out after ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
