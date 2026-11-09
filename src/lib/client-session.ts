/**
 * Sessão do cliente no app de agendamento.
 *
 * O portal do cliente (backend) assina um JWT no cookie `sb_client_session`.
 * As rotas /api/client-session/* deste app apenas REPASSAM esse cookie para o
 * backend, então o navegador continua falando só com a Vercel e não precisamos
 * duplicar o segredo de assinatura por aqui.
 *
 * Este arquivo é isomórfico (client + server): só contém nomes/constantes e
 * helpers de localStorage/cookie, sem segredos nem acesso à rede.
 */

/** Cookie HttpOnly com o JWT de sessão do portal (o mesmo nome usado no backend). */
export const SESSION_COOKIE = "sb_client_session";

/** Cookie legível pelo JS só para lembrar de qual clínica é a sessão. */
export const CLINIC_COOKIE = "agendamento_clinic";

export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias, igual ao backend

export const SLUG_KEY = "agendamento:slug";
export const CLINIC_NAME_KEY = "agendamento:clinica";
export const PHONE_KEY = "agendamento:telefone";

/**
 * Clínica da SESSÃO ativa (a que autenticou o WhatsApp). É diferente da clínica
 * "lembrada para agendar": o cliente pode agendar em outra clínica sem trocar a
 * sessão, e aí /me continua consultando a clínica certa.
 */
export const SESSION_SLUG_KEY = "agendamento:sessao_slug";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Lembra a clínica escolhida no login (slug + nome amigável). */
export function saveClinic(slug: string, name?: string | null): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(SLUG_KEY, slug);
    if (name) store.setItem(CLINIC_NAME_KEY, name);
  } catch {}
}

/** Lembra o WhatsApp do cliente para pré-preencher o login na próxima visita. */
export function savePhone(phone: string): void {
  try {
    storage()?.setItem(PHONE_KEY, phone);
  } catch {}
}

/** Grava a clínica da sessão autenticada (só depois de um login bem-sucedido). */
export function saveSessionClinic(slug: string): void {
  try {
    storage()?.setItem(SESSION_SLUG_KEY, slug);
  } catch {}
}

export function forgetSessionClinic(): void {
  try {
    storage()?.removeItem(SESSION_SLUG_KEY);
  } catch {}
}

/** Remove a clínica lembrada (mantém o telefone). */
export function forgetClinic(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(SLUG_KEY);
    store.removeItem(CLINIC_NAME_KEY);
  } catch {}
}

/** Limpa tudo o que foi lembrado no aparelho (usado no "Sair"). */
export function clearClientStorage(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(SLUG_KEY);
    store.removeItem(CLINIC_NAME_KEY);
    store.removeItem(PHONE_KEY);
    store.removeItem(SESSION_SLUG_KEY);
  } catch {}
}

export function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  try {
    const prefix = `${name}=`;
    for (const part of document.cookie.split(";")) {
      const value = part.trim();
      if (value.startsWith(prefix)) return decodeURIComponent(value.slice(prefix.length));
    }
  } catch {}
  return "";
}

/**
 * Slug da clínica: prioriza o que o login gravou, caindo para o cookie simples
 * (útil quando o localStorage foi limpo, mas a sessão HttpOnly continua válida).
 */
export function readStoredSlug(): string {
  try {
    const stored = storage()?.getItem(SLUG_KEY);
    if (stored) return stored;
  } catch {}
  return readCookie(CLINIC_COOKIE);
}

/**
 * Clínica da sessão autenticada. Se ainda não houve login, cai para a clínica
 * lembrada (que serve só para pré-preencher o formulário).
 */
export function readSessionSlug(): string {
  try {
    const stored = storage()?.getItem(SESSION_SLUG_KEY);
    if (stored) return stored;
  } catch {}
  return readCookie(CLINIC_COOKIE);
}

export function readStoredClinicName(): string {
  try {
    return storage()?.getItem(CLINIC_NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function readStoredPhone(): string {
  try {
    return storage()?.getItem(PHONE_KEY) ?? "";
  } catch {
    return "";
  }
}
