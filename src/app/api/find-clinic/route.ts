import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";

/**
 * POST /api/find-clinic — { phone }
 *
 * Ponte server-side para a busca de clínica por telefone. O navegador nunca fala
 * direto com o backend (evita CORS); esta rota repassa a consulta e devolve só a
 * lista de clínicas encontradas.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { phone?: unknown };
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";

  if (phone.length < 10) {
    return NextResponse.json({ error: "Telefone inválido. Inclua DDD." }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${BACKEND_URL}/api/cliente-portal/find-clinic?phone=${encodeURIComponent(phone)}`,
      { cache: "no-store", signal: AbortSignal.timeout(8000) }
    );
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível consultar as clínicas agora. Tente novamente." },
      { status: 502 }
    );
  }
}
