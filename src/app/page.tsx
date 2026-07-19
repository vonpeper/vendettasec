"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { registerServiceWorker } from "@/lib/pwa/registerSw";
import { getStorageEstimate, requestStoragePersistence } from "@/lib/storage/opfs";
import { getAllSongs, getSetting, getSetlist } from "@/lib/storage/indexedDb";
import { 
  Play, Library, ShieldCheck, Activity, HardDrive, 
  Wifi, WifiOff, Settings, AlertTriangle, ArrowRight, Music,
  Share, Smartphone, Laptop, Check, Copy, X
} from "lucide-react";

export default function HomePage() {
  const [isOnline, setIsOnline] = useState(true);
  const [songsCount, setSongsCount] = useState(0);
  const [storageUsed, setStorageUsed] = useState("0 MB");
  const [storageTotal, setStorageTotal] = useState("0 MB");
  const [storagePersisted, setStoragePersisted] = useState(false);
  const [lastTestDate, setLastTestDate] = useState<string | null>(null);
  const [lastSetlistName, setLastSetlistName] = useState<string | null>(null);
  const [lastSetlistId, setLastSetlistId] = useState<string | null>(null);

  const [isInstalled, setIsInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [deviceOS, setDeviceOS] = useState<"ios" | "android" | "other">("other");
  const [installTab, setInstallTab] = useState<"ios" | "android" | "other">("ios");
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    // 1. Register service worker for offline support
    registerServiceWorker();

    // 2. Track connection state
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Check if running in standalone mode
    if (typeof window !== "undefined") {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
      setIsInstalled(!!isStandalone);

      // Detect OS
      const ua = navigator.userAgent.toLowerCase();
      if (/ipad|iphone|ipod/.test(ua) && !(window as any).MSStream) {
        setDeviceOS("ios");
        setInstallTab("ios");
      } else if (/android/.test(ua)) {
        setDeviceOS("android");
        setInstallTab("android");
      } else {
        setDeviceOS("other");
        setInstallTab("other");
      }
    }

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // 3. Load stats
    loadDashboardStats();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const loadDashboardStats = async () => {
    try {
      // Get songs count
      const all = await getAllSongs();
      const validSongs = all.filter(s => s.validationStatus === "valid");
      setSongsCount(validSongs.length);

      // Get last diagnostics test date
      const testVal = await getSetting<string>("last_diagnostics_test");
      if (testVal) setLastTestDate(testVal);

      // Get last selected setlist
      const activeSetlistId = await getSetting<string>("last_selected_setlist_id");
      if (activeSetlistId) {
        const setlistObj = await getSetlist(activeSetlistId);
        if (setlistObj) {
          setLastSetlistName(setlistObj.name);
          setLastSetlistId(setlistObj.id);
        }
      }

      // Get storage estimate
      const estimate = await getStorageEstimate();
      setStorageUsed(`${(estimate.used / (1024 * 1024)).toFixed(1)} MB`);
      setStorageTotal(`${(estimate.total / (1024 * 1024)).toFixed(0)} MB`);
      setStoragePersisted(estimate.persist);
    } catch (err) {
      console.error("Error loading dashboard stats:", err);
    }
  };

  const handleRequestPersistence = async () => {
    try {
      const success = await requestStoragePersistence();
      setStoragePersisted(success);
      await loadDashboardStats();
    } catch (err) {
      console.error("Error requesting persistence:", err);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col justify-between">
      {/* Top Header */}
      <header className="max-w-6xl mx-auto w-full px-6 py-6 flex items-center justify-between border-b border-neutral-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600 rounded-2xl flex items-center justify-center font-black text-lg text-white shadow-lg shadow-red-650/20">
            V
          </div>
          <div className="space-y-0.5">
            <h1 className="text-sm font-black uppercase tracking-[0.2em] text-white">
              Vendetta
            </h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
              Sequence Player
            </p>
          </div>
        </div>

        {/* Online / Offline status & settings */}
        <div className="flex items-center gap-3">
          {isOnline ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-850 text-[10px] font-black text-neutral-400 uppercase tracking-widest">
              <Wifi className="w-3.5 h-3.5 text-neutral-500" /> ONLINE
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/20 border border-red-900/50 text-[10px] font-black text-red-400 uppercase tracking-widest animate-pulse">
              <WifiOff className="w-3.5 h-3.5 text-red-500" /> OFFLINE-MODE
            </span>
          )}

          {!isInstalled && (
            <button
              onClick={() => setIsInstallModalOpen(true)}
              className="px-3.5 py-2 bg-red-600/10 hover:bg-red-600 border border-red-900/40 hover:border-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-white transition-all flex items-center gap-1.5 shadow-lg shadow-red-650/5"
            >
              <Smartphone className="w-3.5 h-3.5" /> INSTALAR APP
            </button>
          )}

          <Link
            href="/settings"
            className="p-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-850 hover:border-neutral-800 rounded-xl transition-colors text-neutral-400 hover:text-white"
            title="Ajustes de la Aplicación"
          >
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Main Panel Options */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-12 flex flex-col justify-center gap-12">
        {/* Pitch Hero Title */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-black uppercase tracking-tight text-white leading-none">
            REPRODUCTOR DE SECUENCIAS <br />
            <span className="text-red-500 italic pr-3">PARA ESCENARIO</span>
          </h2>
          <p className="text-sm text-neutral-400 font-medium max-w-md mx-auto leading-relaxed">
            Lanza pistas de audio estéreo estables en vivo sin conexión a internet.
          </p>
        </div>

        {/* Grid navigation buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto w-full">
          
          {/* STAGE MODE CARD (BIG PLAY) */}
          <Link
            href="/stage"
            className="group p-8 rounded-[2.5rem] border-2 border-red-650 bg-red-950/10 hover:bg-red-600 transition-all duration-500 flex flex-col justify-between gap-12 shadow-2xl shadow-red-600/5 relative overflow-hidden"
          >
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-red-650/10 rounded-full blur-2xl group-hover:bg-red-500/25 transition-colors" />
            
            <div className="w-14 h-14 rounded-2xl bg-red-600 group-hover:bg-neutral-950/20 flex items-center justify-center transition-colors">
              <Play className="w-6 h-6 fill-white text-white" />
            </div>

            <div className="space-y-2">
              <span className="text-[9px] font-black text-red-500 group-hover:text-red-200 uppercase tracking-widest block">
                {lastSetlistName ? `Setlist activo: ${lastSetlistName}` : "Todo el Repertorio"}
              </span>
              <h3 className="font-black text-xl uppercase tracking-wider text-white">MODO ESCENARIO</h3>
              <p className="text-xs text-red-300 group-hover:text-red-100 leading-relaxed font-semibold transition-colors">
                Ingresar al reproductor táctil de escenario con controles de gran escala y bloqueo de seguridad.
              </p>
            </div>
            
            <span className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-1">
              ABRIR REPRODUCTOR <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </span>
          </Link>

          {/* SETLISTS CARD */}
          <Link
            href="/setlists"
            className="group p-8 rounded-[2.5rem] border border-neutral-900 bg-neutral-900/10 hover:bg-neutral-900 hover:border-neutral-800 transition-all duration-300 flex flex-col justify-between gap-12 relative overflow-hidden"
          >
            <div className="w-14 h-14 rounded-2xl bg-neutral-900 group-hover:bg-neutral-850 flex items-center justify-center border border-neutral-800 transition-all">
              <Music className="w-6 h-6 text-red-500" />
            </div>

            <div className="space-y-2">
              <h3 className="font-black text-xl uppercase tracking-wider text-white">SETLISTS</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Crear playlists específicas para shows, duplicarlas y organizar el orden de las canciones ↑ ↓.
              </p>
            </div>
            
            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1">
              GESTIONAR SHOWS <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </span>
          </Link>

          {/* LIBRARY CARD */}
          <Link
            href="/library"
            className="group p-8 rounded-[2.5rem] border border-neutral-900 bg-neutral-900/10 hover:bg-neutral-900 hover:border-neutral-800 transition-all duration-300 flex flex-col justify-between gap-12 relative overflow-hidden"
          >
            <div className="w-14 h-14 rounded-2xl bg-neutral-900 group-hover:bg-neutral-850 flex items-center justify-center border border-neutral-800 transition-all">
              <Library className="w-6 h-6 text-red-500" />
            </div>

            <div className="space-y-2">
              <h3 className="font-black text-xl uppercase tracking-wider text-white">BIBLIOTECA</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Importar audios locales, pre-escuchar pistas y auditar canales estéreos (L/R).
              </p>
            </div>
            
            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1">
              VER REPERTORIO ({songsCount} TEMAS) <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </span>
          </Link>

          {/* DIAGNOSTICS CARD */}
          <Link
            href="/diagnostics"
            className="group p-8 rounded-[2.5rem] border border-neutral-900 bg-neutral-900/10 hover:bg-neutral-900 hover:border-neutral-800 transition-all duration-300 flex flex-col justify-between gap-12 relative overflow-hidden"
          >
            <div className="w-14 h-14 rounded-2xl bg-neutral-900 group-hover:bg-neutral-850 flex items-center justify-center border border-neutral-800 transition-all">
              <Activity className="w-6 h-6 text-red-500" />
            </div>

            <div className="space-y-2">
              <h3 className="font-black text-xl uppercase tracking-wider text-white">DIAGNÓSTICO L/R</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Validar salida física: izquierdo para monitores/click y derecho para audio de sala (PA).
              </p>
            </div>
            
            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1">
              {lastTestDate ? "ÚLTIMO TEST: DIAGNÓSTICO OK" : "HACER PRUEBA DE AUDIO"} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </span>
          </Link>
        </div>

        {/* Dashboard Status Footer / Storage Info */}
        <section className="max-w-4xl mx-auto w-full grid grid-cols-1 sm:grid-cols-2 gap-6 bg-neutral-900/10 border border-neutral-900 rounded-[2.5rem] p-6 text-xs text-neutral-400">
          {/* Storage Estimate */}
          <div className="flex items-center gap-4">
            <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 text-neutral-500">
              <HardDrive className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block">Espacio Almacenamiento</span>
              <span className="text-sm font-bold text-white font-mono">{storageUsed} usados</span>
              <span className="text-neutral-500 font-mono"> / {storageTotal} totales</span>
            </div>
          </div>

          {/* Persist Storage Alert */}
          <div className="flex items-center justify-between gap-4 border-t border-neutral-900 pt-4 sm:pt-0 sm:border-t-0 sm:border-l sm:border-neutral-900 sm:pl-6">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block">Protección de Datos</span>
              <span className="text-sm font-bold text-white uppercase tracking-wide">
                {storagePersisted ? "Persistencia Concedida" : "Modo Temporal"}
              </span>
              <p className="text-[11px] text-neutral-500 leading-normal">
                {storagePersisted 
                  ? "Android no borrará tus pistas de audio aunque falte espacio." 
                  : "Android podría purgar las pistas de audio si el disco se llena."}
              </p>
            </div>
            {!storagePersisted && (
              <button
                onClick={handleRequestPersistence}
                className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-[10px] font-black text-white uppercase tracking-widest transition-colors shrink-0"
              >
                PROTEGER
              </button>
            )}
          </div>
        </section>
      </main>

      {/* Bottom Legal/App indicator */}
      <footer className="max-w-6xl mx-auto w-full px-6 py-6 text-center text-[10px] font-black text-neutral-600 uppercase tracking-widest border-t border-neutral-900">
        © 2026 VENDETTA LIVE MUSIC • OFFLINE SEQUENCE PWA
      </footer>

      {/* Install App Modal */}
      {isInstallModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-neutral-950 border border-neutral-900 rounded-[2.5rem] w-full max-w-xl p-8 space-y-6 shadow-2xl relative">
            <button 
              onClick={() => setIsInstallModalOpen(false)}
              className="absolute top-8 right-8 p-1.5 rounded-lg hover:bg-neutral-900 text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">INSTALACIÓN DISPOSITIVO</span>
              <h3 className="text-xl font-black uppercase text-white tracking-wide">Instalar Vendetta Sec</h3>
            </div>

            {/* Pill selector tabs */}
            <div className="flex bg-neutral-900 p-1.5 rounded-2xl border border-neutral-850">
              <button 
                onClick={() => setInstallTab("ios")} 
                className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5 ${installTab === "ios" ? "bg-red-600 text-white shadow-md shadow-red-650/10" : "text-neutral-500 hover:text-neutral-350"}`}
              >
                <Smartphone className="w-4.5 h-4.5" /> iOS (iPhone)
              </button>
              <button 
                onClick={() => setInstallTab("android")} 
                className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5 ${installTab === "android" ? "bg-red-600 text-white shadow-md shadow-red-650/10" : "text-neutral-500 hover:text-neutral-350"}`}
              >
                <Smartphone className="w-4.5 h-4.5" /> Android
              </button>
              <button 
                onClick={() => setInstallTab("other")} 
                className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5 ${installTab === "other" ? "bg-red-600 text-white shadow-md shadow-red-650/10" : "text-neutral-500 hover:text-neutral-350"}`}
              >
                <Laptop className="w-4.5 h-4.5" /> Computadora
              </button>
            </div>

            {/* Tab content */}
            <div className="pt-2">
              {installTab === "android" && (
                <div className="space-y-6 text-center sm:text-left">
                  <p className="text-xs text-neutral-450 leading-relaxed font-semibold">
                    En Android puedes instalar la aplicación directamente en tu dispositivo con un solo clic.
                  </p>
                  
                  {deferredPrompt ? (
                    <div className="flex justify-center py-2">
                      <button
                        onClick={async () => {
                          deferredPrompt.prompt();
                          const choice = await deferredPrompt.userChoice;
                          if (choice.outcome === "accepted") {
                            setIsInstallModalOpen(false);
                          }
                          setDeferredPrompt(null);
                        }}
                        className="px-8 py-4 bg-red-600 hover:bg-red-500 border border-red-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 shadow-xl shadow-red-600/10 flex items-center gap-2"
                      >
                        Instalar Ahora en Android
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4 text-left border border-neutral-900 rounded-3xl p-5 bg-neutral-900/15">
                      <h4 className="text-xs font-black uppercase tracking-wider text-white">Instalación Manual:</h4>
                      <ol className="list-decimal list-inside text-xs text-neutral-400 space-y-2.5 leading-relaxed font-semibold">
                        <li>Abre <span className="text-white">secuencias.vendetta.mx</span> en <span className="text-red-400">Google Chrome</span>.</li>
                        <li>Toca los tres puntos de menú (<span className="text-white">⋮</span>) arriba a la derecha.</li>
                        <li>Selecciona <span className="text-white">"Instalar aplicación"</span> o <span className="text-white">"Agregar a la pantalla principal"</span>.</li>
                      </ol>
                    </div>
                  )}
                </div>
              )}

              {installTab === "ios" && (
                <div className="space-y-6">
                  {/* Detect Webview / In-App Browser */}
                  {typeof navigator !== "undefined" && /fb_iab|instagram|whatsapp/i.test(navigator.userAgent) ? (
                    <div className="space-y-4 border border-red-900/40 rounded-3xl p-5 bg-red-950/15 text-center">
                      <span className="text-[10px] font-black text-red-500 uppercase tracking-widest block">Navegador no soportado</span>
                      <p className="text-xs text-red-450 leading-relaxed font-semibold">
                        Estás abriendo la web desde una aplicación (Facebook, WhatsApp, etc.). Para poder instalar, debes abrirla en Safari o Chrome real.
                      </p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText("https://secuencias.vendetta.mx");
                          setLinkCopied(true);
                          setTimeout(() => setLinkCopied(false), 2000);
                        }}
                        className="mx-auto px-5 py-2.5 bg-red-650/10 hover:bg-red-600 border border-red-900/30 hover:border-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-white transition-all flex items-center gap-1.5"
                      >
                        {linkCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {linkCopied ? "COPIADO" : "COPIAR ENLACE"}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4 border border-neutral-900 rounded-3xl p-6 bg-neutral-900/15">
                      <h4 className="text-xs font-black uppercase tracking-wider text-white">Instrucciones para iOS:</h4>
                      <ol className="list-decimal list-inside text-xs text-neutral-400 space-y-4 leading-relaxed font-semibold">
                        <li>
                          Abre la web en <span className="text-white">Safari</span> (o Chrome/Firefox para iOS).
                        </li>
                        <li>
                          Toca el botón <span className="text-red-400 uppercase font-black inline-flex items-center gap-1 text-[10px] bg-red-950/40 px-2 py-1 rounded-md border border-red-900/30"><Share className="w-3 h-3" /> Compartir</span> 
                          <span className="text-neutral-500 block text-[11px] mt-1 pl-5">
                            (En Safari está abajo en la pantalla; en Chrome está arriba a la derecha de la URL).
                          </span>
                        </li>
                        <li>
                          Desplázate hacia abajo y selecciona <span className="text-white font-bold block pl-5 mt-1">"Agregar a inicio" / "Add to Home Screen"</span>.
                        </li>
                      </ol>
                    </div>
                  )}
                </div>
              )}

              {installTab === "other" && (
                <div className="space-y-6">
                  <p className="text-xs text-neutral-450 leading-relaxed font-semibold text-center sm:text-left">
                    Puedes instalar la aplicación en tu computadora (PC o Mac) usando Chrome, Edge o navegadores compatibles.
                  </p>

                  <div className="space-y-4 border border-neutral-900 rounded-3xl p-6 bg-neutral-900/15">
                    <h4 className="text-xs font-black uppercase tracking-wider text-white">Instrucciones de Computadora:</h4>
                    <ol className="list-decimal list-inside text-xs text-neutral-400 space-y-3 leading-relaxed font-semibold">
                      <li>Usa <span className="text-white">Google Chrome</span> o <span className="text-white">Microsoft Edge</span>.</li>
                      <li>
                        En la barra de direcciones de arriba, haz clic en el icono de **Instalación** 
                        <span className="text-neutral-500 font-mono text-[11px] block pl-5 mt-1">
                          (se ve como un monitor con una flecha hacia abajo, a la derecha de la estrella de favoritos).
                        </span>
                      </li>
                      <li>Haz clic en <span className="text-white font-bold">"Instalar"</span> para confirmar.</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
