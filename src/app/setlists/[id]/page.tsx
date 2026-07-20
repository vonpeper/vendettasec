"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Setlist, Song } from "@/types";
import { getSetlist, saveSetlist, getAllSongs } from "@/lib/storage/indexedDb";
import { ArrowLeft, Save, Calendar, Music, Plus, X, ArrowUp, ArrowDown, ChevronRight, HelpCircle } from "lucide-react";

export default function EditSetlistPage() {
  const params = useParams();
  const router = useRouter();
  const setlistId = params.id as string;

  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [librarySongs, setLibrarySongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [name, setName] = useState("");
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadData();
  }, [setlistId]);

  const loadData = async () => {
    if (!setlistId) return;

    try {
      const [targetSetlist, allSongs] = await Promise.all([
        getSetlist(setlistId),
        getAllSongs()
      ]);

      if (!targetSetlist) {
        // Redirect if setlist not found
        router.push("/setlists");
        return;
      }

      setSetlist(targetSetlist);
      setName(targetSetlist.name);
      setEventName(targetSetlist.eventName || "");
      setEventDate(targetSetlist.eventDate || "");
      setNotes(targetSetlist.notes || "");

      // Only allow valid stereo songs in the setlists to be added
      const validSongs = allSongs.filter(s => s.validationStatus === "valid");
      setLibrarySongs(validSongs);
    } catch (err) {
      console.error("Error loading setlist:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = async (fields: Partial<Setlist>) => {
    if (!setlist) return;

    const updated: Setlist = {
      ...setlist,
      ...fields,
      updatedAt: new Date().toISOString()
    };

    setSetlist(updated);
    await saveSetlist(updated);
  };

  const addSongToSetlist = async (songId: string) => {
    if (!setlist) return;

    const updatedSongIds = [...setlist.songIds, songId];
    await handleFieldChange({ songIds: updatedSongIds });
  };

  const removeSongFromSetlist = async (index: number) => {
    if (!setlist) return;

    const updatedSongIds = [...setlist.songIds];
    updatedSongIds.splice(index, 1);
    await handleFieldChange({ songIds: updatedSongIds });
  };

  const moveSong = async (index: number, direction: "up" | "down") => {
    if (!setlist) return;

    const updatedSongIds = [...setlist.songIds];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= updatedSongIds.length) return;

    // Swap elements
    const temp = updatedSongIds[index];
    updatedSongIds[index] = updatedSongIds[targetIndex];
    updatedSongIds[targetIndex] = temp;

    await handleFieldChange({ songIds: updatedSongIds });
  };

  const formatDuration = (sec?: number) => {
    if (!sec) return "0:00";
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const getSetlistDuration = () => {
    if (!setlist) return "0:00";
    let total = 0;
    setlist.songIds.forEach(id => {
      const song = librarySongs.find(s => s.id === id);
      if (song && song.durationSeconds) {
        total += song.durationSeconds;
      }
    });
    const mins = Math.floor(total / 60);
    const secs = Math.floor(total % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center flex-col gap-3">
        <span className="w-6 h-6 border-2 border-red-650 border-t-transparent rounded-full animate-spin" />
        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Cargando editor...</span>
      </div>
    );
  }

  if (!setlist) return null;

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/setlists" className="p-2 -ml-1 sm:-ml-2 rounded-xl bg-neutral-900 hover:bg-neutral-805 border border-neutral-800 transition-colors">
              <ArrowLeft className="w-5 h-5 text-neutral-300" />
            </Link>
            <div>
              <span className="text-[9px] font-black text-red-500 uppercase tracking-[0.2em]">EDITAR SETLIST</span>
              <h1 className="text-base sm:text-lg font-black uppercase tracking-wider text-white truncate max-w-[150px] xs:max-w-xs sm:max-w-md">
                {name || "Sin Nombre"}
              </h1>
            </div>
          </div>
          
          <div className="hidden sm:block text-[10px] font-black uppercase tracking-widest text-neutral-500 bg-neutral-900 border border-neutral-850 px-4 py-2.5 rounded-xl">
            Auto-Guardado Activo
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8">
        
        {/* Setlist settings inputs */}
        <section className="border border-neutral-900 rounded-[1.5rem] sm:rounded-[2.5rem] p-5 sm:p-8 bg-neutral-900/10">
          <div className="space-y-1.5 max-w-md">
            <label className="text-[10px] uppercase font-black tracking-widest text-neutral-500">Nombre del Setlist</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                handleFieldChange({ name: e.target.value });
              }}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-650 transition-colors font-bold"
            />
          </div>
        </section>

        {/* Reordering and selection workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-start">
          
          {/* Library Tracks Selector (Left) */}
          <div className="border border-neutral-900 rounded-[1.5rem] sm:rounded-[2.5rem] p-5 sm:p-6 bg-neutral-900/10 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">PASO 1</span>
                <h3 className="text-lg font-black uppercase text-white tracking-wide">Biblioteca Disponible</h3>
              </div>
              <button
                onClick={async () => {
                  const blockName = window.prompt("Introduce el nombre del bloque (Ej: Bloque 1, Acústico, Pop):");
                  if (!blockName || !blockName.trim()) return;
                  if (!setlist) return;
                  const blockId = `block:${blockName.trim()}`;
                  const updatedSongIds = [...setlist.songIds, blockId];
                  await handleFieldChange({ songIds: updatedSongIds });
                }}
                className="px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-350 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                + BLOQUE
              </button>
            </div>

            {librarySongs.length === 0 ? (
              <div className="text-center py-12 text-neutral-500 text-xs">
                No hay canciones estéreo válidas en la biblioteca. <br />
                <Link href="/library" className="text-red-500 font-bold hover:underline block mt-2">
                  Ir a Biblioteca para importar temas
                </Link>
              </div>
            ) : (
              <div className="space-y-2 max-h-[35vh] sm:max-h-[50vh] overflow-y-auto pr-1">
                {librarySongs.map((song) => (
                  <button
                    key={song.id}
                    onClick={() => addSongToSetlist(song.id)}
                    className="w-full text-left p-3 sm:p-4 bg-neutral-900/40 hover:bg-neutral-900 border border-neutral-900 hover:border-neutral-800 rounded-xl sm:rounded-2xl flex items-center justify-between gap-3 sm:gap-4 transition-all duration-200 group"
                  >
                    <div className="space-y-0.5 truncate">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-white truncate">{song.title}</h4>
                      <p className="text-[10px] text-neutral-500 font-mono">
                        {song.bpm ? `${song.bpm} BPM` : ""} {song.key ? `• ${song.key}` : ""} • {formatDuration(song.durationSeconds)}
                      </p>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-neutral-900 border border-neutral-850 group-hover:bg-red-600 group-hover:border-red-500 flex items-center justify-center text-neutral-400 group-hover:text-white shrink-0 transition-all">
                      <Plus className="w-4 h-4" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Setlist Tracks (Right, Orderer) */}
          <div className="border border-neutral-900 rounded-[1.5rem] sm:rounded-[2.5rem] p-5 sm:p-6 bg-neutral-900/15 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">PASO 2</span>
                <h3 className="text-lg font-black uppercase text-white tracking-wide">Orden del Setlist</h3>
              </div>
              <span className="text-xs font-mono font-bold text-neutral-400 bg-neutral-900 px-3 py-1.5 border border-neutral-850 rounded-xl">
                Duración: {getSetlistDuration()}
              </span>
            </div>

            {setlist.songIds.length === 0 ? (
              <div className="text-center py-16 text-neutral-500 text-xs border border-dashed border-neutral-800 rounded-[1.5rem] p-6 bg-neutral-900/10">
                El setlist está vacío. <br />
                Haz clic en los temas de la izquierda para agregarlos a esta lista.
              </div>
            ) : (
              <div className="space-y-2 max-h-[35vh] sm:max-h-[50vh] overflow-y-auto pr-1">
                {setlist.songIds.map((songId, index) => {
                  const isBlockItem = songId.startsWith("block:");
                  const blockTitle = isBlockItem ? songId.replace("block:", "") : "";
                  const song = !isBlockItem ? librarySongs.find(s => s.id === songId) : undefined;
                  
                  if (isBlockItem) {
                    return (
                      <div
                        key={`block-${index}`}
                        className="p-3 sm:p-4 bg-red-950/20 border border-red-900/40 rounded-xl sm:rounded-2xl flex items-center justify-between gap-3 sm:gap-4 animate-fadeIn"
                      >
                        <div className="flex items-center gap-3 truncate">
                          <span className="text-[9px] font-black text-red-500 bg-red-950/50 px-2 py-1 rounded-md shrink-0 uppercase tracking-widest">
                            BLOQUE
                          </span>
                          <h4 className="font-black text-xs uppercase tracking-wider text-white truncate">
                            {blockTitle}
                          </h4>
                        </div>

                        {/* Controls: Up, Down, Remove */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            disabled={index === 0}
                            onClick={() => moveSong(index, "up")}
                            className="p-1.5 sm:p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all border border-neutral-850"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={index === setlist.songIds.length - 1}
                            onClick={() => moveSong(index, "down")}
                            className="p-1.5 sm:p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all border border-neutral-850"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => removeSongFromSetlist(index)}
                            className="p-1.5 sm:p-2 rounded-lg bg-neutral-900 hover:bg-red-950/40 text-neutral-400 hover:text-red-400 transition-all border border-neutral-850"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`${songId}-${index}`}
                      className="p-3 sm:p-4 bg-neutral-900/60 border border-neutral-900 rounded-xl sm:rounded-2xl flex items-center justify-between gap-3 sm:gap-4"
                    >
                      <div className="flex items-center gap-3 truncate">
                        <span className="font-mono text-xs font-bold text-neutral-500 bg-neutral-950 w-7 h-7 shrink-0 rounded-lg flex items-center justify-center">
                          {setlist.songIds.slice(0, index).filter(id => !id.startsWith("block:")).length + 1}
                        </span>
                        
                        <div className="truncate">
                          <h4 className="font-bold text-xs uppercase tracking-wider text-white truncate">
                            {song ? song.title : "Canción no encontrada"}
                          </h4>
                          {song && (
                            <p className="text-[10px] text-neutral-500 font-mono">
                              {song.bpm ? `${song.bpm} BPM` : ""} {song.key ? `• ${song.key}` : ""} • {formatDuration(song.durationSeconds)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Controls: Up, Down, Remove */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          disabled={index === 0}
                          onClick={() => moveSong(index, "up")}
                          className="p-1.5 sm:p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all border border-neutral-850"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={index === setlist.songIds.length - 1}
                          onClick={() => moveSong(index, "down")}
                          className="p-1.5 sm:p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all border border-neutral-850"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => removeSongFromSetlist(index)}
                          className="p-1.5 sm:p-2 rounded-lg bg-neutral-900 hover:bg-red-950/40 text-neutral-400 hover:text-red-400 transition-all border border-neutral-850"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
