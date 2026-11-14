import { ClientPortal } from "@/components/ClientPortal";

/**
 * Portal do cliente. A tela inicial do app é o "Minha conta" (raiz `/`),
 * então esta rota mantém o endereço antigo funcionando (links já enviados).
 */
export default function MeusAgendamentosPage() {
  return <ClientPortal />;
}
