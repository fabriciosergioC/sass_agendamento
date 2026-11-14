"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTheme } from "./theme";
import { buildSlotsUrl, clinicToday, parseSlots, slotReasonLabel, slotsEqual, type Slot } from "@/lib/slots";
import { saveClinic, savePhone } from "@/lib/client-session";

type Svc = {
  id: string;
  name: string;
  category: string;
  durationMin: number;
  priceCents: number;
  description: string | null;
};

type Brb = {
  id: string;
  name: string;
  bio: string | null;
  specialties: string;
  serviceIds: string[];
};

type OrgInfo = {
  name: string;
  slug: string;
  primaryColor: string;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  instagram: string | null;
  phone: string | null;
  whatsapp: string | null;
};

type DoneState = {
  serviceName: string;
  barberName: string;
  date: string;
  time: string;
  priceCents: number;
};

const STEPS = ["Serviço", "Atendente", "Data", "Horário", "Seus dados"];
const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Telefone cadastrado → link do WhatsApp. Aceita "(31) 9...", "5531..." ou "+55 31...";
 * abaixo de 12 dígitos assumimos que falta o DDI (55), o que também protege números
 * com DDD 55 (RS), que têm só 11 dígitos.
 */
function whatsappHref(raw: string | null): string | null {
  const digits = raw?.replace(/\D/g, "") ?? "";
  if (!digits) return null;
  return `https://wa.me/${digits.length >= 12 ? digits : `55${digits}`}`;
}

/**
 * Instagram cadastrado → link do perfil. Aceita a URL completa, o usuário com
 * "@" ou só o nome do perfil; o painel permite qualquer um dos formatos.
 */
function instagramHref(raw: string | null): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const handle = value.replace(/^@+/, "").trim();
  return handle ? `https://www.instagram.com/${handle}` : null;
}

export default function BookingWizard({ org }: { org: OrgInfo }) {
  const { colors } = useTheme();
  const [services, setServices] = useState<Svc[]>([]);
  const [barbers, setBarbers] = useState<Brb[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [step, setStep] = useState(1);
  const [service, setService] = useState<Svc | null>(null);
  const [barber, setBarber] = useState<Brb | null>(null);
  const [date, setDate] = useState<string>(clinicToday());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsRefreshing, setSlotsRefreshing] = useState(false);
  const [slotsUpdatedAt, setSlotsUpdatedAt] = useState<number | null>(null);
  const [slotsError, setSlotsError] = useState("");
  const slotsRequestRef = useRef<AbortController | null>(null);
  const slotsRequestIdRef = useRef(0);
  const slotsLoadedRef = useRef(false);
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<DoneState | null>(null);

  // Usa a cor do tema atual do provedor, caindo de volta para a da org se necessário
  const accent = colors.accent;
  // O backend antigo nem sempre devolve "whatsapp" no config público; nesse
  // caso o telefone principal da clínica serve para abrir a conversa.
  const waHref = whatsappHref(org.whatsapp ?? org.phone);
  const igHref = instagramHref(org.instagram);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/public/${org.slug}/config`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) return setLoadError(data.error ?? "Não foi possível carregar.");
        setServices(data.services);
        setBarbers(data.barbers);
      } catch {
        setLoadError("Não foi possível carregar. Verifique sua conexão.");
      } finally {
        setLoading(false);
      }
    })();
  }, [org.slug]);

  const eligibleBarbers = useMemo(() => {
    if (!service) return barbers;
    return barbers.filter((b) => b.serviceIds.length === 0 || b.serviceIds.includes(service.id));
  }, [barbers, service]);

  const loadSlots = useCallback(async (options?: { silent?: boolean }) => {
    if (!service || !barber || !date) return;

    const silent = options?.silent === true;
    // A primeira consulta é sempre manual/visível; o polling não abre a tela com
    // uma mensagem vazia enquanto essa primeira resposta ainda está a caminho.
    if (silent && !slotsLoadedRef.current) return;

    // Cancela a consulta anterior para que uma resposta atrasada nunca mostre
    // horários de outro dia, serviço ou atendente.
    slotsRequestRef.current?.abort();
    const controller = new AbortController();
    slotsRequestRef.current = controller;
    const requestId = ++slotsRequestIdRef.current;

    if (silent) {
      setSlotsRefreshing(true);
    } else {
      slotsLoadedRef.current = false;
      setSlotsLoading(true);
      setSlotsRefreshing(false);
      setSlotsUpdatedAt(null);
      setSlotsError("");
      setSlots([]);
      setTime("");
    }
    try {
      const res = await fetch(buildSlotsUrl(org.slug, service.id, barber.id, date), {
        cache: "no-store",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      const data = await res.json().catch(() => null);
      if (requestId !== slotsRequestIdRef.current || controller.signal.aborted) return;
      if (!res.ok) {
        throw new Error(data?.error ?? "Não foi possível consultar os horários.");
      }
      const parsed = parseSlots(data);
      slotsLoadedRef.current = true;
      setSlotsUpdatedAt(Date.now());
      setSlotsError("");
      setSlots((prev) => (slotsEqual(prev, parsed) ? prev : parsed));
    } catch (err) {
      if (requestId !== slotsRequestIdRef.current || controller.signal.aborted) return;
      slotsLoadedRef.current = true;
      setSlots([]);
      setSlotsError(err instanceof Error ? err.message : "Não foi possível consultar os horários.");
    } finally {
      if (requestId === slotsRequestIdRef.current && !controller.signal.aborted) {
        setSlotsLoading(false);
        setSlotsRefreshing(false);
      }
    }
  }, [org.slug, service, barber, date]);

  const refreshSlots = useCallback(() => {
    void loadSlots();
  }, [loadSlots]);

  useEffect(() => {
    if (step !== 4) return;

    let active = true;
    let timer: number | undefined;

    const schedule = () => {
      if (active) timer = window.setTimeout(() => { void poll(); }, 5000);
    };
    const poll = async () => {
      if (document.visibilityState === "visible") await loadSlots({ silent: true });
      schedule();
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadSlots({ silent: true });
    };

    // Enquanto a etapa de horário está aberta, reconsulta o backend a cada 5 s.
    // Assim, salvar o funcionamento no painel aparece aqui sem precisar recarregar.
    schedule();
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [step, loadSlots]);

  useEffect(() => () => {
    slotsRequestIdRef.current += 1;
    slotsRequestRef.current?.abort();
  }, []);

  async function submit() {
    setError("");
    if (name.trim().length < 2) return setError("Informe seu nome completo.");
    if (phone.replace(/\D/g, "").length < 10) return setError("Informe um telefone válido com DDD.");
    if (!service || !barber || !time) return setError("Selecione serviço, atendente e horário.");

    setSaving(true);
    try {
      const res = await fetch(`/api/public/${org.slug}/book`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id,
          barberId: barber.id,
          date,
          time,
          name: name.trim(),
          phone: phone.trim(),
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível agendar. Tente novamente.");
        if (String(data.error ?? "").includes("ocupado") || String(data.error ?? "").includes("horário")) {
          setStep(4);
          void loadSlots();
        }
        return;
      }
      // Guarda a clínica e o WhatsApp usados agora: o atalho "Meus agendamentos"
      // já abre com o telefone preenchido para consultar/cancelar.
      saveClinic(org.slug, org.name);
      savePhone(phone.trim());
      setDone(data.appointment);
    } catch {
      setError("Não foi possível agendar. Verifique sua conexão.");
    } finally {
      setSaving(false);
    }
  }

  function restart() {
    slotsRequestIdRef.current += 1;
    slotsRequestRef.current?.abort();
    slotsLoadedRef.current = false;
    setDone(null);
    setStep(1);
    setService(null);
    setBarber(null);
    setDate(clinicToday());
    setSlots([]);
    setSlotsLoading(false);
    setSlotsRefreshing(false);
    setSlotsUpdatedAt(null);
    setSlotsError("");
    setTime("");
    setName("");
    setPhone("");
    setNotes("");
    setError("");
  }

  function goBack() {
    setError("");
    if (step === 5) setTime("");
    if (step === 4) {
      slotsRequestIdRef.current += 1;
      slotsRequestRef.current?.abort();
      slotsLoadedRef.current = false;
      setSlots([]);
      setSlotsUpdatedAt(null);
      setTime("");
    }
    setStep((current) => Math.max(1, current - 1));
  }

  const todayStr = clinicToday();
  const [y, m, d] = date.split("-").map(Number);
  const dateLabel = d && m
    ? `${WEEKDAY_LABELS[new Date(y, m - 1, d).getDay()]}, ${d} de ${MONTHS[m - 1]}`
    : "";

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center px-5">
        <div className="w-full max-w-md space-y-4">
          <div className="h-2 w-full animate-pulse rounded-full bg-[var(--color-nude)]" />
          <div className="h-2 w-3/4 animate-pulse rounded-full bg-[var(--color-nude)]" />
          <div className="h-2 w-1/2 animate-pulse rounded-full bg-[var(--color-nude)]" />
          <p className="mt-4 text-center text-sm text-[var(--color-text-secondary)]">Carregando serviços...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-[400px] items-center justify-center px-5">
        <div className="w-full max-w-md rounded-2xl bg-[var(--color-surface)] p-6 text-center shadow-lg border border-[var(--color-border)]">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]">Erro ao carregar</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">{loadError}</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto flex min-h-[400px] max-w-md flex-col justify-center px-5 py-10 text-center">
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: `${accent}22`, color: accent }}
        >
          ✓
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-[var(--color-text-primary)]">Agendamento confirmado!</h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Te esperamos na {org.name}. Chegue com alguns minutos de antecedência.
        </p>
        <div className="mt-6 space-y-2 rounded-xl bg-[var(--color-surface-elevated)] p-4 text-left text-sm shadow-sm border border-[var(--color-border)]">
          <div className="flex justify-between">
            <span className="text-[var(--color-text-secondary)]">Serviço</span>
            <span className="font-medium text-[var(--color-text-primary)]">{done.serviceName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-text-secondary)]">Profissional</span>
            <span className="font-medium text-[var(--color-text-primary)]">{done.barberName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-text-secondary)]">Quando</span>
            <span className="font-medium text-[var(--color-text-primary)]">{done.date.split("-").reverse().join("/")} às {done.time}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-text-secondary)]">Valor</span>
            <span className="font-medium" style={{ color: accent }}>{brl(done.priceCents)}</span>
          </div>
        </div>
        <button
          onClick={restart}
          className="mt-6 w-full rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface)]"
        >
          Fazer outro agendamento
        </button>
        <Link
          href="/meus-agendamentos"
          className="mt-2 block w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: accent }}
        >
          Acompanhar meu agendamento
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-5 pb-16">
      <header className="pt-10 pb-6 text-center">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${accent}1f`, color: accent }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M11 2.5 12.9 8l5.6 1.9-5.6 1.9L11 17.3 9.1 11.8 3.5 9.9 9.1 8z" />
            <path d="M17.8 13.6l1 2.7 2.7 1-2.7 1-1 2.7-1-2.7-2.7-1 2.7-1z" />
          </svg>
        </div>
        <h1 className="mt-3 text-xl font-semibold text-[var(--color-text-primary)]">{org.name}</h1>
        {org.description && <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{org.description}</p>}
        {(org.city || org.state) && (
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            {org.city}{org.city && org.state ? " · " : ""}{org.state}
          </p>
        )}
        {(waHref || igHref) && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{ backgroundColor: accent }}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.26 8.26 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 4.54 0 8.24 3.7 8.24 8.24 0 4.55-3.7 8.24-8.24 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.25-.42.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.39 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.14-1.18-.06-.11-.22-.17-.47-.29z" />
                </svg>
                Falar no WhatsApp
              </a>
            )}
            {igHref && (
              <a
                href={igHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors hover:bg-[var(--color-surface)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{ borderColor: accent, color: accent }}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
                Instagram
              </a>
            )}
          </div>
        )}
      </header>

      <ol className="mb-6 flex items-center justify-between">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const isDone = n < step;
          const isCurrent = n === step;
          return (
            <li key={label} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors"
                  style={
                    isCurrent
                      ? { backgroundColor: accent, borderColor: accent, color: "#ffffff" }
                      : isDone
                      ? { backgroundColor: `${accent}33`, borderColor: `${accent}66`, color: accent }
                      : { borderColor: "var(--color-border)", color: "var(--color-text-muted)" }
                  }
                >
                  {isDone ? "✓" : n}
                </div>
                <span className={`text-[10px] ${isCurrent ? "font-medium" : ""}`} style={{ color: isCurrent ? "var(--color-text-primary)" : "var(--color-text-muted)" }}>
                  {label}
                </span>
              </div>
              {n < STEPS.length && <div className="mx-1 mb-4 h-px flex-1 bg-[var(--color-border)]" style={isDone ? { backgroundColor: `${accent}66` } : undefined} />}
            </li>
          );
        })}
      </ol>

      {step > 1 && (
        <button
          type="button"
          onClick={goBack}
          className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface)]"
          aria-label="Voltar para a etapa anterior"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Voltar
        </button>
      )}

      {step === 1 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-[var(--color-text-primary)]">Escolha o serviço</h2>
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => { setService(s); setBarber(null); setSlots([]); setTime(""); setStep(2); }}
              className="flex w-full items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 text-left transition-colors hover:bg-[var(--color-surface)]"
            >
              <div>
                <p className="font-medium text-[var(--color-text-primary)]">{s.name}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{s.durationMin} min {s.category ? `· ${s.category}` : ""}</p>
              </div>
              <span className="font-semibold" style={{ color: accent }}>{brl(s.priceCents)}</span>
            </button>
          ))}
        </section>
      )}

      {step === 2 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-[var(--color-text-primary)]">Com quem quer atender-se?</h2>
          {eligibleBarbers.length === 0 && (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-center">
              <p className="text-sm text-[var(--color-text-secondary)]">Nenhum profissional executa este serviço no momento.</p>
            </div>
          )}
          {eligibleBarbers.map((b) => (
            <button
              key={b.id}
              onClick={() => { setBarber(b); setSlots([]); setTime(""); setStep(3); }}
              className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 text-left transition-colors hover:bg-[var(--color-surface)]"
            >
              <div
                className="flex h-11 w-11 items-center justify-center rounded-full text-lg font-semibold"
                style={{ backgroundColor: `${accent}1f`, color: accent }}
              >
                {b.name.slice(0, 1)}
              </div>
              <div>
                <p className="font-medium text-[var(--color-text-primary)]">{b.name}</p>
                {b.specialties && <p className="text-xs text-[var(--color-text-secondary)]">{b.specialties}</p>}
              </div>
            </button>
          ))}
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-[var(--color-text-primary)]">Escolha o dia</h2>
          <input
            type="date"
            value={date}
            min={todayStr}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2.5 text-sm focus:border-[var(--color-gold)] focus:outline-none text-[var(--color-text-primary)]"
          />
          <button
            type="button"
            onClick={() => { setStep(4); void loadSlots(); }}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: accent }}
          >
            Ver horários
          </button>
        </section>
      )}

      {step === 4 && (
        <section className="space-y-4" aria-busy={slotsLoading}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-[var(--color-text-primary)]">Horários para {dateLabel}</h2>
            <button
              type="button"
              onClick={refreshSlots}
              disabled={slotsLoading}
              title="Os horários são reconsultados automaticamente a cada 5 segundos"
              className="text-xs disabled:opacity-50"
              style={{ color: accent }}
            >
              {slotsLoading ? "atualizando..." : slotsRefreshing ? "verificando..." : "atualizar"}
            </button>
          </div>
          {slotsLoading ? (
            <div className="grid grid-cols-4 gap-2" aria-label="Carregando horários">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-9 animate-pulse rounded-lg bg-[var(--color-nude)]" />
              ))}
            </div>
          ) : slotsError ? (
            <div role="alert" className="rounded-xl border border-dashed border-red-500/30 bg-[var(--color-surface)] p-6 text-center">
              <p className="text-sm text-red-500">{slotsError}</p>
              <button type="button" onClick={refreshSlots} className="mt-2 text-xs underline" style={{ color: accent }}>
                tentar novamente
              </button>
            </div>
          ) : slots.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
              <p className="text-sm text-[var(--color-text-secondary)]">O atendente não atende nesta data.</p>
              <button type="button" onClick={() => setStep(3)} className="mt-2 text-xs underline" style={{ color: accent }}>
                escolher outro dia
              </button>
            </div>
          ) : slots.filter((s) => s.available).length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
              <p className="text-sm text-[var(--color-text-secondary)]">Sem horários livres neste dia.</p>
              <button type="button" onClick={() => setStep(3)} className="mt-2 text-xs underline" style={{ color: accent }}>
                escolher outro dia
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {slots.map((s) => {
                const reasonLabel = slotReasonLabel(s.reason);
                return (
                  <button
                    key={s.start}
                    type="button"
                    disabled={!s.available}
                    title={reasonLabel}
                    aria-label={reasonLabel ? `${s.start} — ${reasonLabel}` : s.start}
                    onClick={() => { setTime(s.start); setStep(5); }}
                    className={`rounded-lg border px-2 py-2 text-sm transition-colors ${
                      !s.available
                        ? "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] cursor-not-allowed line-through"
                        : "border-[var(--color-gold)] bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] hover:bg-[var(--color-nude)]"
                    }`}
                  >
                    {s.start}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {step === 5 && (
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-[var(--color-text-primary)]">Seus dados</h2>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2.5 text-sm focus:border-[var(--color-gold)] focus:outline-none text-[var(--color-text-primary)]"
            />
            <input
              type="tel"
              placeholder="Telefone (com DDD)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2.5 text-sm focus:border-[var(--color-gold)] focus:outline-none text-[var(--color-text-primary)]"
            />
            <textarea
              placeholder="Observações (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2.5 text-sm focus:border-[var(--color-gold)] focus:outline-none text-[var(--color-text-primary)]"
              rows={3}
            />
          </div>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button
            onClick={submit}
            disabled={saving}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: accent }}
          >
            {saving ? "Agendando..." : "Confirmar agendamento"}
          </button>
        </section>
      )}
    </div>
  );
}