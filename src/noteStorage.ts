import { promises as fs } from 'node:fs';
import path from 'node:path';

export const noteFileName = 'shared-note.md';

export function noteFilePath(storageDirectory: string): string {
  return path.join(storageDirectory, noteFileName);
}

export async function ensureNoteFile(storageDirectory: string): Promise<string> {
  const filePath = noteFilePath(storageDirectory);
  await fs.mkdir(storageDirectory, { recursive: true });
  // 'a' 建立缺少的檔案，既有內容不受影響
  const handle = await fs.open(filePath, 'a');
  await handle.close();
  return filePath;
}
