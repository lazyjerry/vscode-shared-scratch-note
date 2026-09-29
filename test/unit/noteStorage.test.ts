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

  test('does not push its own saved content back while the user keeps typing', async () => {
    const restoreReadFile = slowDownReadFile(60);
    try {
      const storage = new NoteStorage(directory, 40, 20);
      storages.push(storage);
      await storage.initialize();
      const pushed: string[] = [];
      storage.onDidChangeContent((content) => pushed.push(content));

      let text = '';
      for (const character of '今天要記錄的事情一二三四五') {
        text += character;
        storage.scheduleWrite(text);
        await delay(50);
      }
      await storage.flush();
      await delay(200);

      assert.deepEqual(pushed, []);
      assert.equal(storage.hasConflict(), false);
      assert.equal(await fs.readFile(storage.filePath, 'utf8'), text);
    } finally {
      restoreReadFile();
    }
  });

  test('flags a conflict instead of overwriting a change made elsewhere', async () => {
    const first = createStorage();
    const second = createStorage();
    await Promise.all([first.initialize(), second.initialize()]);
    const pushed: string[] = [];
    second.onDidChangeContent((content) => pushed.push(content));

    // Local input that has not reached disk when the other window saves.
    second.scheduleWrite('second');
    first.scheduleWrite('first');
    await first.flush();
    await second.flush();

    await waitFor(() => second.hasConflict(), 2_000);
    await delay(100);
    assert.equal(await fs.readFile(first.filePath, 'utf8'), 'first');
    assert.equal(second.getContent(), 'second');
    assert.deepEqual(pushed, []);

    second.scheduleWrite('second, still typing');
    await second.flush();
    assert.equal(await fs.readFile(first.filePath, 'utf8'), 'first', 'auto-save stays paused');
  });

  test('reloadShared discards local input and clears the conflict', async () => {
    const first = createStorage();
    const second = createStorage();
    await Promise.all([first.initialize(), second.initialize()]);

    second.scheduleWrite('local');
    first.scheduleWrite('shared');
    await first.flush();
    await second.flush();
    await waitFor(() => second.hasConflict(), 2_000);

    const pushed = new Promise<string>((resolve) => second.onDidChangeContent(resolve));
    await second.reloadShared();

    assert.equal(await withTimeout(pushed, 2_000), 'shared');
    assert.equal(second.getContent(), 'shared');
    assert.equal(second.hasConflict(), false);
    assert.equal(await fs.readFile(second.filePath, 'utf8'), 'shared');

    second.scheduleWrite('shared, edited');
    await second.flush();
    assert.equal(await fs.readFile(second.filePath, 'utf8'), 'shared, edited');
  });

  test('forceSave overwrites the shared note and resumes auto-save', async () => {
    const first = createStorage();
    const second = createStorage();
    await Promise.all([first.initialize(), second.initialize()]);

    second.scheduleWrite('local');
    first.scheduleWrite('shared');
    await first.flush();
    await second.flush();
    await waitFor(() => second.hasConflict(), 2_000);

    await second.forceSave();
    assert.equal(await fs.readFile(second.filePath, 'utf8'), 'local');
    assert.equal(second.hasConflict(), false);
    await waitFor(() => first.getContent() === 'local', 2_000);

    second.scheduleWrite('local, edited');
    await second.flush();
    assert.equal(await fs.readFile(second.filePath, 'utf8'), 'local, edited');
  });

  function createStorage(): NoteStorage {
    const storage = new NoteStorage(directory, 10, 20);
    storages.push(storage);
    return storage;
  }
});

function slowDownReadFile(delayMs: number): () => void {
  const original = fs.readFile;
  (fs as { readFile: unknown }).readFile = async (...args: Parameters<typeof fs.readFile>) => {
    const result = await original(...args);
    await delay(delayMs);
    return result;
  };
  return () => {
    (fs as { readFile: unknown }).readFile = original;
  };
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

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
