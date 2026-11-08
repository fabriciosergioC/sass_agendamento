/**
 * Endereço interno do backend sass estetica.
 *
 * Regra de ouro deste projeto: o navegador do cliente NUNCA fala direto com o
 * backend. Todo request vem para este frontend (porta 3000) e é resolvido aqui:
 *
 *   celular --> túnel ngrok (:3000) --> Next (este processo) --> http://localhost:3001
 *
 * Consequências práticas:
 *  - Só precisa de UM túnel ngrok (o do frontend). O backend fica só em localhost.
 *  - Não precisa de CORS, e o backend não pode estar exposto publicamente.
 *  - Se um dia o backend for uma URL pública (ngrok do backend), o plano free do
 *    ngrok responde a página de aviso ERR_NGROK_6024 no lugar do JSON, e o parse
 *    quebra com "Unexpected end of JSON input". Evitar esse caminho.
 *
 * Server-only: importado só por componentes de servidor e pelo next.config.ts.
 */
export const BACKEND_URL = (
  process.env.BACKEND_URL || "http://localhost:3001"
).replace(/\/+$/, "");
