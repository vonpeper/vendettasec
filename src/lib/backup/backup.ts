import JSZip from "jszip";
import { getAllSongs, getAllSetlists, saveSong, saveSetlist, saveSetting } from "../storage/indexedDb";
import { getAudioFile, saveAudioFile } from "../storage/opfs";

// Helper to clear IndexedDB stores
async function clearIndexedDb(): Promise<void> {
  const DB_NAME = "vendetta_player_db";
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = (event: any) => {
      const db = event.target.result;
      const tx = db.transaction(["songs", "setlists", "settings"], "readwrite");
      
      tx.objectStore("songs").clear();
      tx.objectStore("setlists").clear();
      tx.objectStore("settings").clear();
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = (event: any) => reject(event.target.error);
  });
}

// Helper to clear OPFS files
async function clearOpfs(): Promise<void> {
  if (typeof window === "undefined" || !navigator.storage || !navigator.storage.getDirectory) {
    return;
  }
  const dir = await navigator.storage.getDirectory();
  // Using entries() iteration to remove entries
  for await (const name of (dir as any).keys()) {
    try {
      await dir.removeEntry(name, { recursive: true });
    } catch (e) {
      console.warn("Error removing OPFS entry:", name, e);
    }
  }
}

export async function exportBackup(onProgress?: (progress: number) => void): Promise<void> {
  const zip = new JSZip();

  // 1. Fetch metadata
  const songs = await getAllSongs();
  const setlists = await getAllSetlists();
  
  // Custom fetch settings manually
  const settingsKeys = ["last_stage_song_id", "last_selected_setlist_id", "last_diagnostics_test", "autoplay_enabled", "show_clock_on_stage", "show_battery_on_stage"];
  const settings: Record<string, any> = {};
  
  const DB_NAME = "vendetta_player_db";
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = (event: any) => {
      const db = event.target.result;
      const tx = db.transaction("settings", "readonly");
      const store = tx.objectStore("settings");
      
      let pending = settingsKeys.length;
      if (pending === 0) resolve();

      settingsKeys.forEach(key => {
        const req = store.get(key);
        req.onsuccess = () => {
          if (req.result !== undefined) {
            settings[key] = req.result;
          }
          pending--;
          if (pending === 0) resolve();
        };
        req.onerror = () => {
          pending--;
          if (pending === 0) resolve();
        };
      });
    };
    request.onerror = () => reject(request.error);
  });

  const metadata = {
    version: 1,
    exportedAt: new Date().toISOString(),
    songs,
    setlists,
    settings
  };

  // 2. Add metadata.json to zip
  zip.file("metadata.json", JSON.stringify(metadata, null, 2));

  // 3. Add audio files to zip
  const audioFolder = zip.folder("audio");
  if (!audioFolder) throw new Error("Could not create audio folder in ZIP");

  const totalSongs = songs.length;
  for (let i = 0; i < totalSongs; i++) {
    const song = songs[i];
    try {
      const fileBlob = await getAudioFile(song.storageKey);
      audioFolder.file(song.storageKey, fileBlob);
    } catch (e) {
      console.warn("Could not find physical file for song:", song.title, e);
    }
    
    if (onProgress) {
      onProgress(Math.round(((i + 1) / totalSongs) * 100));
    }
  }

  // 4. Generate zip blob
  const zipBlob = await zip.generateAsync({ type: "blob" });

  // 5. Download in browser
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  const dateStr = new Date().toISOString().split("T")[0];
  a.href = url;
  a.download = `vendetta_backup_${dateStr}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importBackup(zipFile: File, onProgress?: (progress: number) => void): Promise<void> {
  // Load ZIP
  const zip = await JSZip.loadAsync(zipFile);

  // Read metadata.json
  const metadataFile = zip.file("metadata.json");
  if (!metadataFile) {
    throw new Error("El archivo no es un respaldo válido de Vendetta (falta metadata.json)");
  }

  const metadataStr = await metadataFile.async("string");
  const metadata = JSON.parse(metadataStr);

  if (!metadata.songs || !metadata.setlists) {
    throw new Error("Estructura de metadatos corrupta en el archivo de respaldo");
  }

  // Clear current data completely to write backup cleanly
  await clearIndexedDb();
  await clearOpfs();

  // Restore Settings
  if (metadata.settings) {
    for (const [key, value] of Object.entries(metadata.settings)) {
      await saveSetting(key, value);
    }
  }

  // Restore Setlists
  for (const setlist of metadata.setlists) {
    await saveSetlist(setlist);
  }

  // Restore Songs and Audio Files
  const songs = metadata.songs;
  const totalSongs = songs.length;
  
  for (let i = 0; i < totalSongs; i++) {
    const song = songs[i];
    
    // Save metadata
    await saveSong(song);

    // Save audio file to OPFS
    const zipAudioFile = zip.file(`audio/${song.storageKey}`);
    if (zipAudioFile) {
      const audioBlob = await zipAudioFile.async("blob");
      await saveAudioFile(song.storageKey, audioBlob);
    } else {
      console.warn("Physical file not found in backup ZIP for:", song.title);
    }

    if (onProgress) {
      onProgress(Math.round(((i + 1) / totalSongs) * 100));
    }
  }
}
