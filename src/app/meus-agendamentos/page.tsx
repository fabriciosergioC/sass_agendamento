"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ThemeMenu } from "@/components/theme";
import { checkPhone } from "@/lib/phone-input";
import {
  clearClientStorage,
  forgetClinic,
  forgetSessionClinic,
  readSessionSlug,
  readStoredClinicName,
  readStoredPhone,
  readStoredSlug,
  saveClinic,
  savePhone,
  saveSessionClinic,
} from "@/lib/client-session";

type ClinicaOption = { slug: string; name: string };

type Org = {
  name: string;
  slug: string;
  primaryColor?: string;
};

type Appointment = {
  id: string;
  startAt: string;
  status: string;
  serviceName: string;
  durationMin?: number;
  barberName: string;
  priceCents: number;
  notes?: string | null;
};

type MeData = {
  org: Org;
  cliente: { name: string; phone: string };
  upcoming: Appointment[];
  historico: Appointment[];
};

const TIME_ZONE = "America/Sao_Paulo";

const STATUS_META: Record<
  string,
  { label: string; tone: "accent" | "warn" | "muted" | "danger" }
> = {
  SCHEDULED: { label: "Agendado", tone: "accent" },
  CONFIRMED: { label: "Confirmado", tone: "accent" },
  IN_SERVICE: { label: "Em atendimento", tone: "warn" },
  COMPLETED: { label: "Concluído", tone: "muted" },
  CANCELLED: { label: "Cancelado", tone: "danger" },
  NO_SHOW: { label: "Não compareceu", tone: "danger" },
};

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(iso: string) {
  const text = new Date(iso).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: TIME_ZONE,
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });
}

function canCancel(appointment: Appointment) {
  // O backend cancela por status (SCHEDULED/CONFIRMED/IN_SERVICE), mesmo que o
  // horário já tenha passado e a clínica ainda não tenha fechado o atendimento.
  return ["SCHEDULED", "CONFIRMED", "IN_SERVICE"].includes(appointment.status);
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, tone: "muted" as const };
  const style =
    meta.tone === "danger"
      ? { color: "#dc2626", backgroundColor: "rgba(220, 38, 38, 0.10)" }
      : meta.tone === "warn"
      ? {
          color: "var(--color-gold-600)",
          backgroundColor: "color-mix(in srgb, var(--accent) 15%, transparent)",
        }
      : meta.tone === "accent"
      ? {
          color: "var(--accent)",
          backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)",
        }
      : {
          color: "var(--color-text-secondary)",
          backgroundColor: "var(--color-surface)",
        };

  return (
    <span
      className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={style}
    >
      {meta.label}
    </span>
  );
}

function CancelControl({
  confirming,
  cancelling,
  onAskCancel,
  onDismissCancel,
  onConfirmCancel,
}: {
  confirming: boolean;
  cancelling: boolean;
  onAskCancel: () => void;
  onDismissCancel: () => void;
  onConfirmCancel: () => void;
}) {
  return confirming ? (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[var(--color-text-secondary)]">
        Cancelar mesmo?
      </span>
      <button
        type="button"
        onClick={onConfirmCancel}
        disabled={cancelling}
        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
      >
        {cancelling ? "Cancelando..." : "Sim, cancelar"}
      </button>
      <button
        type="button"
        onClick={onDismissCancel}
        disabled={cancelling}
        className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface)] disabled:opacity-50"
      >
        Voltar
      </button>
    </div>
  ) : (
    <button
      type="button"
      onClick={onAskCancel}
      className="rounded-lg border border-red-600/40 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-600/10"
    >
      Cancelar agendamento
    </button>
  );
}

function AppointmentCard({
  appointment,
  confirming,
  cancelling,
  onAskCancel,
  onDismissCancel,
  onConfirmCancel,
}: {
  appointment: Appointment;
  confirming: boolean;
  cancelling: boolean;
  onAskCancel: () => void;
  onDismissCancel: () => void;
  onConfirmCancel: () => void;
}) {
  return (
    <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-[var(--color-text-primary)]">
            {appointment.serviceName}
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
            {appointment.barberName}
            {appointment.durationMin ? ` · ${appointment.durationMin} min` : ""}
          </p>
        </div>
        <StatusBadge status={appointment.status} />
      </div>

      <p className="mt-3 text-sm font-medium text-[var(--color-text-primary)]">
        {formatDate(appointment.startAt)} às {formatTime(appointment.startAt)}
      </p>
      {appointment.notes && (
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          Obs.: {appointment.notes}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
          {brl(appointment.priceCents)}
        </span>

        {canCancel(appointment) && (
          <CancelControl
            confirming={confirming}
            cancelling={cancelling}
            onAskCancel={onAskCancel}
            onDismissCancel={onDismissCancel}
            onConfirmCancel={onConfirmCancel}
          />
        )}
      </div>
    </article>
  );
}

export default function MeusAgendamentosPage() {
  const [slug, setSlug] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [clinicPhone, setClinicPhone] = useState("");
  const [phone, setPhone] = useState("");
  const [clinicas, setClinicas] = useState<ClinicaOption[] | null>(null);
  const [me, setMe] = useState<MeData | null>(null);
  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    clinicPhone?: string;
    phone?: string;
  }>({});
  const [notice, setNotice] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadMe = useCallback(async (targetSlug: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/client-session/me?slug=${encodeURIComponent(targetSlug)}`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        forgetSessionClinic();
        setMe(null);
        return false;
      }
      if (!res.ok) {
        setError(data.error ?? "Não foi possível carregar seus agendamentos.");
        return false;
      }

      const loaded = data as MeData;
      setMe({
        ...loaded,
        upcoming: loaded.upcoming ?? [],
        historico: loaded.historico ?? [],
      });
      setSlug(loaded.org.slug);
      setClinicName(loaded.org.name);
      setPhone(loaded.cliente.phone);
      saveClinic(loaded.org.slug, loaded.org.name);
      saveSessionClinic(loaded.org.slug);
      savePhone(loaded.cliente.phone);
      return true;
    } catch {
      setError("Falha de conexão. Verifique sua internet.");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Lê a clínica lembrada só depois da montagem (localStorage/cookie não existem no SSR).
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const fromQuery = new URLSearchParams(window.location.search)
        .get("clinica")
        ?.trim();
      // A sessão ativa manda: nunca consultamos /me numa clínica diferente da
      // que autenticou o cliente. Sem sessão, usa o link/slug lembrado.
      const target = readSessionSlug() || fromQuery || readStoredSlug();

      setPhone(readStoredPhone());
      setClinicName(readStoredClinicName());

      if (!target) {
        setBooting(false);
        return;
      }

      setSlug(target);
      void loadMe(target).finally(() => setBooting(false));
    });
    return () => cancelAnimationFrame(frame);
  }, [loadMe]);

  const doLogin = useCallback(
    async (targetSlug: string, name?: string) => {
      const clientPhone = checkPhone(phone, "Informe seu WhatsApp com DDD.");
      if (clientPhone.error) {
        setFieldErrors((prev) => ({ ...prev, phone: clientPhone.error }));
        setError("");
        return;
      }

      setLoading(true);
      setError("");
      setFieldErrors({});
      setNotice("");
      setClinicas(null);
      try {
        const res = await fetch("/api/client-session/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: targetSlug, phone: clientPhone.value }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setError(data.error ?? "Não foi possível entrar. Confira o número.");
          return;
        }

        saveClinic(targetSlug, name);
        saveSessionClinic(targetSlug);
        setSlug(targetSlug);
        if (name) setClinicName(name);
        setConfirmId(null);
        await loadMe(targetSlug);
      } catch {
        setError("Falha de conexão. Verifique sua internet.");
      } finally {
        setLoading(false);
      }
    },
    [phone, loadMe]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setClinicas(null);

    if (slug) {
      await doLogin(slug, clinicName);
      return;
    }

    const clinicPhoneCheck = checkPhone(
      clinicPhone,
      "Informe o WhatsApp da clínica com DDD."
    );
    const clientPhoneCheck = checkPhone(phone, "Informe seu WhatsApp com DDD.");
    if (clinicPhoneCheck.error || clientPhoneCheck.error) {
      // Mostra os dois campos inválidos de uma vez, em vez de um por envio.
      setFieldErrors({
        clinicPhone: clinicPhoneCheck.error || undefined,
        phone: clientPhoneCheck.error || undefined,
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/find-clinic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: clinicPhoneCheck.value }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Não foi possível encontrar a clínica.");
        return;
      }

      const lista: ClinicaOption[] = Array.isArray(data.clinicas)
        ? data.clinicas
        : [];

      if (lista.length === 0) {
        setError("Nenhuma clínica encontrada com esse número.");
        return;
      }
      if (lista.length === 1) {
        await doLogin(lista[0].slug, lista[0].name);
        return;
      }

      setClinicas(lista);
    } catch {
      setError("Falha de conexão. Verifique sua internet.");
    } finally {
      setLoading(false);
    }
  }

  async function cancel(appointmentId: string) {
    if (!slug) return;
    setCancellingId(appointmentId);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/client-session/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, appointmentId }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        forgetSessionClinic();
        setMe(null);
        setError("Sua sessão expirou. Entre novamente.");
        return;
      }
      if (!res.ok || data.ok === false) {
        setError(data.error ?? "Não foi possível cancelar o agendamento.");
        return;
      }

      setConfirmId(null);
      setNotice("Agendamento cancelado.");
      await loadMe(slug);
    } catch {
      setError("Falha de conexão. Verifique sua internet.");
    } finally {
      setCancellingId(null);
    }
  }

  async function logout() {
    try {
      await fetch("/api/client-session/logout", { method: "POST" });
    } catch {}
    clearClientStorage();
    setMe(null);
    setSlug("");
    setClinicName("");
    setPhone("");
    setClinicas(null);
    setNotice("");
    setError("");
    setFieldErrors({});
    setConfirmId(null);
  }

  async function switchClinic() {
    // Encerra a sessão atual: a próxima consulta será de outra clínica.
    try {
      await fetch("/api/client-session/logout", { method: "POST" });
    } catch {}
    forgetSessionClinic();
    forgetClinic();
    setSlug("");
    setClinicName("");
    setClinicas(null);
    setMe(null);
    setError("");
    setFieldErrors({});
    setNotice("");
    setConfirmId(null);
  }

  const firstName = me?.cliente.name.split(" ")[0] ?? "";

  return (
    <main className="min-h-screen bg-[var(--color-background)] text-[var(--color-text-primary)]">
      <div className="mx-auto max-w-md px-5 pb-20 pt-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface)]"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 fill-none stroke-current stroke-2"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Início
          </Link>
          <ThemeMenu />
        </div>

        {booting ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <p className="text-sm text-[var(--color-text-secondary)]">Carregando...</p>
          </div>
        ) : me ? (
          <section className="space-y-5">
            <header className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
                  {me.org.name}
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">
                  Meus agendamentos
                </h1>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Olá, {firstName}. Aqui estão seus horários.
                </p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="shrink-0 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]"
              >
                Sair
              </button>
            </header>

            {notice && (
              <p
                role="status"
                className="rounded-lg border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-700"
              >
                {notice}
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-600/30 bg-red-600/10 px-3 py-2 text-sm text-red-600"
              >
                {error}
              </p>
            )}

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Próximos
                </h2>
                <Link
                  href="/login"
                  className="text-xs font-medium underline underline-offset-4"
                  style={{ color: "var(--accent)" }}
                >
                  novo agendamento
                </Link>
              </div>

              {me.upcoming.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Você não tem agendamentos futuros.
                  </p>
                  <Link
                    href="/login"
                    className="mt-3 inline-block rounded-lg px-4 py-2 text-sm font-medium text-white"
                    style={{ backgroundColor: "var(--accent)" }}
                  >
                    Agendar um horário
                  </Link>
                </div>
              ) : (
                me.upcoming.map((appointment) => (
                  <AppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    confirming={confirmId === appointment.id}
                    cancelling={cancellingId === appointment.id}
                    onAskCancel={() => {
                      setConfirmId(appointment.id);
                      setError("");
                      setNotice("");
                    }}
                    onDismissCancel={() => setConfirmId(null)}
                    onConfirmCancel={() => void cancel(appointment.id)}
                  />
                ))
              )}
            </section>

            {me.historico.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Histórico
                </h2>
                <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)]">
                  {me.historico.slice(0, 8).map((appointment) => (
                    <li
                      key={appointment.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                          {appointment.serviceName}
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {new Date(appointment.startAt).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            timeZone: TIME_ZONE,
                          })}{" "}
                          às {formatTime(appointment.startAt)} · {appointment.barberName}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        {canCancel(appointment) && (
                          <CancelControl
                            confirming={confirmId === appointment.id}
                            cancelling={cancellingId === appointment.id}
                            onAskCancel={() => {
                              setConfirmId(appointment.id);
                              setError("");
                              setNotice("");
                            }}
                            onDismissCancel={() => setConfirmId(null)}
                            onConfirmCancel={() => void cancel(appointment.id)}
                          />
                        )}
                        <StatusBadge status={appointment.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </section>
        ) : (
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-6 shadow-lg">
            <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
              Minha conta
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Entre com o WhatsApp cadastrado na clínica para ver e cancelar
              seus horários.
            </p>

            {/* noValidate: as mensagens de erro são nossas, exibidas na tela. */}
            <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
              {slug ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5">
                  <span className="min-w-0 truncate text-sm text-[var(--color-text-secondary)]">
                    Clínica:{" "}
                    <strong className="text-[var(--color-text-primary)]">
                      {clinicName || slug}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => void switchClinic()}
                    className="shrink-0 text-xs font-medium underline underline-offset-4"
                    style={{ color: "var(--accent)" }}
                  >
                    trocar
                  </button>
                </div>
              ) : (
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    WhatsApp da clínica (com DDD)
                  </span>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={clinicPhone}
                    onChange={(e) => {
                      setClinicPhone(e.target.value);
                      setFieldErrors((prev) => ({
                        ...prev,
                        clinicPhone: undefined,
                      }));
                      setError("");
                    }}
                    placeholder="(31) 99999-9999"
                    aria-invalid={Boolean(fieldErrors.clinicPhone)}
                    aria-describedby={
                      fieldErrors.clinicPhone ? "clinic-phone-error" : undefined
                    }
                    className={`w-full rounded-lg border bg-[var(--color-surface-elevated)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none ${
                      fieldErrors.clinicPhone
                        ? "border-red-600 focus:border-red-600"
                        : "border-[var(--color-border)] focus:border-[var(--color-gold-500)]"
                    }`}
                  />
                  {fieldErrors.clinicPhone && (
                    <span
                      id="clinic-phone-error"
                      role="alert"
                      className="block text-xs text-red-600"
                    >
                      {fieldErrors.clinicPhone}
                    </span>
                  )}
                </label>
              )}

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  Seu WhatsApp (com DDD)
                </span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                    setError("");
                  }}
                  placeholder="(31) 99999-9999"
                  aria-invalid={Boolean(fieldErrors.phone)}
                  aria-describedby={
                    fieldErrors.phone ? "client-phone-error" : undefined
                  }
                  className={`w-full rounded-lg border bg-[var(--color-surface-elevated)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none ${
                    fieldErrors.phone
                      ? "border-red-600 focus:border-red-600"
                      : "border-[var(--color-border)] focus:border-[var(--color-gold-500)]"
                  }`}
                  required
                />
                {fieldErrors.phone && (
                  <span
                    id="client-phone-error"
                    role="alert"
                    className="block text-xs text-red-600"
                  >
                    {fieldErrors.phone}
                  </span>
                )}
              </label>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-red-600/30 bg-red-600/10 px-3 py-2.5"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="mt-0.5 h-4 w-4 shrink-0 fill-none stroke-red-600 stroke-2"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7.5v5.5M12 16.5h.01" strokeLinecap="round" />
                  </svg>
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {clinicas && clinicas.length > 1 && (
                <div className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Esse número atende mais de uma clínica. Qual delas?
                  </p>
                  {clinicas.map((clinica) => (
                    <button
                      key={clinica.slug}
                      type="button"
                      onClick={() => void doLogin(clinica.slug, clinica.name)}
                      disabled={loading}
                      className="block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-left text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-gold-500)] disabled:opacity-50"
                    >
                      {clinica.name}
                    </button>
                  ))}
                </div>
              )}

              {!clinicas && (
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: "var(--accent)" }}
                >
                  {loading ? "Entrando..." : "Entrar"}
                </button>
              )}
            </form>

            <p className="mt-4 text-center text-xs text-[var(--color-text-muted)]">
              Ainda não tem cadastro?{" "}
              <Link href="/login" className="underline underline-offset-4">
                Agende seu primeiro horário
              </Link>
              .
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
