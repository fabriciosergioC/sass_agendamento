import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, portalFetch } from "@/lib/client-portal";
import { SESSION_COOKIE } from "@/lib/client-session";

/**
 * POST /api/client-session/cancel — { slug, appointmentId }
 *
 * Cancela um agendamento futuro do próprio cliente. O backend só aceita o
 * cancelamento se o agendamento pertencer ao cliente da sessão.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    slug?: unknown;
    appointmentId?: unknown;
  };

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const appointmentId =
    typeof body.appointmentId === "string" ? body.appointmentId.trim() : "";
  const token = req.cookies.get(SESSION_COOKIE)?.value;

  if (!slug || !appointmentId) {
    return NextResponse.json(
      { error: "Agendamento inválido." },
      { status: 400 }
    );
  }
  if (!token) {
    return NextResponse.json(
      { error: "Sua sessão expirou. Entre novamente." },
      { status: 401 }
    );
  }

  try {
    const res = await portalFetch(
      `/api/cliente-portal/${encodeURIComponent(slug)}/appointments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", appointmentId }),
        sessionToken: token,
      }
    );

    const data = (await res.json().catch(() => ({}))) as { error?: string };
    const out = NextResponse.json(data, { status: res.status });
    if (res.status === 401) clearSessionCookie(out);
    return out;
  } catch {
    return NextResponse.json(
      { error: "Não foi possível cancelar agora. Tente novamente." },
      { status: 502 }
    );
  }
}
