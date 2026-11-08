"use client";

import { useEffect } from "react";

// Registra o service worker que mora em public/sw.js. Ele é um pass-through sem cache:
// serve só para o navegador tratar o site como aplicativo instalável (ver public/sw.js).
//
// Fica montado no layout, então uma única visita ao link já deixa o app disponível para
// "Adicionar à tela inicial".
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Service worker exige contexto seguro: https (ou localhost). Por http em IP da rede
    // o navegador recusa, e um register() aí só gera erro no console.
    if (!window.isSecureContext) return;

    navigator.serviceWorker
      .register("/sw.js", {
        scope: "/",
        // "none" = não usa o cache HTTP do próprio arquivo: ao reabrir o site o navegador
        // confere se o sw.js mudou, em vez de esperar 24 h.
        updateViaCache: "none",
      })
      .catch(() => {
        // túnel fora do ar, aba em background, política restrita do navegador: não há
        // o que corrigir daqui, o site continua funcionando sem o service worker.
      });
  }, []);

  return null;
}
