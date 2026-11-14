import { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import BookingWizard from "@/components/BookingWizard";
import { ThemeMenu } from "@/components/theme";
import { BACKEND_URL } from "@/lib/backend";
import { getCurrentClient } from "@/lib/client-portal";
import { CLINIC_COOKIE } from "@/lib/client-session";

/**
 * Clínica usada quando o endereço não diz qual abrir. O app nasceu como o PWA
 * da Bela Face, então esse continua sendo o padrão para quem entra pela raiz.
 */
const DEFAULT_CLINIC_SLUG = "bela-face";

/**
 * Clínica do agendamento: o link (`/?clinica=bela-essencia`) manda mais que a
 * clínica lembrada no aparelho pelo login. Antes o slug era fixo em "bela-face",
 * então o Instagram cadastrado nas Configurações de outra clínica nunca aparecia.
 */
async function resolveClinicSlug(searchParams: Promise<{ clinica?: string }>): Promise<string> {
  const { clinica } = await searchParams;
  // Só slug simples entra na URL do backend; qualquer outra coisa cai no padrão.
  const fromLink = clinica?.trim().toLowerCase();
  if (fromLink && /^[a-z0-9-]+$/.test(fromLink)) return fromLink;

  const store = await cookies();
  const remembered = store.get(CLINIC_COOKIE)?.value?.trim().toLowerCase();
  if (remembered && /^[a-z0-9-]+$/.test(remembered)) return remembered;
  return DEFAULT_CLINIC_SLUG;
}

async function getOrgConfig(slug: string) {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/public/${encodeURIComponent(slug)}/config`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.org;
  } catch {
    return null;
  }
}

async function BookingWizardLoader({
  searchParams,
}: {
  searchParams: Promise<{ clinica?: string }>;
}) {
  const slug = await resolveClinicSlug(searchParams);
  const org = await getOrgConfig(slug);

  if (!org) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-red-600">Erro ao carregar organização</h1>
          <p className="text-sm text-gray-600 mt-2">
            O backend não respondeu em {BACKEND_URL} para a clínica <code>{slug}</code>.
            Rode <code>npm run dev</code> na pasta do sass estetica (porta 3001) e recarregue.
          </p>
        </div>
      </div>
    );
  }

  return <BookingWizard org={org} />;
}

const HEADER_LINK =
  "inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2.5 py-2 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface)] sm:text-sm";

/**
 * Cabeçalho da home. "Meus agendamentos" só aparece depois que o cliente entrou
 * na conta e o /me confirmou os dados; enquanto isso (ou para visitantes) fica
 * apenas a entrada "Minha conta".
 */
async function AccountHeader() {
  const me = await getCurrentClient();

  if (!me) {
    return (
      <div className="mx-auto max-w-md px-5 mb-4 flex items-center justify-between gap-2">
        <Link href="/meus-agendamentos" className={HEADER_LINK}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M20 21a8 8 0 0 0-16 0" strokeLinecap="round" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          Minha conta
        </Link>
        <ThemeMenu />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-5 mb-4 flex items-center justify-between gap-2">
      <Link href="/meus-agendamentos" className={HEADER_LINK}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 11h18" strokeLinecap="round" />
        </svg>
        Meus agendamentos
      </Link>
      <div className="flex min-w-0 items-center gap-1">
        <span className="hidden max-w-[110px] truncate text-xs text-[var(--color-text-secondary)] sm:inline">
          Olá, {me.cliente.name.split(" ")[0]}
        </span>
        <ThemeMenu />
      </div>
    </div>
  );
}

function GuestHeader() {
  return (
    <div className="mx-auto max-w-md px-5 mb-4 flex items-center justify-between gap-2">
      <Link href="/meus-agendamentos" className={HEADER_LINK}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M20 21a8 8 0 0 0-16 0" strokeLinecap="round" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        Minha conta
      </Link>
      <ThemeMenu />
    </div>
  );
}

export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ clinica?: string }>;
}) {
  return (
    <main className="min-h-screen bg-[var(--color-background)] py-8 text-[var(--color-text-primary)]">
      <Suspense fallback={<GuestHeader />}>
        <AccountHeader />
      </Suspense>
      <Suspense fallback={
        <div className="flex min-h-screen items-center justify-center p-4">
          <p className="text-sm text-[var(--color-text-secondary)]">Carregando...</p>
        </div>
      }>
        <BookingWizardLoader searchParams={searchParams} />
      </Suspense>
    </main>
  );
}