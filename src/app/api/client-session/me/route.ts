import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, portalFetch } from "@/lib/client-portal";
import { SESSION_COOKIE } from "@/lib/client-session";

/**
 * GET /api/client-session/me?slug={slug}
 *
 * Devolve cliente, próximos agendamentos e histórico do portal do cliente.
 * O cookie de sessão do backend é repassado pelo servidor.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug")?.trim() ?? "";
  const token = req.cookies.get(SESSION_COOKIE)?.value;

  if (!slug || !token) {
    return NextResponse.json(
      { error: "Entre com seu WhatsApp para ver seus agendamentos." },
      { status: 401 }
    );
  }

  try {
    const res = await portalFetch(
      `/api/cliente-portal/${encodeURIComponent(slug)}/me`,
      { sessionToken: token }
    );
    const data = await res.json().catch(() => ({}));
    const out = NextResponse.json(data, { status: res.status });
    if (res.status === 401) clearSessionCookie(out);
    return out;
  } catch {
    return NextResponse.json(
      { error: "Não foi possível carregar seus agendamentos agora." },
      { status: 502 }
    );
  }
}
