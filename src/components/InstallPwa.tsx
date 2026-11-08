"use client";

import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPwa() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);

    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const markInstalled = () => setInstalled(true);

    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  async function install() {
    if (!promptEvent) {
      setShowHelp(true);
      return;
    }
    await promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
  }

  if (installed) return null;

  const isWindows = /Windows/i.test(navigator.userAgent);

  return (
    <>
      <button
        type="button"
        onClick={install}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-[var(--accent)] bg-[var(--color-surface-elevated)] px-4 py-3 text-sm font-semibold shadow-xl"
        style={{ color: "var(--accent)" }}
        aria-label="Instalar aplicativo Agendamento"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2" aria-hidden="true">
          <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
        </svg>
        Instalar app
      </button>

      {showHelp && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5 shadow-2xl">
            <h2 className="text-lg font-semibold">Instalar o Agendamento</h2>
            {isWindows ? (
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                No Chrome ou Edge, clique no ícone de instalação na barra de endereço e escolha <strong>Instalar</strong>.
              </p>
            ) : (
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                No Chrome ou Edge do Android, abra o menu ⋮ do navegador e escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.
              </p>
            )}
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="mt-5 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
              style={{ backgroundColor: "var(--accent)" }}
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
