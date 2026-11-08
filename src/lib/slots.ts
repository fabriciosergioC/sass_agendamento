export type Slot = {
  start: string;
  available: boolean;
  reason?: string;
};

/** O backend calcula a disponibilidade neste fuso (America/Sao_Paulo). */
export const CLINIC_TIME_ZONE = "America/Sao_Paulo";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Data de hoje no fuso da clínica, no formato YYYY-MM-DD usado pelo backend. */
export function clinicToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Monta a consulta pública de horários com os mesmos parâmetros do backend. */
export function buildSlotsUrl(slug: string, serviceId: string, barberId: string, date: string): string {
  const params = new URLSearchParams({ serviceId, barberId, date });
  return `/api/public/${encodeURIComponent(slug)}/slots?${params.toString()}`;
}

/**
 * Lê a resposta exacta de /api/public/[slug]/slots sem inventar, ordenar ou
 * filtrar horários: a disponibilidade vem inteira do backend.
 */
export function parseSlots(data: unknown): Slot[] {
  if (typeof data !== "object" || data === null || !Array.isArray((data as { slots?: unknown }).slots)) {
    throw new Error("Resposta de horários inválida.");
  }

  return ((data as { slots: unknown[] }).slots).map((item) => {
    if (typeof item !== "object" || item === null) {
      throw new Error("Resposta de horários inválida.");
    }
    const { start, available, reason } = item as Record<string, unknown>;
    if (typeof start !== "string" || !HHMM.test(start) || typeof available !== "boolean") {
      throw new Error("Resposta de horários inválida.");
    }
    if (reason !== undefined && typeof reason !== "string") {
      throw new Error("Resposta de horários inválida.");
    }
    return reason === undefined ? { start, available } : { start, available, reason };
  });
}

/** Compara duas respostas do backend sem depender da identidade do array. */
export function slotsEqual(a: Slot[], b: Slot[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((slot, index) => {
    const other = b[index];
    return slot.start === other.start && slot.available === other.available && slot.reason === other.reason;
  });
}

export function slotReasonLabel(reason?: string): string | undefined {
  switch (reason) {
    case "passado":
      return "Horário já passou";
    case "pausa":
      return "Intervalo do atendente";
    case "ocupado":
      return "Horário ocupado";
    case undefined:
      return undefined;
    default:
      return reason;
  }
}