import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";
import {
  CLINIC_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "@/lib/client-session";

/**
 * Ponte server-side com o portal do cliente do backend.
 *
 * O navegador nunca fala direto com o Railway: ele chama /api/client-session/*
 * na Vercel, que repassa o cookie `sb_client_session` (JWT assinado no backend)
 * nas chamadas. Assim não duplicamos o segredo da sessão aqui.
 *
 * Server-only: importa BACKEND_URL, que não deve ir para o bundle do cliente.
 */

const TIMEOUT_MS = 10_000;

function isSecure(): boolean {
  return process.env.NODE_ENV === "production";
}

/** fetch para o portal do cliente, opcionalmente autenticado pelo cookie repassado. */
export function portalFetch(
  path: string,
  init: RequestInit & { sessionToken?: string | null } = {}
): Promise<Response> {
  const { sessionToken, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("Accept", "application/json");
  if (sessionToken) headers.set("Cookie", `${SESSION_COOKIE}=${sessionToken}`);

  return fetch(`${BACKEND_URL}${path}`, {
    ...rest,
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/** Lê o valor do cookie de sessão devolvido pelo backend no login. */
export function readSessionToken(res: Response): string | null {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const getSetCookie = headers.getSetCookie;
  const raw = getSetCookie
    ? getSetCookie.call(headers)
    : res.headers.get("set-cookie")
    ? [res.headers.get("set-cookie") as string]
    : [];

  for (const cookie of raw) {
    const pair = cookie.split(";")[0] ?? "";
    const eq = pair.indexOf("=");
    if (eq > 0 && pair.slice(0, eq).trim() === SESSION_COOKIE) {
      return pair.slice(eq + 1).trim() || null;
    }
  }
  return null;
}

/** Grava no navegador o JWT repassado + o slug da clínica (esse legível pelo JS). */
export function setSessionCookies(res: NextResponse, token: string, slug: string): void {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure(),
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  res.cookies.set(CLINIC_COOKIE, slug, {
    httpOnly: false,
    sameSite: "lax",
    secure: isSecure(),
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.delete(SESSION_COOKIE);
}

export function clearAllSessionCookies(res: NextResponse): void {
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.delete(CLINIC_COOKIE);
}

export type CurrentClient = {
  org: { name: string; slug: string; primaryColor?: string | null };
  cliente: { name: string; phone: string };
};

/**
 * Cliente logado da requisição atual (Server Component), ou null se não há
 * sessão válida. Consulta o /me do backend com o cookie repassado, então só
 * devolve dados depois que a conta foi autenticada de fato.
 */
export async function getCurrentClient(): Promise<CurrentClient | null> {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    const slug = store.get(CLINIC_COOKIE)?.value;
    if (!token || !slug) return null;

    const res = await portalFetch(
      `/api/cliente-portal/${encodeURIComponent(slug)}/me`,
      { sessionToken: token }
    );
    if (!res.ok) return null;

    const data = (await res.json().catch(() => null)) as CurrentClient | null;
    return data?.org && data?.cliente ? data : null;
  } catch {
    return null;
  }
}
