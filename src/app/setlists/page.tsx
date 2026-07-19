"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Setlist, Song } from "@/types";
import { getAllSetlists, saveSetlist, deleteSetlist, getAllSongs, saveSetting } from "@/lib/storage/indexedDb";
import { ArrowLeft, Plus, Calendar, Music, Play, Edit2, Copy, Trash2, Clock, X, Save } from "lucide-react";

export default function SetlistsPage() {
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [allSetlists, allSongs] = await Promise.all([
        getAllSetlists(),
        getAllSongs()
      ]);
      // Sort setlists by updatedAt desc
      allSetlists.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setSetlists(allSetlists);
      setSongs(allSongs);
    } catch (err) {
      console.error("Error loading setlists data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const newSet: Setlist = {
        id: crypto.randomUUID(),
        name: newName.trim(),
        songIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveSetlist(newSet);
      setIsCreateOpen(false);
      
      // Reset form
      setNewName("");

      await loadData();
    } catch (err) {
      console.error("Error creating setlist:", err);
    }
  };

  const handleDuplicate = async (setlist: Setlist) => {
    try {
      const duplicated: Setlist = {
        ...setlist,
        id: crypto.randomUUID(),
        name: `${setlist.name} Copia`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveSetlist(duplicated);
      await loadData();
    } catch (err) {
      console.error("Error duplicating setlist:", err);
    }
  };

  const handleDelete = async (setlist: Setlist) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el setlist "${setlist.name}"? Las canciones de la biblioteca no se borrarán.`)) {
      return;
    }

    try {
      await deleteSetlist(setlist.id);
      await loadData();
    } catch (err) {
      console.error("Error deleting setlist:", err);
    }
  };

  const handleLaunchStage = async (setlistId: string) => {
    try {
      await saveSetting("last_selected_setlist_id", setlistId);
      // Remove any leftover single song stage session so it loads the setlist instead
      await saveSetting("last_stage_song_id", null);
    } catch (err) {
      console.error("Error launching stage for setlist:", err);
    }
  };

  const getSetlistDuration = (songIds: string[]) => {
    let total = 0;
    songIds.forEach(id => {
      const song = songs.find(s => s.id === id);
      if (song && song.durationSeconds) {
        total += song.durationSeconds;
      }
    });
    
    const hours = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = Math.floor(total % 60);

    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
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
              Setlists
            </h1>
          </div>
          
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-500 border border-red-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 flex items-center gap-2 shadow-lg shadow-red-650/10"
          >
            <Plus className="w-4 h-4" />
            NUEVO SETLIST
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-neutral-500 gap-3">
            <span className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-widest">Cargando setlists...</span>
          </div>
        ) : setlists.length === 0 ? (
          <div className="border-2 border-dashed border-neutral-800 rounded-[2.5rem] p-16 text-center flex flex-col items-center justify-center gap-6 bg-neutral-900/10 max-w-2xl mx-auto">
            <div className="w-16 h-16 bg-neutral-900 rounded-3xl flex items-center justify-center text-neutral-600 border border-neutral-800">
              <Music className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-black uppercase tracking-wider text-neutral-400">Sin Setlists</h3>
              <p className="text-xs text-neutral-500 max-w-xs mx-auto leading-relaxed">
                Crea un setlist para agrupar y ordenar los temas que vas a reproducir en el escenario.
              </p>
            </div>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-6 py-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
            >
              Crear Nuevo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {setlists.map((set) => (
              <div 
                key={set.id}
                className="border-2 border-neutral-900 rounded-[2.5rem] p-8 bg-neutral-900/10 flex flex-col justify-between gap-6 hover:border-neutral-850 transition-all duration-300"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">{set.songIds.length} TEMAS</span>
                    <span className="text-[10px] font-mono font-bold text-neutral-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-neutral-600" /> {getSetlistDuration(set.songIds)}
                    </span>
                  </div>
                  
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black uppercase text-white tracking-wide truncate">{set.name}</h3>
                  </div>
                </div>

                {/* Card footer buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-neutral-900/60">
                  <Link
                    href="/stage"
                    onClick={() => handleLaunchStage(set.id)}
                    className="flex-1 min-w-[120px] px-4 py-3 bg-red-650/15 hover:bg-red-600 border border-red-900/30 hover:border-red-500 text-red-400 hover:text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 shadow-lg shadow-red-650/5"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" /> ESCENARIO
                  </Link>
                  <Link
                    href={`/setlists/${set.id}`}
                    className="px-4 py-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Link>
                  <button
                    onClick={() => handleDuplicate(set)}
                    className="px-4 py-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                    title="Duplicar Setlist"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(set)}
                    className="px-4 py-3 bg-neutral-900 hover:bg-red-950/40 border border-neutral-800 hover:border-red-900/40 text-neutral-400 hover:text-red-400 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                    title="Eliminar Setlist"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Create Setlist */}
        {isCreateOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-neutral-950 border border-neutral-900 rounded-[2.5rem] w-full max-w-lg p-8 space-y-6 shadow-2xl relative">
              <button 
                onClick={() => setIsCreateOpen(false)}
                className="absolute top-8 right-8 p-1.5 rounded-lg hover:bg-neutral-900 text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-1">
                <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">NUEVA PLAYLIST</span>
                <h3 className="text-xl font-black uppercase text-white tracking-wide">Crear Setlist</h3>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black tracking-widest text-neutral-500">Nombre del Setlist</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Show Boda Pepe y Ana"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-600 transition-colors"
                  />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-5 py-3 rounded-xl border border-neutral-800 hover:bg-neutral-900 font-bold text-xs uppercase tracking-wider transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-red-600 hover:bg-red-500 border border-red-500 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" /> Crear
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
