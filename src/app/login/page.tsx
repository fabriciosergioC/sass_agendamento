import { Suspense } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { BACKEND_URL } from "@/lib/backend";

type SearchParams = Promise<{ clinica?: string }>;

type OrgInfo = { name: string; slug: string; description: string | null };

/** Dados públicos da clínica no backend (rota server-only, sem CORS). */
async function getOrg(slug: string): Promise<OrgInfo | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/public/${slug}/config`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { org?: OrgInfo };
    return data.org ?? null;
  } catch {
    return null;
  }
}

/**
 * /login?clinica=bela-face — link que a clínica envia aos clientes.
 * A guia do navegador e a prévia do WhatsApp mostram o nome daquela clínica
 * ("Bela Face - Agendamento", "Dellas - Agendamento"...). Sem o parâmetro,
 * a guia fica só "Agendamento" (a página serve várias clínicas, não só a Bela Face).
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  // Sempre usa título genérico, independentemente do parâmetro `clinica`
  const { clinica } = await searchParams;
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const base = host ? `${proto}://${host}` : "https://sass-agendamento-seven.vercel.app";
  const genericTitle = "Agendamento";
  const genericDescription = "Agende seu horário direto pelo celular.";

  return {
    metadataBase: new URL(base),
    title: { absolute: genericTitle },
    description: genericDescription,
    openGraph: {
      title: genericTitle,
      description: genericDescription,
      siteName: genericTitle,
      type: "website",
      url: `${base}/login${clinica ? `?clinica=${clinica}` : ""}`,
    },
    twitter: { card: "summary", title: genericTitle, description: genericDescription },
  };
}

/**
 * Com `cacheComponents`, o acesso a searchParams precisa ficar dentro de
 * <Suspense> para não bloquear o prerender do resto da rota (docs do Next 16).
 */
export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={null}>
      <LoginRoute searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginRoute({ searchParams }: { searchParams: SearchParams }) {
  const { clinica } = await searchParams;

  // Link já identifica a clínica: não pede o número de novo, vai direto ao agendamento
  // dela (mesmo comportamento de achar 1 clínica na busca).
  if (clinica) {
    const org = await getOrg(clinica);
    if (org) {
      redirect(`https://gestao-estetica.up.railway.app/b/${org.slug}`);
    }
  }

  return <LoginForm />;
}
