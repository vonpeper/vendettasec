"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { getSetting, saveSetting } from "@/lib/storage/indexedDb";
import { exportBackup, importBackup } from "@/lib/backup/backup";
import { 
  ArrowLeft, ToggleLeft, ToggleRight, Download, Upload, 
  RefreshCw, CheckCircle, AlertTriangle, HelpCircle, Loader2, ShieldAlert
} from "lucide-react";

export default function SettingsPage() {
  // Stage Settings states
  const [autoplay, setAutoplay] = useState(false);
  const [showClock, setShowClock] = useState(true);
  const [showBattery, setShowBattery] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Backup progress states
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const autoplayVal = await getSetting<boolean>("autoplay_enabled");
      const showClockVal = await getSetting<boolean>("show_clock_on_stage");
      const showBatteryVal = await getSetting<boolean>("show_battery_on_stage");

      // Default checks
      setAutoplay(autoplayVal || false);
      setShowClock(showClockVal !== null ? showClockVal : true);
      setShowBattery(showBatteryVal !== null ? showBatteryVal : true);
    } catch (err) {
      console.error("Error loading settings:", err);
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleToggleAutoplay = async () => {
    const newVal = !autoplay;
    setAutoplay(newVal);
    await saveSetting("autoplay_enabled", newVal);
  };

  const handleToggleClock = async () => {
    const newVal = !showClock;
    setShowClock(newVal);
    await saveSetting("show_clock_on_stage", newVal);
  };

  const handleToggleBattery = async () => {
    const newVal = !showBattery;
    setShowBattery(newVal);
    await saveSetting("show_battery_on_stage", newVal);
  };

  const handleExport = async () => {
    setExporting(true);
    setExportProgress(0);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      await exportBackup((progress) => setExportProgress(progress));
      setSuccessMsg("Copia de seguridad exportada y descargada con éxito.");
    } catch (err: any) {
      console.error("Error exporting backup:", err);
      setErrorMsg(err.message || "Error al exportar la copia de seguridad.");
    } finally {
      setExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("ATENCIÓN: Importar un respaldo borrará TODAS las canciones, setlists y configuraciones actuales de este dispositivo para restaurar el archivo de respaldo. ¿Deseas continuar?")) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setImporting(true);
    setImportProgress(0);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      await importBackup(file, (progress) => setImportProgress(progress));
      setSuccessMsg("¡Respaldo importado con éxito! Se han restaurado todas las canciones, setlists y audios.");
      // Reload states
      await loadSettings();
    } catch (err: any) {
      console.error("Error importing backup:", err);
      setErrorMsg(err.message || "Error al importar el respaldo. Asegúrate de subir un archivo .zip válido generado por Vendetta.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-neutral-300" />
          </Link>
          <h1 className="text-xl font-black uppercase tracking-widest text-white">
            Ajustes del Reproductor
          </h1>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8 flex flex-col gap-8">
        
        {/* Status Messages */}
        {successMsg && (
          <div className="bg-emerald-950/20 border-2 border-emerald-500/30 rounded-3xl p-5 flex gap-4 items-center text-emerald-450">
            <CheckCircle className="w-6 h-6 shrink-0 text-emerald-500" />
            <span className="text-xs font-bold uppercase tracking-wider">{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="bg-red-950/20 border-2 border-red-500/30 rounded-3xl p-5 flex gap-4 items-center text-red-400">
            <ShieldAlert className="w-6 h-6 shrink-0 text-red-500" />
            <span className="text-xs font-bold uppercase tracking-wider">{errorMsg}</span>
          </div>
        )}

        {loadingSettings ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-neutral-500 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-red-500" />
            <span className="text-[10px] font-black uppercase tracking-widest">Cargando configuraciones...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8">
            
            {/* Stage Options */}
            <section className="border border-neutral-900 rounded-[2.5rem] p-8 bg-neutral-900/10 space-y-6">
              <h3 className="text-lg font-black uppercase tracking-wider text-white border-b border-neutral-900 pb-3">
                Comportamiento en Escenario
              </h3>

              {/* Autoplay */}
              <div className="flex items-center justify-between gap-6 py-2">
                <div className="space-y-1 max-w-lg">
                  <h4 className="font-bold text-sm uppercase tracking-wide text-white">Reproducción Continua (Autoplay)</h4>
                  <p className="text-xs text-neutral-500 leading-normal">
                    Al terminar de reproducirse un tema, avanza automáticamente al siguiente y comienza a sonar de inmediato sin esperar un toque manual de "Play".
                  </p>
                </div>
                <button 
                  onClick={handleToggleAutoplay} 
                  className="text-neutral-400 hover:text-white transition-colors"
                >
                  {autoplay ? (
                    <ToggleRight className="w-14 h-10 text-red-500" />
                  ) : (
                    <ToggleLeft className="w-14 h-10 text-neutral-700" />
                  )}
                </button>
              </div>

              {/* Show Clock */}
              <div className="flex items-center justify-between gap-6 py-2 border-t border-neutral-900/60 pt-6">
                <div className="space-y-1">
                  <h4 className="font-bold text-sm uppercase tracking-wide text-white">Mostrar Reloj Digital</h4>
                  <p className="text-xs text-neutral-500 leading-normal">
                    Ver la hora actual en formato de 24 horas en la esquina superior del Modo Escenario para control del itinerario del show.
                  </p>
                </div>
                <button 
                  onClick={handleToggleClock} 
                  className="text-neutral-400 hover:text-white transition-colors"
                >
                  {showClock ? (
                    <ToggleRight className="w-14 h-10 text-red-500" />
                  ) : (
                    <ToggleLeft className="w-14 h-10 text-neutral-700" />
                  )}
                </button>
              </div>

              {/* Show Battery */}
              <div className="flex items-center justify-between gap-6 py-2 border-t border-neutral-900/60 pt-6">
                <div className="space-y-1">
                  <h4 className="font-bold text-sm uppercase tracking-wide text-white">Mostrar Porcentaje de Batería</h4>
                  <p className="text-xs text-neutral-500 leading-normal">
                    Monitorear el estado energético de la tableta directamente en la pantalla de escenario.
                  </p>
                </div>
                <button 
                  onClick={handleToggleBattery} 
                  className="text-neutral-400 hover:text-white transition-colors"
                >
                  {showBattery ? (
                    <ToggleRight className="w-14 h-10 text-red-500" />
                  ) : (
                    <ToggleLeft className="w-14 h-10 text-neutral-700" />
                  )}
                </button>
              </div>
            </section>

            {/* Backups Export/Import */}
            <section className="border border-neutral-900 rounded-[2.5rem] p-8 bg-neutral-900/10 space-y-6">
              <div className="space-y-1 border-b border-neutral-900 pb-3">
                <h3 className="text-lg font-black uppercase tracking-wider text-white">
                  Copias de Seguridad (Backup)
                </h3>
                <p className="text-xs text-neutral-500">
                  Ideal para traspasar todo tu repertorio, pistas y setlists de un iPad/teléfono a una tableta Galaxy nueva.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                
                {/* Export Card */}
                <div className="border border-neutral-900 rounded-[2rem] p-6 bg-neutral-950 flex flex-col justify-between gap-6">
                  <div className="space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-850 flex items-center justify-center text-red-500">
                      <Download className="w-5 h-5" />
                    </div>
                    <h4 className="font-black text-sm uppercase tracking-wide text-white">Exportar Biblioteca (.zip)</h4>
                    <p className="text-xs text-neutral-500 leading-normal">
                      Crea un archivo ZIP único con todas tus canciones, metadatos, BPM, tonalidades, notas y archivos binarios físicos de audio.
                    </p>
                  </div>

                  <button
                    onClick={handleExport}
                    disabled={exporting || importing}
                    className="w-full py-3.5 bg-red-650/10 hover:bg-red-600 border border-red-900/30 hover:border-red-500 text-red-400 hover:text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {exporting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        EMPAQUETANDO {exportProgress}%
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" /> GENERAR ZIP
                      </>
                    )}
                  </button>
                </div>

                {/* Import Card */}
                <div className="border border-neutral-900 rounded-[2rem] p-6 bg-neutral-950 flex flex-col justify-between gap-6">
                  <div className="space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-850 flex items-center justify-center text-red-500">
                      <Upload className="w-5 h-5" />
                    </div>
                    <h4 className="font-black text-sm uppercase tracking-wide text-white">Restaurar Respaldo</h4>
                    <p className="text-xs text-neutral-500 leading-normal">
                      Sube un archivo de respaldo `.zip` generado previamente por esta aplicación para clonar toda la configuración.
                    </p>
                  </div>

                  <button
                    onClick={handleImportClick}
                    disabled={exporting || importing}
                    className="w-full py-3.5 bg-neutral-900 hover:bg-neutral-850 border border-neutral-850 hover:border-neutral-800 text-neutral-300 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                        IMPORTANDO {importProgress}%
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" /> SUBIR RESPALDO
                      </>
                    )}
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImportFile}
                    accept=".zip"
                    className="hidden"
                  />
                </div>

              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
