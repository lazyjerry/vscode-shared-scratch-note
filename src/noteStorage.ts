import { promises as fs, watchFile, unwatchFile } from 'node:fs';
import path from 'node:path';

type ContentListener = (content: string) => void;
type ErrorListener = (error: Error) => void;

export interface Disposable {
  dispose(): void;
}

export class NoteStorage implements Disposable {
  readonly filePath: string;

  private content = '';
  private pendingContent: string | undefined;
  private saveTimer: NodeJS.Timeout | undefined;
  private writeInProgress = false;
  private disposed = false;
  private refreshQueue: Promise<void> = Promise.resolve();
  private writeQueue: Promise<void> = Promise.resolve();
  private readonly contentListeners = new Set<ContentListener>();
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

  scheduleWrite(content: string): void {
    if (this.disposed) {
      return;
    }

    this.content = content;
    this.pendingContent = content;
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

  onDidError(listener: ErrorListener): Disposable {
    this.errorListeners.add(listener);
    return { dispose: () => this.errorListeners.delete(listener) };
  }

  async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = undefined;
    }

    if (this.pendingContent === undefined) {
      await this.writeQueue;
      return;
    }

    const content = this.pendingContent;
    this.pendingContent = undefined;
    this.writeQueue = this.writeQueue.then(async () => {
      this.writeInProgress = true;
      try {
        await fs.writeFile(this.filePath, content, 'utf8');
        this.content = content;
      } finally {
        this.writeInProgress = false;
      }
    });

    await this.writeQueue;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = undefined;
    }
    unwatchFile(this.filePath);
    this.contentListeners.clear();
    this.errorListeners.clear();
  }

  private queueRefresh(): void {
    this.refreshQueue = this.refreshQueue
      .then(async () => this.refreshFromDisk())
      .catch((error: unknown) => this.emitError(error));
  }

  private async refreshFromDisk(): Promise<void> {
    if (this.disposed || this.pendingContent !== undefined || this.writeInProgress) {
      return;
    }

    const content = await this.readFile();
    if (content === this.content) {
      return;
    }

    this.content = content;
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
