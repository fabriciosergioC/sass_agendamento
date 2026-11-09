"use client";

import Link from "next/link";
import { useState } from "react";
import { saveClinic } from "@/lib/client-session";
import { checkPhone } from "@/lib/phone-input";

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
  const [fieldError, setFieldError] = useState("");
  const [clinicas, setClinicas] = useState<Clinica[] | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setClinicas(null);

    const check = checkPhone(
      phone,
      "Informe o WhatsApp da clínica com DDD."
    );
    if (check.error) {
      setFieldError(check.error);
      return;
    }
    setFieldError("");
    setLoading(true);

    try {
      const res = await fetch("/api/find-clinic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: check.value }),
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
        // Lembra a clínica para o atalho "Meus agendamentos" já abrir direto nela.
        saveClinic(lista[0].slug, lista[0].name);
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
        noValidate
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
            onChange={(e) => {
              setPhone(e.target.value);
              setFieldError("");
              setError("");
            }}
            placeholder="(11) 99999-9999"
            aria-invalid={Boolean(fieldError)}
            aria-describedby={fieldError ? "phone-error" : undefined}
            className={`w-full p-3 rounded-lg bg-zinc-800 border outline-none ${
              fieldError
                ? "border-red-500 focus:border-red-500"
                : "border-zinc-700 focus:border-gold-500"
            }`}
            required
          />
          {fieldError && (
            <p id="phone-error" role="alert" className="text-xs text-red-400">
              {fieldError}
            </p>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5"
          >
            <svg
              viewBox="0 0 24 24"
              className="mt-0.5 h-4 w-4 shrink-0 fill-none stroke-red-400 stroke-2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.5v5.5M12 16.5h.01" strokeLinecap="round" />
            </svg>
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {clinicas && clinicas.length > 1 && (
          <div className="mb-4 space-y-2">
            <p className="text-sm text-zinc-400">Esse número atende mais de uma clínica. Qual delas?</p>
            {clinicas.map((clinica) => (
              <a
                key={clinica.slug}
                href={`${PORTAL_URL}/b/${clinica.slug}`}
                onClick={() => saveClinic(clinica.slug, clinica.name)}
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

        <p className="mt-4 text-center text-xs text-zinc-400">
          Já é cliente?{" "}
          <Link
            href="/meus-agendamentos"
            className="underline underline-offset-4 hover:text-zinc-200"
          >
            Entrar na minha conta
          </Link>
        </p>
      </form>
    </div>
  );
}
