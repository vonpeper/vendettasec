"use client";

export function registerServiceWorker() {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("⚡ Service Worker registrado con éxito:", registration.scope);
        })
        .catch((error) => {
          console.error("❌ Error al registrar el Service Worker:", error);
        });
    });
  }
}
