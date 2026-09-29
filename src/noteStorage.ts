import { promises as fs, watchFile, unwatchFile } from 'node:fs';
import path from 'node:path';

type ContentListener = (content: string) => void;
type ConflictListener = (conflict: boolean) => void;
type ErrorListener = (error: Error) => void;

export interface Disposable {
  dispose(): void;
}

export class NoteStorage implements Disposable {
  readonly filePath: string;

  private content = '';
  // Last content known to match the shared file; anything else on disk was written elsewhere.
  private syncedContent = '';
  private conflict = false;
  private pendingContent: string | undefined;
  private saveTimer: NodeJS.Timeout | undefined;
  private localVersion = 0;
  private writeGeneration = 0;
  private writesInFlight = 0;
  private disposed = false;
  private refreshQueue: Promise<void> = Promise.resolve();
  private writeQueue: Promise<void> = Promise.resolve();
  private readonly contentListeners = new Set<ContentListener>();
  private readonly conflictListeners = new Set<ConflictListener>();
  private readonly errorListeners = new Set<ErrorListener>();

  constructor(
    storageDirectory: string,
    private readonly debounceMs = 150,
    private readonly pollIntervalMs = 200,
  ) {
    this.filePath = path.join(storageDirectory, 'shared-note.md');
  }

  async initialize(): Promise<string> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    this.content = await this.readFile();
    this.syncedContent = this.content;
    watchFile(
      this.filePath,
      { interval: this.pollIntervalMs, persistent: false },
      (current, previous) => {
        if (current.mtimeMs === previous.mtimeMs && current.size === previous.size) {
          return;
        }

        this.queueRefresh();
      },
    );

    return this.content;
  }

  getContent(): string {
    return this.content;
  }

  hasConflict(): boolean {
    return this.conflict;
  }

  scheduleWrite(content: string): void {
    if (this.disposed) {
      return;
    }

    this.content = content;
    this.pendingContent = content;
    this.localVersion += 1;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.saveTimer = undefined;
      void this.flush().catch((error: unknown) => this.emitError(error));
    }, this.debounceMs);
  }

  onDidChangeContent(listener: ContentListener): Disposable {
    this.contentListeners.add(listener);
    return { dispose: () => this.contentListeners.delete(listener) };
  }

  onDidChangeConflict(listener: ConflictListener): Disposable {
    this.conflictListeners.add(listener);
    return { dispose: () => this.conflictListeners.delete(listener) };
  }

  onDidError(listener: ErrorListener): Disposable {
    this.errorListeners.add(listener);
    return { dispose: () => this.errorListeners.delete(listener) };
  }

  /** Auto-save path: writes pending input unless the shared file was changed elsewhere. */
  async flush(): Promise<void> {
    this.clearSaveTimer();
    if (this.pendingContent === undefined || this.conflict) {
      await this.writeQueue;
      return;
    }

    const content = this.pendingContent;
    this.pendingContent = undefined;
    await this.enqueueWrite(async () => {
      const shared = await this.readFile();
      if (shared !== this.syncedContent && shared !== content) {
        // Keep the input pending so Save can still write it after the user decides.
        this.pendingContent ??= content;
        this.setConflict(true);
        return;
      }

      await this.writeFile(content);
    });
  }

  /** Writes the local content to the shared file, overwriting changes made elsewhere. */
  async forceSave(): Promise<void> {
    this.clearSaveTimer();
    this.pendingContent = undefined;
    await this.enqueueWrite(async () => {
      await this.writeFile(this.content);
      this.setConflict(false);
    });
  }

  /** Discards local input and loads the shared file. */
  async reloadShared(): Promise<void> {
    this.clearSaveTimer();
    this.pendingContent = undefined;
    await this.writeQueue;
    const shared = await this.readFile();
    this.syncedContent = shared;
    this.content = shared;
    this.localVersion += 1;
    this.setConflict(false);
    this.emitContent(shared);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.clearSaveTimer();
    unwatchFile(this.filePath);
    this.contentListeners.clear();
    this.conflictListeners.clear();
    this.errorListeners.clear();
  }

  private clearSaveTimer(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = undefined;
    }
  }

  private async enqueueWrite(task: () => Promise<void>): Promise<void> {
    this.writesInFlight += 1;
    this.writeQueue = this.writeQueue
      .catch(() => undefined)
      .then(async () => {
        this.writeGeneration += 1;
        try {
          await task();
        } finally {
          this.writesInFlight -= 1;
        }
      });
    await this.writeQueue;
  }

  private async writeFile(content: string): Promise<void> {
    // Write-then-rename so other windows polling the file never read a truncated note.
    const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    try {
      await fs.writeFile(temporaryPath, content, 'utf8');
      await fs.rename(temporaryPath, this.filePath);
    } catch (error: unknown) {
      await fs.rm(temporaryPath, { force: true });
      throw error;
    }
    this.syncedContent = content;
  }

  private queueRefresh(): void {
    this.refreshQueue = this.refreshQueue
      .then(async () => this.refreshFromDisk())
      .catch((error: unknown) => this.emitError(error));
  }

  private async refreshFromDisk(): Promise<void> {
    if (this.disposed || this.writesInFlight > 0) {
      return;
    }

    const localVersion = this.localVersion;
    const writeGeneration = this.writeGeneration;
    const shared = await this.readFile();
    // Re-check after the await: a local write or keystroke during the read makes the result stale.
    if (
      this.disposed ||
      this.writesInFlight > 0 ||
      this.writeGeneration !== writeGeneration ||
      shared === this.syncedContent
    ) {
      return;
    }

    if (shared === this.content) {
      this.syncedContent = shared;
      this.pendingContent = undefined;
      this.setConflict(false);
      return;
    }

    const hasLocalEdits =
      this.localVersion !== localVersion ||
      this.pendingContent !== undefined ||
      this.content !== this.syncedContent;
    if (hasLocalEdits) {
      this.setConflict(true);
      return;
    }

    this.syncedContent = shared;
    this.content = shared;
    this.emitContent(shared);
  }

  private setConflict(conflict: boolean): void {
    if (this.conflict === conflict) {
      return;
    }

    this.conflict = conflict;
    for (const listener of this.conflictListeners) {
      listener(conflict);
    }
  }

  private emitContent(content: string): void {
    for (const listener of this.contentListeners) {
      listener(content);
    }
  }

  private async readFile(): Promise<string> {
    try {
      return await fs.readFile(this.filePath, 'utf8');
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return '';
      }
      throw error;
    }
  }

  private emitError(error: unknown): void {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    for (const listener of this.errorListeners) {
      listener(normalizedError);
    }
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
