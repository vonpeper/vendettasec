"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Song } from "@/types";
import { saveSong, getAllSongs, deleteSong } from "@/lib/storage/indexedDb";
import { saveAudioFile, deleteAudioFile } from "@/lib/storage/opfs";
import { AudioEngine } from "@/lib/audio-engine/AudioEngine";
import { 
  ArrowLeft, Plus, Music, Play, Square, Trash2, Edit2, CheckCircle2, 
  AlertOctagon, AlertTriangle, FileAudio, Save, X, Loader2 
} from "lucide-react";

export default function LibraryPage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Mono validation state
  const [monoError, setMonoError] = useState<{ fileName: string } | null>(null);
  
  // Edit song state
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  
  // Preview audio state
  const [previewSongId, setPreviewSongId] = useState<string | null>(null);
  const [previewTime, setPreviewTime] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSongs();
    
    // Stop audio on unmount
    return () => {
      AudioEngine.getInstance().stop();
    };
  }, []);

  const loadSongs = async () => {
    try {
      const data = await getAllSongs();
      // Sort by title
      data.sort((a, b) => a.title.localeCompare(b.title));
      setSongs(data);
    } catch (err) {
      console.error("Error loading songs:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setErrorMsg(null);
    setMonoError(null);

    try {
      const engine = AudioEngine.getInstance();
      
      // 1. Decode to check channels
      const buffer = await engine.decodeAudioFile(file);
      const isStereo = buffer.numberOfChannels === 2;

      const duration = buffer.duration;
      const songId = crypto.randomUUID();
      const storageKey = `audio_${songId}`;

      // 2. Validate Channels
      if (!isStereo) {
        setMonoError({ fileName: file.name });
        // We do not save mono files to database or OPFS for security
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      // 3. Save File to OPFS
      await saveAudioFile(storageKey, file);

      // 4. Save metadata to IndexedDB
      const newSong: Song = {
        id: songId,
        title: file.name.substring(0, file.name.lastIndexOf(".")) || file.name,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        durationSeconds: duration,
        storageKey,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        defaultVolume: 1.0,
        isAvailableOffline: true,
        validationStatus: "valid",
      };

      await saveSong(newSong);
      await loadSongs();

      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      console.error("Error importing file:", err);
      setErrorMsg(err?.message || "Error al procesar el archivo de audio");
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (song: Song) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar la canción "${song.title}"? Esta acción borrará el archivo físico localmente.`)) {
      return;
    }

    try {
      if (previewSongId === song.id) {
        AudioEngine.getInstance().stop();
        setPreviewSongId(null);
      }
      
      await deleteSong(song.id);
      await deleteAudioFile(song.storageKey);
      await loadSongs();
    } catch (err) {
      console.error("Error deleting song:", err);
    }
  };

  const startPreview = async (song: Song) => {
    const engine = AudioEngine.getInstance();

    if (previewSongId === song.id) {
      engine.stop();
      setPreviewSongId(null);
      return;
    }

    try {
      engine.stop();
      setPreviewSongId(song.id);

      // Import the lazy loading file retrieval helper
      const { getAudioFile } = await import("@/lib/storage/opfs");
      const audioFile = await getAudioFile(song.storageKey);
      const buffer = await engine.decodeAudioFile(audioFile);
      
      engine.loadBuffer(buffer);
      engine.setListeners({
        onStatusChange: (status) => {
          if (status === "ended" || status === "stopped") {
            setPreviewSongId(null);
            setPreviewTime(0);
          }
        },
        onTimeUpdate: (time) => {
          setPreviewTime(time);
        }
      });

      await engine.play();
    } catch (err) {
      console.error("Error playing preview:", err);
      setPreviewSongId(null);
    }
  };

  const stopPreview = () => {
    AudioEngine.getInstance().stop();
    setPreviewSongId(null);
    setPreviewTime(0);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSong) return;

    try {
      const updated = {
        ...editingSong,
        updatedAt: new Date().toISOString(),
      };
      await saveSong(updated);
      setEditingSong(null);
      await loadSongs();
    } catch (err) {
      console.error("Error updating song:", err);
    }
  };

  const formatDuration = (sec?: number) => {
    if (!sec) return "0:00";
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return "0 MB";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 -ml-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 transition-colors">
              <ArrowLeft className="w-5 h-5 text-neutral-300" />
            </Link>
            <h1 className="text-xl font-black uppercase tracking-widest text-white">
              Biblioteca de Canciones
            </h1>
          </div>
          
          <div>
            <button
              onClick={handleImportClick}
              disabled={importing}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-500 border border-red-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 flex items-center gap-2 shadow-lg shadow-red-600/10 disabled:opacity-50"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  IMPORTANDO...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  IMPORTAR CANCIÓN
                </>
              )}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="audio/wav,audio/mpeg,audio/x-wav,audio/mp3,audio/m4a,audio/x-m4a,audio/aac"
              className="hidden"
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 flex flex-col gap-8">
        
        {/* Error / Validation Alerts */}
        {errorMsg && (
          <div className="bg-red-950/20 border-2 border-red-500/30 rounded-3xl p-5 flex gap-4 items-center text-red-400">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <span className="text-sm font-semibold">{errorMsg}</span>
          </div>
        )}

        {monoError && (
          <div className="bg-red-950/30 border-2 border-red-500 rounded-3xl p-8 space-y-4">
            <div className="flex items-center gap-3 text-red-500">
              <AlertOctagon className="w-8 h-8 shrink-0" />
              <h3 className="text-xl font-black uppercase tracking-wider">Archivo mono detectado</h3>
            </div>
            <p className="text-sm text-neutral-300 leading-relaxed max-w-2xl">
              El archivo <strong className="text-white">"{monoError.fileName}"</strong> no puede utilizarse en escenario porque Vendetta requiere:
            </p>
            <div className="text-xs font-mono bg-neutral-900 border border-neutral-800 rounded-xl p-4 max-w-xs space-y-1">
              <div className="text-red-400">L (Izquierdo) = CLICK / GUÍAS</div>
              <div className="text-emerald-400">R (Derecho) = SECUENCIA</div>
            </div>
            <p className="text-xs text-neutral-500 italic">
              * Importa un archivo estéreo estricto con ambos canales debidamente separados.
            </p>
            <button 
              onClick={() => setMonoError(null)}
              className="px-6 py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-850 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
            >
              Entendido
            </button>
          </div>
        )}

        {/* Songs List */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-neutral-500 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-red-500" />
            <span className="text-xs font-black uppercase tracking-widest">Cargando biblioteca...</span>
          </div>
        ) : songs.length === 0 ? (
          <div className="flex-1 border-2 border-dashed border-neutral-800 rounded-[2.5rem] p-16 text-center flex flex-col items-center justify-center gap-6 bg-neutral-900/10">
            <div className="w-16 h-16 bg-neutral-900 rounded-3xl flex items-center justify-center text-neutral-600 border border-neutral-800">
              <FileAudio className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-black uppercase tracking-wider text-neutral-400">Biblioteca vacía</h3>
              <p className="text-xs text-neutral-500 max-w-xs mx-auto leading-relaxed">
                Importa archivos estéreo (WAV, MP3) desde el dispositivo para iniciar tu repertorio.
              </p>
            </div>
            <button
              onClick={handleImportClick}
              className="px-6 py-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
            >
              Seleccionar Archivo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {songs.map((song) => (
              <div 
                key={song.id}
                className={`border-2 rounded-[2rem] p-6 bg-neutral-900/30 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all duration-300 ${
                  previewSongId === song.id ? "border-red-600 bg-red-950/5" : "border-neutral-900"
                }`}
              >
                {/* Play and Metadata */}
                <div className="flex items-center gap-5 flex-1">
                  <button
                    onClick={() => startPreview(song)}
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-300 shrink-0 ${
                      previewSongId === song.id
                        ? "bg-red-600 border-red-500 text-white animate-pulse"
                        : "bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-300"
                    }`}
                  >
                    {previewSongId === song.id ? (
                      <Square className="w-5 h-5 fill-white" />
                    ) : (
                      <Play className="w-5 h-5 fill-neutral-300 ml-0.5" />
                    )}
                  </button>
                  
                  <div className="space-y-1">
                    <h4 className="font-black text-lg text-white tracking-wide leading-tight">
                      {song.title}
                    </h4>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500 font-bold uppercase tracking-wide">
                      {song.artist && <span>{song.artist}</span>}
                      {song.artist && <span className="text-neutral-800">•</span>}
                      {song.bpm && <span className="text-red-500 font-mono">{song.bpm} BPM</span>}
                      {song.bpm && <span className="text-neutral-800">•</span>}
                      {song.key && <span className="text-amber-500 font-mono">{song.key}</span>}
                      {song.key && <span className="text-neutral-800">•</span>}
                      <span className="font-mono">{formatDuration(song.durationSeconds)}</span>
                      <span className="text-neutral-800">•</span>
                      <span className="font-mono text-[10px]">{formatSize(song.fileSize)}</span>
                    </div>
                  </div>
                </div>

                {/* Controls and States */}
                <div className="flex items-center gap-3 justify-end shrink-0 border-t border-neutral-900/60 pt-4 md:pt-0 md:border-0">
                  {/* Validation State badge */}
                  {song.validationStatus === "valid" ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/30 border border-emerald-900/50 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Estéreo OK
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/30 border border-red-900/50 text-[10px] font-black text-red-400 uppercase tracking-widest">
                      <AlertTriangle className="w-3.5 h-3.5" /> Faltante
                    </span>
                  )}

                  {/* Actions */}
                  <button
                    onClick={() => setEditingSong(song)}
                    className="p-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 transition-colors text-neutral-400 hover:text-white"
                    title="Editar metadatos"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(song)}
                    className="p-3 rounded-xl bg-neutral-900 hover:bg-red-950/50 border border-neutral-800 hover:border-red-900/40 transition-colors text-neutral-400 hover:text-red-400"
                    title="Eliminar canción"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Edit Metadata */}
        {editingSong && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-neutral-950 border border-neutral-900 rounded-[2.5rem] w-full max-w-lg p-8 space-y-6 shadow-2xl relative">
              <button 
                onClick={() => setEditingSong(null)}
                className="absolute top-8 right-8 p-1.5 rounded-lg hover:bg-neutral-900 text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-1">
                <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">EDITAR DETALLES</span>
                <h3 className="text-xl font-black uppercase text-white tracking-wide">Metadatos de Canción</h3>
              </div>

              <form onSubmit={handleEditSave} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black tracking-widest text-neutral-500">Título</label>
                  <input
                    type="text"
                    required
                    value={editingSong.title}
                    onChange={(e) => setEditingSong({ ...editingSong, title: e.target.value })}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-600 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black tracking-widest text-neutral-500">Artista</label>
                  <input
                    type="text"
                    value={editingSong.artist || ""}
                    onChange={(e) => setEditingSong({ ...editingSong, artist: e.target.value })}
                    placeholder="Opcional"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-600 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black tracking-widest text-neutral-500">BPM</label>
                    <input
                      type="number"
                      value={editingSong.bpm || ""}
                      onChange={(e) => setEditingSong({ ...editingSong, bpm: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="Ej: 120"
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-600 transition-colors font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black tracking-widest text-neutral-500">Tonalidad (Key)</label>
                    <input
                      type="text"
                      value={editingSong.key || ""}
                      onChange={(e) => setEditingSong({ ...editingSong, key: e.target.value })}
                      placeholder="Ej: Am, G#"
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-600 transition-colors font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black tracking-widest text-neutral-500">Notas de Convocatoria</label>
                  <textarea
                    value={editingSong.notes || ""}
                    onChange={(e) => setEditingSong({ ...editingSong, notes: e.target.value })}
                    placeholder="Instrucciones para el escenario..."
                    className="w-full h-24 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-600 transition-colors resize-none"
                  />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingSong(null)}
                    className="px-5 py-3 rounded-xl border border-neutral-800 hover:bg-neutral-900 font-bold text-xs uppercase tracking-wider transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-red-600 hover:bg-red-500 border border-red-500 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" /> Guardar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
