"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Comunicação direta com a API do backend
      const res = await fetch("https://gestao-estetica.up.railway.app/api/cliente-portal/bela-face/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", phone: phone.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao fazer login");
      }

      // Redireciona para o portal se sucesso
      window.location.href = "https://gestao-estetica.up.railway.app/c/bela-face/painel";
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-950 text-white">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl">
        <h1 className="text-xl font-semibold mb-6">Acesse seu agendamento</h1>

        <div className="space-y-2 mb-4">
          <label className="text-sm text-zinc-400">WhatsApp (com DDD)</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(11) 99999-9999"
            className="w-full p-3 rounded-lg bg-zinc-800 border border-zinc-700 focus:border-gold-500 outline-none"
            required
          />
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gold-500 text-zinc-950 font-semibold py-3 rounded-lg hover:bg-gold-400 disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
