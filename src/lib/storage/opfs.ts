/**
 * Origin Private File System (OPFS) storage helpers for audio files.
 * Provides offline storage for large audio binaries.
 */

async function getOpfsDirectory(): Promise<FileSystemDirectoryHandle> {
  if (typeof window === "undefined" || !navigator.storage || !navigator.storage.getDirectory) {
    throw new Error("OPFS is not supported or not available on server-side");
  }
  return await navigator.storage.getDirectory();
}

export async function saveAudioFile(key: string, data: Blob | File): Promise<void> {
  const dir = await getOpfsDirectory();
  const fileHandle = await dir.getFileHandle(key, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(data);
  await writable.close();
}

export async function getAudioFile(key: string): Promise<File> {
  const dir = await getOpfsDirectory();
  const fileHandle = await dir.getFileHandle(key);
  return await fileHandle.getFile();
}

export async function deleteAudioFile(key: string): Promise<void> {
  try {
    const dir = await getOpfsDirectory();
    await dir.removeEntry(key);
  } catch (err: any) {
    // If the file doesn't exist, ignore error
    if (err.name !== "NotFoundError") {
      throw err;
    }
  }
}

export async function audioFileExists(key: string): Promise<boolean> {
  try {
    const dir = await getOpfsDirectory();
    await dir.getFileHandle(key);
    return true;
  } catch (err: any) {
    return false;
  }
}

export async function getStorageEstimate(): Promise<{ used: number; total: number; persist: boolean }> {
  if (typeof window === "undefined" || !navigator.storage || !navigator.storage.estimate) {
    return { used: 0, total: 0, persist: false };
  }
  
  const estimate = await navigator.storage.estimate();
  const persist = navigator.storage.persisted ? await navigator.storage.persisted() : false;
  
  return {
    used: estimate.usage || 0,
    total: estimate.quota || 0,
    persist
  };
}

export async function requestStoragePersistence(): Promise<boolean> {
  if (typeof window === "undefined" || !navigator.storage || !navigator.storage.persist) {
    return false;
  }
  return await navigator.storage.persist();
}
