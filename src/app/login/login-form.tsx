"use client";

import { useState } from "react";

// O número da clínica serve só para localizá-la. Depois de identificada, a pessoa
// cai direto no agendamento público dela (no domínio da clínica, no Railway) —
// sem pedir telefone de cliente nem criar cadastro.
const PORTAL_URL = (
  process.env.NEXT_PUBLIC_PORTAL_URL || "https://gestao-estetica.up.railway.app"
).replace(/\/+$/, "");

type Clinica = { slug: string; name: string };

export function LoginForm() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clinicas, setClinicas] = useState<Clinica[] | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setClinicas(null);

    try {
      const res = await fetch("/api/find-clinic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Não foi possível buscar a clínica.");
        return;
      }

      const lista: Clinica[] = Array.isArray(data.clinicas) ? data.clinicas : [];

      if (lista.length === 0) {
        setError("Nenhuma clínica encontrada com esse número.");
        return;
      }

      if (lista.length === 1) {
        window.location.href = `${PORTAL_URL}/b/${lista[0].slug}`;
        return;
      }

      setClinicas(lista);
    } catch {
      setError("Falha de conexão. Verifique sua internet.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-950 text-white">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl"
      >
        <h1 className="text-xl font-semibold mb-6">Acesse seu agendamento</h1>

        <div className="space-y-2 mb-4">
          <label htmlFor="phone" className="text-sm text-zinc-400">
            WhatsApp da clínica (com DDD)
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(11) 99999-9999"
            className="w-full p-3 rounded-lg bg-zinc-800 border border-zinc-700 focus:border-gold-500 outline-none"
            required
          />
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {clinicas && clinicas.length > 1 && (
          <div className="mb-4 space-y-2">
            <p className="text-sm text-zinc-400">Esse número atende mais de uma clínica. Qual delas?</p>
            {clinicas.map((clinica) => (
              <a
                key={clinica.slug}
                href={`${PORTAL_URL}/b/${clinica.slug}`}
                className="block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium hover:border-gold-500"
              >
                {clinica.name}
              </a>
            ))}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gold-500 text-zinc-950 font-semibold py-3 rounded-lg hover:bg-gold-400 disabled:opacity-50"
        >
          {loading ? "Buscando..." : "Abrir agendamento"}
        </button>
      </form>
    </div>
  );
}
