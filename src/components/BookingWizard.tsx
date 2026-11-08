"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "./theme";

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

type Slot = {
  start: string;
  available: boolean;
  reason?: string;
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

function toDateInput(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  const [date, setDate] = useState<string>(toDateInput(new Date()));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<DoneState | null>(null);

  // Usa a cor do tema atual do provedor, caindo de volta para a da org se necessário
  const accent = colors.accent;

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

  const loadSlots = useCallback(async () => {
    if (!service || !barber || !date) return;
    setSlotsLoading(true);
    setSlotsError("");
    setTime("");
    try {
      const res = await fetch(
        `/api/public/${org.slug}/slots?serviceId=${encodeURIComponent(service.id)}&barberId=${encodeURIComponent(barber.id)}&date=${encodeURIComponent(date)}`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Não foi possível consultar os horários.");
      }
      setSlots(Array.isArray(data.slots) ? data.slots : []);
    } catch (err) {
      setSlots([]);
      setSlotsError(err instanceof Error ? err.message : "Não foi possível consultar os horários.");
    } finally {
      setSlotsLoading(false);
    }
  }, [org.slug, service, barber, date]);

  useEffect(() => {
    if (step === 4) loadSlots();
  }, [step, loadSlots]);

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
          loadSlots();
        }
        return;
      }
      setDone(data.appointment);
    } catch {
      setError("Não foi possível agendar. Verifique sua conexão.");
    } finally {
      setSaving(false);
    }
  }

  function restart() {
    setDone(null);
    setStep(1);
    setService(null);
    setBarber(null);
    setDate(toDateInput(new Date()));
    setTime("");
    setName("");
    setPhone("");
    setNotes("");
    setError("");
  }

  const todayStr = toDateInput(new Date());
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

      {step === 1 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-[var(--color-text-primary)]">Escolha o serviço</h2>
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => { setService(s); setBarber(null); setStep(2); }}
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
              onClick={() => { setBarber(b); setStep(3); }}
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
            onClick={() => setStep(4)}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: accent }}
          >
            Ver horários
          </button>
        </section>
      )}

      {step === 4 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-[var(--color-text-primary)]">Horários para {dateLabel}</h2>
            <button onClick={loadSlots} className="text-xs" style={{ color: accent }}>
              atualizar
            </button>
          </div>
          {slotsLoading ? (
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-9 animate-pulse rounded-lg bg-[var(--color-nude)]" />
              ))}
            </div>
          ) : slotsError ? (
            <div className="rounded-xl border border-dashed border-red-500/30 bg-[var(--color-surface)] p-6 text-center">
              <p className="text-sm text-red-500">{slotsError}</p>
              <button onClick={loadSlots} className="mt-2 text-xs underline" style={{ color: accent }}>
                tentar novamente
              </button>
            </div>
          ) : slots.filter((s) => s.available).length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
              <p className="text-sm text-[var(--color-text-secondary)]">Sem horários livres neste dia.</p>
              <button onClick={() => setStep(3)} className="mt-2 text-xs underline" style={{ color: accent }}>
                escolher outro dia
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {slots.map((s) => (
                <button
                  key={s.start}
                  disabled={!s.available}
                  onClick={() => { setTime(s.start); setStep(5); }}
                  className={`rounded-lg border px-2 py-2 text-sm transition-colors ${
                    !s.available
                      ? "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] cursor-not-allowed"
                      : "border-[var(--color-gold)] bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] hover:bg-[var(--color-nude)]"
                  }`}
                >
                  {s.start}
                </button>
              ))}
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
          {error && <p className="text-sm text-red-600">{error}</p>}
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