import { Suspense } from "react";
import BookingWizard from "@/components/BookingWizard";
import { ThemeMenu } from "@/components/theme";
import { BACKEND_URL } from "@/lib/backend";

async function getOrgConfig() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/public/bela-face/config`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.org;
  } catch {
    return null;
  }
}

async function BookingWizardLoader() {
  const org = await getOrgConfig();

  if (!org) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-red-600">Erro ao carregar organização</h1>
          <p className="text-sm text-gray-600 mt-2">
            O backend não respondeu em {BACKEND_URL}. Rode <code>npm run dev</code> na pasta
            do sass barbearia (porta 3001) e recarregue.
          </p>
        </div>
      </div>
    );
  }

  return <BookingWizard org={org} />;
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--color-background)] py-8 text-[var(--color-text-primary)]">
      <div className="mx-auto max-w-md px-5 flex justify-end mb-4">
        <ThemeMenu />
      </div>
      <Suspense fallback={
        <div className="flex min-h-screen items-center justify-center p-4">
          <p className="text-sm text-[var(--color-text-secondary)]">Carregando...</p>
        </div>
      }>
        <BookingWizardLoader />
      </Suspense>
    </main>
  );
}