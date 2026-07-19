"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AudioEngine } from "@/lib/audio-engine/AudioEngine";
import { saveSetting, getSetting } from "@/lib/storage/indexedDb";
import { Volume2, ArrowLeft, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

export default function DiagnosticsPage() {
  const [activeTest, setActiveTest] = useState<"L" | "R" | "both" | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [confirmL, setConfirmL] = useState(false);
  const [confirmR, setConfirmR] = useState(false);
  const [lastTestDate, setLastTestDate] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    // Load last test date
    getSetting<string>("last_diagnostics_test")
      .then((val) => {
        if (val) setLastTestDate(val);
      })
      .catch(console.error);

    // Stop engine on unmount
    return () => {
      AudioEngine.getInstance().stop();
    };
  }, []);

  const handleTest = async (channel: "L" | "R" | "both") => {
    const engine = AudioEngine.getInstance();
    
    // If already playing the same channel, stop it
    if (isPlaying && activeTest === channel) {
      engine.stop();
      setIsPlaying(false);
      setActiveTest(null);
      return;
    }

    try {
      engine.stop();
      const testBuffer = await engine.generateLRTestBuffer(channel);
      engine.loadBuffer(testBuffer);
      
      // Set listener for natural ended state
      engine.setListeners({
        onStatusChange: (status) => {
          if (status === "ended" || status === "stopped") {
            setIsPlaying(false);
            setActiveTest(null);
          }
        }
      });

      await engine.play();
      setIsPlaying(true);
      setActiveTest(channel);
    } catch (err) {
      console.error("Error playing diagnostic tone:", err);
    }
  };

  const handleSaveConfirmation = async () => {
    if (!confirmL || !confirmR) return;
    const now = new Date().toISOString();
    try {
      await saveSetting("last_diagnostics_test", now);
      setLastTestDate(now);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving confirmation:", err);
    }
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
              Diagnóstico de Audio
            </h1>
          </div>
          <div className="text-[10px] font-black text-red-500 uppercase tracking-widest px-3 py-1 bg-red-950/30 border border-red-900/50 rounded-full">
            ✦ L/R TEST STATUS
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8 flex flex-col gap-8 justify-center">
        {/* L/R Separation Warning */}
        <section className="bg-red-950/20 border-2 border-red-500/30 rounded-3xl p-6 flex flex-col md:flex-row gap-5 items-start">
          <div className="p-3 bg-red-500/20 rounded-2xl shrink-0 text-red-400">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="font-black text-lg uppercase tracking-wider text-red-400">Regla Estéreo Obligatoria</h3>
            <p className="text-sm text-neutral-300 leading-relaxed">
              Vendetta requiere separación absoluta de canales para evitar desincronización en vivo:
            </p>
            <ul className="text-xs text-neutral-400 space-y-1.5 list-disc pl-5">
              <li><strong className="text-white">Canal IZQUIERDO (L):</strong> Click + Guías + Conteo (únicamente para audífonos in-ears).</li>
              <li><strong className="text-white">Canal DERECHO (R):</strong> Secuencia musical (enviada al público/PA e in-ears).</li>
            </ul>
          </div>
        </section>

        {/* Test Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Test */}
          <div className={`border-2 rounded-[2rem] p-8 flex flex-col justify-between transition-all duration-300 bg-neutral-900/40 ${
            activeTest === "L" ? "border-red-600 bg-red-950/10" : "border-neutral-900"
          }`}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">CANAL IZQUIERDO (L)</span>
                {activeTest === "L" && <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />}
              </div>
              <h4 className="text-2xl font-black uppercase text-white tracking-wide">CLICK + GUÍAS</h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Debe escucharse exclusivamente en los auriculares de monitoreo (in-ears). El público general NO debe percibir este canal.
              </p>
            </div>
            
            <button
              onClick={() => handleTest("L")}
              className={`mt-8 w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 border ${
                activeTest === "L"
                  ? "bg-red-600 border-red-500 text-white shadow-xl shadow-red-600/20"
                  : "bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-300"
              }`}
            >
              <Volume2 className="w-4 h-4" />
              {activeTest === "L" ? "DETENER PRUEBA L" : "PROBAR IZQUIERDA (L)"}
            </button>
          </div>

          {/* Right Test */}
          <div className={`border-2 rounded-[2rem] p-8 flex flex-col justify-between transition-all duration-300 bg-neutral-900/40 ${
            activeTest === "R" ? "border-red-600 bg-red-950/10" : "border-neutral-900"
          }`}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">CANAL DERECHO (R)</span>
                {activeTest === "R" && <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />}
              </div>
              <h4 className="text-2xl font-black uppercase text-white tracking-wide">SECUENCIA MUSICAL</h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Debe escucharse tanto en la sala (PA para público) como en los monitores in-ears de la banda.
              </p>
            </div>
            
            <button
              onClick={() => handleTest("R")}
              className={`mt-8 w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 border ${
                activeTest === "R"
                  ? "bg-red-600 border-red-500 text-white shadow-xl shadow-red-600/20"
                  : "bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-300"
              }`}
            >
              <Volume2 className="w-4 h-4" />
              {activeTest === "R" ? "DETENER PRUEBA R" : "PROBAR DERECHA (R)"}
            </button>
          </div>
        </div>

        {/* Both Test (Alternating) */}
        <button
          onClick={() => handleTest("both")}
          className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest border transition-all duration-300 flex items-center justify-center gap-2 ${
            activeTest === "both"
              ? "bg-red-600 border-red-500 text-white"
              : "bg-neutral-900 hover:bg-neutral-850 border-neutral-900 text-neutral-300"
          }`}
        >
          <Volume2 className="w-4 h-4" />
          {activeTest === "both" ? "DETENER PRUEBA ALTERNADA" : "PROBAR AMBOS CANALES (ALTERNADO L -> R)"}
        </button>

        {/* Confirmation Checklist */}
        <section className="bg-neutral-900 border border-neutral-800/80 rounded-[2.5rem] p-8 space-y-6">
          <h3 className="font-black text-xl uppercase tracking-wider text-white">Validación Táctica</h3>
          
          <div className="space-y-4">
            <label className="flex items-start gap-4 p-4 rounded-2xl hover:bg-neutral-950/40 cursor-pointer transition-colors border border-transparent hover:border-neutral-800/50">
              <input
                type="checkbox"
                checked={confirmL}
                onChange={(e) => setConfirmL(e.target.checked)}
                className="w-5 h-5 rounded border-neutral-700 bg-neutral-950 text-red-600 focus:ring-red-600 mt-0.5"
              />
              <div className="space-y-1">
                <span className="text-sm font-bold text-white uppercase tracking-wide">Confirmo que L es Click y Guías</span>
                <p className="text-xs text-neutral-400">He escuchado el pulso de prueba únicamente en mi canal de click de in-ears.</p>
              </div>
            </label>

            <label className="flex items-start gap-4 p-4 rounded-2xl hover:bg-neutral-950/40 cursor-pointer transition-colors border border-transparent hover:border-neutral-800/50">
              <input
                type="checkbox"
                checked={confirmR}
                onChange={(e) => setConfirmR(e.target.checked)}
                className="w-5 h-5 rounded border-neutral-700 bg-neutral-950 text-red-600 focus:ring-red-600 mt-0.5"
              />
              <div className="space-y-1">
                <span className="text-sm font-bold text-white uppercase tracking-wide">Confirmo que R es Secuencia</span>
                <p className="text-xs text-neutral-400">He escuchado la secuencia musical únicamente en la salida asignada a sala/PA.</p>
              </div>
            </label>
          </div>

          <div className="pt-4 border-t border-neutral-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              {lastTestDate ? (
                <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-black flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Última prueba aprobada: {new Date(lastTestDate).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              ) : (
                <span className="text-[10px] text-red-400 uppercase tracking-widest font-black flex items-center gap-1.5">
                  ⚠️ Diagnóstico pendiente de aprobar
                </span>
              )}
            </div>

            <button
              onClick={handleSaveConfirmation}
              disabled={!confirmL || !confirmR}
              className={`px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 flex items-center gap-2 border ${
                confirmL && confirmR
                  ? "bg-red-600 hover:bg-red-500 border-red-500 text-white shadow-xl shadow-red-600/20"
                  : "bg-neutral-950 border-neutral-850 text-neutral-600 cursor-not-allowed"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {savedSuccess ? "¡PRUEBA REGISTRADA!" : "REGISTRAR DIAGNÓSTICO"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
