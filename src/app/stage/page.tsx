"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Song, PlaybackStatus } from "@/types";
import { getAllSongs, saveSetting, getSetting, getSetlist } from "@/lib/storage/indexedDb";
import { getAudioFile } from "@/lib/storage/opfs";
import { AudioEngine } from "@/lib/audio-engine/AudioEngine";
import { 
  ArrowLeft, Play, Pause, Square, SkipForward, SkipBack, Lock, Unlock, 
  RotateCcw, Battery, Clock, WifiOff, VolumeX, ShieldAlert, Loader2 
} from "lucide-react";

export default function StagePage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Playback state
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Safe Stage Mode flags
  const [isLocked, setIsLocked] = useState(false);
  
  // Clock and battery
  const [currentTimeClock, setCurrentTimeClock] = useState("");
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  
  // Wake lock
  const [wakeLock, setWakeLock] = useState<any>(null);
  
  // Mobile responsive sidebar drawer state
  const [isListOpen, setIsListOpen] = useState(false);
  
  // Loaded setlist metadata
  const [setlistName, setSetlistName] = useState<string | null>(null);

  // User Settings configuration
  const [autoplayEnabled, setAutoplayEnabled] = useState(false);
  const [showClockSetting, setShowClockSetting] = useState(true);
  const [showBatterySetting, setShowBatterySetting] = useState(true);

  useEffect(() => {
    loadSongsAndSession();

    // Setup digital clock
    const clockInterval = setInterval(() => {
      const now = new Date();
      setCurrentTimeClock(now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);

    // Setup battery status
    if (typeof window !== "undefined" && "getBattery" in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener("levelchange", () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      });
    }

    // Enable screen wake lock to keep screen on
    requestWakeLock();

    // Clean up
    return () => {
      clearInterval(clockInterval);
      releaseWakeLock();
      AudioEngine.getInstance().stop();
    };
  }, []);

  // Keyboard controls listener (Stage Hotkeys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }

      const key = e.key;

      if (key === " " || key === "Enter") {
        e.preventDefault();
        handlePlayPause();
      } else if (key === "ArrowRight") {
        e.preventDefault();
        if (currentIndex < songs.length - 1) {
          selectSong(currentIndex + 1);
        }
      } else if (key === "ArrowLeft") {
        e.preventDefault();
        if (!isLocked && currentIndex > 0) {
          selectSong(currentIndex - 1);
        }
      } else if (key === "Escape") {
        e.preventDefault();
        if (!isLocked) {
          handleStop();
        } else {
          if (window.confirm("¿Seguro de detener la secuencia? Controles bloqueados.")) {
            handleStop();
          }
        }
      } else if (key === "Home") {
        e.preventDefault();
        if (!isLocked) {
          handleRestartSong();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentIndex, songs, isLocked, playbackStatus]);

  const requestWakeLock = async () => {
    if (typeof window !== "undefined" && "wakeLock" in navigator) {
      try {
        const lock = await (navigator as any).wakeLock.request("screen");
        setWakeLock(lock);
        console.log("⚡ Wake Lock adquirido con éxito. Pantalla activa.");
      } catch (err) {
        console.warn("⚠️ Wake Lock no soportado o rechazado:", err);
      }
    }
  };

  const releaseWakeLock = () => {
    if (wakeLock) {
      wakeLock.release().then(() => setWakeLock(null));
    }
  };

  const loadSongsAndSession = async () => {
    try {
      const allSongs = await getAllSongs();
      // Filter out any songs that are not valid (e.g. mono files are blocked from stage)
      const validSongs = allSongs.filter(s => s.validationStatus === "valid");
      
      const activeSetlistId = await getSetting<string>("last_selected_setlist_id");
      let activeSongs = validSongs;

      if (activeSetlistId) {
        const setlistObj = await getSetlist(activeSetlistId);
        if (setlistObj) {
          setSetlistName(setlistObj.name);
          const mapped: Song[] = [];
          setlistObj.songIds.forEach(id => {
            const foundSong = validSongs.find(s => s.id === id);
            if (foundSong) mapped.push(foundSong);
          });
          activeSongs = mapped;
        }
      } else {
        setSetlistName(null);
      }

      setSongs(activeSongs);

      // Load Settings
      const autoplayVal = await getSetting<boolean>("autoplay_enabled");
      const showClockVal = await getSetting<boolean>("show_clock_on_stage");
      const showBatteryVal = await getSetting<boolean>("show_battery_on_stage");

      setAutoplayEnabled(autoplayVal || false);
      setShowClockSetting(showClockVal !== null ? showClockVal : true);
      setShowBatterySetting(showBatteryVal !== null ? showBatteryVal : true);

      if (activeSongs.length > 0) {
        const lastSongId = await getSetting<string>("last_stage_song_id");
        const found = activeSongs.find(s => s.id === lastSongId);
        if (found && activeSongs.indexOf(found) !== -1) {
          setCurrentSong(found);
          setCurrentIndex(activeSongs.indexOf(found));
          await prepareAudio(found);
        } else {
          setCurrentSong(activeSongs[0]);
          setCurrentIndex(0);
          await prepareAudio(activeSongs[0]);
        }
      }
    } catch (err) {
      console.error("Error loading stage session:", err);
    }
  };

  const prepareAudio = async (song: Song, autoStart = false) => {
    const engine = AudioEngine.getInstance();
    engine.stop();
    setPlaybackStatus("loading");
    setCurrentTime(0);
    setDuration(song.durationSeconds || 0);

    try {
      // 1. Get Physical File from OPFS
      const audioFile = await getAudioFile(song.storageKey);
      
      // 2. Decode Audio
      const buffer = await engine.decodeAudioFile(audioFile);
      
      // 3. Load Buffer to Engine
      engine.loadBuffer(buffer);
      setPlaybackStatus("ready");

      // 4. Set Event Listeners
      engine.setListeners({
        onStatusChange: (status) => {
          setPlaybackStatus(status);
          if (status === "ended") {
            handleSongEnded();
          }
        },
        onTimeUpdate: (time) => {
          setCurrentTime(time);
        }
      });
      
      // 5. Save last loaded song session
      await saveSetting("last_stage_song_id", song.id);

      if (autoStart) {
        setTimeout(async () => {
          try {
            await engine.play();
          } catch (e) {
            console.error("Error playing next song automatically:", e);
          }
        }, 100);
      }
    } catch (err) {
      console.error("Error preparing audio node:", err);
      setPlaybackStatus("error");
    }
  };

  const handlePlayPause = async () => {
    if (playbackStatus === "idle" || playbackStatus === "loading") return;

    const engine = AudioEngine.getInstance();
    try {
      if (playbackStatus === "playing") {
        engine.pause();
      } else {
        await engine.play();
      }
    } catch (err) {
      console.error("Error toggling play/pause:", err);
    }
  };

  const handleStop = () => {
    AudioEngine.getInstance().stop();
  };

  const handleSongEnded = () => {
    if (currentIndex < songs.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextSong = songs[nextIndex];
      setCurrentIndex(nextIndex);
      setCurrentSong(nextSong);
      prepareAudio(nextSong, autoplayEnabled);
    }
  };

  const selectSong = async (index: number) => {
    if (isLocked) return;
    if (index < 0 || index >= songs.length) return;
    
    const target = songs[index];
    setCurrentIndex(index);
    setCurrentSong(target);
    await prepareAudio(target);
  };

  const handleRestartSong = () => {
    if (isLocked) return;
    AudioEngine.getInstance().seek(0);
  };

  const handleProgressBarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLocked) return;
    const value = parseFloat(e.target.value);
    AudioEngine.getInstance().seek(value);
  };

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const nextSongName = currentIndex < songs.length - 1 
    ? songs[currentIndex + 1].title 
    : "FIN DEL SETLIST";

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col justify-between select-none">
      {/* Top Bar info */}
      <header className="border-b border-neutral-900 bg-neutral-950 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            href="/" 
            onClick={(e) => {
              if (isLocked && !window.confirm("¿Seguro de salir del modo escenario con los controles bloqueados?")) {
                e.preventDefault();
              }
            }}
            className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" /> VOLVER
          </Link>
          {songs.length > 0 && (
            <button
              onClick={() => setIsListOpen(true)}
              disabled={isLocked}
              className="lg:hidden px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-1.5 disabled:opacity-30"
            >
              TEMAS ({songs.length})
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-widest text-neutral-400 truncate max-w-[150px] sm:max-w-xs">
              {setlistName ? `Setlist: ${setlistName}` : "Escenario PWA"}
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>

        {/* Diagnostic info & clock */}
        <div className="flex items-center gap-6 text-neutral-400">
          {showBatterySetting && batteryLevel !== null && (
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold">
              <Battery className="w-4 h-4 text-emerald-500" /> {batteryLevel}%
            </div>
          )}
          {showClockSetting && (
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold">
              <Clock className="w-4 h-4 text-neutral-500" /> {currentTimeClock || "00:00:00"}
            </div>
          )}
        </div>
      </header>

      {/* Main Player Display */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 flex flex-col justify-between gap-8">
        {/* Song Select List & Detail Row */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 flex-1 items-stretch">
          
          {/* Song selection list (sidebar, disabled on lock) */}
          <div className={`
            border border-neutral-900 rounded-[2.5rem] p-6 bg-neutral-950 lg:bg-neutral-900/10 
            flex flex-col justify-between gap-4 overflow-y-auto transition-all duration-300
            ${isListOpen 
              ? "fixed inset-0 z-50 m-4 sm:m-6 shadow-2xl border-neutral-800" 
              : "hidden lg:flex lg:col-span-1 lg:max-h-none"
            }
          `}>
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Temas del Setlist</span>
              {isListOpen && (
                <button 
                  onClick={() => setIsListOpen(false)}
                  className="px-2 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-850 text-neutral-400 hover:text-white transition-colors text-[9px] font-black uppercase tracking-wider border border-neutral-800"
                >
                  CERRAR
                </button>
              )}
            </div>
            
            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              {songs.map((s, idx) => (
                <button
                  key={s.id}
                  disabled={isLocked}
                  onClick={() => {
                    selectSong(idx);
                    setIsListOpen(false);
                  }}
                  className={`w-full text-left p-3.5 rounded-2xl border text-xs font-bold uppercase transition-all duration-300 flex items-center justify-between gap-3 ${
                    currentSong?.id === s.id
                      ? "bg-red-650/10 border-red-500 text-white shadow-lg shadow-red-600/5"
                      : isLocked 
                        ? "bg-transparent border-transparent text-neutral-600 cursor-not-allowed"
                        : "bg-transparent border-transparent hover:bg-neutral-900 hover:border-neutral-800 text-neutral-400 hover:text-white"
                  }`}
                >
                  <span className="truncate">{idx + 1}. {s.title}</span>
                  {s.key && <span className="font-mono text-[10px] text-amber-500 shrink-0">{s.key}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Large Screen Monitor */}
          <div className="lg:col-span-3 border border-neutral-900 rounded-[2.5rem] p-8 bg-neutral-900/20 flex flex-col justify-between relative overflow-hidden">
            {/* Lock Indicator */}
            {isLocked && (
              <div className="absolute top-6 right-6 px-3 py-1 bg-red-950/40 border border-red-900 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1.5 animate-pulse">
                <Lock className="w-3.5 h-3.5" /> BLOQUEADO
              </div>
            )}

            {/* Song Meta (Title, artist, BPM) */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500 font-black tracking-widest uppercase">
                <span>TEMA {currentIndex + 1} DE {songs.length}</span>
                <span>•</span>
                <span className="text-red-500">{currentSong?.bpm || "?"} BPM</span>
                <span>•</span>
                <span className="text-amber-500">{currentSong?.key || "TONO ?"}</span>
              </div>
              <h2 className="text-2xl sm:text-4xl lg:text-6xl font-black uppercase tracking-tight text-white leading-none">
                {currentSong?.title || "SIN CANCIÓN"}
              </h2>
              {currentSong?.artist && (
                <p className="text-lg text-neutral-400 font-medium uppercase tracking-wider">
                  {currentSong.artist}
                </p>
              )}
            </div>

            {/* Note Panel (Show instructions if registered) */}
            {currentSong?.notes && (
              <div className="my-6 border border-neutral-900 rounded-3xl p-5 bg-neutral-900/20 max-w-2xl">
                <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest block mb-1">Notas de Logística:</span>
                <p className="text-sm text-neutral-300 leading-relaxed font-semibold italic">
                  "{currentSong.notes}"
                </p>
              </div>
            )}

            {/* Next Track Reminder */}
            <div className="border-t border-neutral-900/60 pt-6 flex items-center justify-between text-xs font-black uppercase tracking-wider">
              <span className="text-neutral-500">SIGUIENTE TEMA:</span>
              <span className="text-red-400 max-w-xs truncate">{nextSongName}</span>
            </div>
          </div>
        </div>

        {/* ProgressBar and Timers */}
        <div className="space-y-4">
          <div className="flex items-end justify-between font-mono font-black text-white leading-none">
            {/* Elapsed Time */}
            <div className="text-3xl sm:text-4xl tracking-tighter">
              {formatTime(currentTime)}
            </div>
            
            {/* Status Indicator */}
            <div className="text-xs uppercase tracking-[0.25em] text-neutral-500 flex items-center gap-1.5">
              {playbackStatus === "loading" && <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />}
              {playbackStatus === "playing" && <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping mr-1" />}
              {playbackStatus === "playing" ? "REPRODUCIENDO" : playbackStatus.toUpperCase()}
            </div>
            
            {/* Remaining Time */}
            <div className="text-3xl sm:text-4xl text-neutral-400 tracking-tighter">
              -{formatTime(Math.max(0, duration - currentTime))}
            </div>
          </div>

          {/* Range Progress Bar */}
          <div className="relative group">
            <input
              type="range"
              min="0"
              max={duration}
              step="0.1"
              disabled={isLocked || playbackStatus === "loading" || playbackStatus === "idle"}
              value={currentTime}
              onChange={handleProgressBarChange}
              className="w-full h-3 bg-neutral-900 rounded-lg appearance-none cursor-pointer accent-red-600 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Big Layout Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 border-t border-neutral-900 pt-6">
          
          {/* Lock Button */}
          <button
            onClick={() => setIsLocked(!isLocked)}
            className={`w-full sm:w-auto px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border transition-all duration-300 flex items-center justify-center gap-2 ${
              isLocked 
                ? "bg-red-600 border-red-500 text-white shadow-xl shadow-red-600/10" 
                : "bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-400 hover:text-white"
            }`}
          >
            {isLocked ? (
              <>
                <Lock className="w-4 h-4" /> DESBLOQUEAR CONTROLES
              </>
            ) : (
              <>
                <Unlock className="w-4 h-4" /> BLOQUEAR CONTROLES
              </>
            )}
          </button>

          {/* Main Playback Operations */}
          <div className="flex items-center gap-5">
            {/* Back / Restart */}
            <button
              onClick={handleRestartSong}
              disabled={isLocked}
              className="p-4 rounded-2xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title="Reiniciar tema"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            {/* Prev Song */}
            <button
              onClick={() => selectSong(currentIndex - 1)}
              disabled={isLocked || currentIndex === 0}
              className="p-4 rounded-2xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title="Tema anterior"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            {/* BIG PLAY PLAYBACK BUTTON */}
            <button
              onClick={handlePlayPause}
              disabled={playbackStatus === "loading" || playbackStatus === "idle"}
              className={`w-18 h-18 sm:w-24 sm:h-24 rounded-3xl flex items-center justify-center border transition-all duration-300 shadow-2xl ${
                playbackStatus === "playing"
                  ? "bg-neutral-900 border-neutral-800 text-white"
                  : "bg-red-600 border-red-500 text-white shadow-red-600/20 hover:scale-105"
              } disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              {playbackStatus === "playing" ? (
                <Pause className="w-8 h-8 fill-white" />
              ) : (
                <Play className="w-8 h-8 fill-white ml-1" />
              )}
            </button>

            {/* Next Song */}
            <button
              onClick={() => selectSong(currentIndex + 1)}
              disabled={isLocked || currentIndex === songs.length - 1}
              className="p-4 rounded-2xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title="Siguiente tema"
            >
              <SkipForward className="w-5 h-5" />
            </button>

            {/* Stop Button (Instant) */}
            <button
              onClick={handleStop}
              disabled={playbackStatus === "stopped" || playbackStatus === "ready" || playbackStatus === "idle"}
              className="p-4 rounded-2xl bg-neutral-900 hover:bg-red-950/20 border border-neutral-800 hover:border-red-900/30 text-neutral-300 hover:text-red-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title="Detener audio"
            >
              <Square className="w-5 h-5" />
            </button>
          </div>

          {/* Emergency STOP button (Always active, separated) */}
          <button
            onClick={handleStop}
            className="w-full sm:w-auto px-5 py-4 rounded-2xl border border-red-900/60 bg-red-950/30 hover:bg-red-900/40 text-red-500 hover:text-white font-black text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 shadow-lg shadow-red-950/10"
          >
            <VolumeX className="w-4 h-4 animate-pulse" /> DETENER AUDIO
          </button>

        </div>
      </main>
    </div>
  );
}
