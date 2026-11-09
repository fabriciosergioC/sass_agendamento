import { NextRequest, NextResponse } from "next/server";
import {
  portalFetch,
  readSessionToken,
  setSessionCookies,
} from "@/lib/client-portal";

/**
 * POST /api/client-session/login — { slug, phone }
 *
 * Valida o WhatsApp do cliente no portal do backend e repassa para este domínio
 * o cookie de sessão assinado lá (HttpOnly). O navegador não fala com o Railway.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    slug?: unknown;
    phone?: unknown;
  };

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";

  if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug)) {
    return NextResponse.json({ error: "Clínica inválida." }, { status: 400 });
  }
  if (phone.replace(/\D/g, "").length < 10) {
    return NextResponse.json(
      { error: "Informe seu WhatsApp com DDD." },
      { status: 400 }
    );
  }

  try {
    // Repassa o IP do cliente: o backend limita tentativas de login por IP e,
    // sem isso, todas as pessoas cairiam no IP de saída da Vercel.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

    const res = await portalFetch(
      `/api/cliente-portal/${encodeURIComponent(slug)}/auth`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(ip ? { "x-forwarded-for": ip } : {}),
        },
        body: JSON.stringify({ action: "login", phone }),
      }
    );

    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      cliente?: { name: string; phone: string };
    };

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error ?? "Não foi possível entrar. Confira o número." },
        { status: res.status }
      );
    }

    const token = readSessionToken(res);
    if (!token) {
      return NextResponse.json(
        { error: "O servidor não iniciou a sessão. Tente novamente." },
        { status: 502 }
      );
    }

    const out = NextResponse.json({ ok: true, cliente: data.cliente ?? null });
    setSessionCookies(out, token, slug);
    return out;
  } catch {
    return NextResponse.json(
      { error: "Não foi possível conectar agora. Tente novamente." },
      { status: 502 }
    );
  }
}
