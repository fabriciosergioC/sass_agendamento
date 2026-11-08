import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Em modo dev o Next bloqueia pedidos de origem diferente de localhost
  // (assets /_next/*, websocket de HMR e o resume do streaming). Sem isto, quem
  // abre o link do ngrok recebe o HTML pronto mas o React nao completa a
  // hidratacao: a pagina para em "Carregando servicos..." para sempre.
  // Doc: node_modules/next/dist/docs/.../allowedDevOrigins.md
  allowedDevOrigins: [
    '*.ngrok-free.dev',
    '**.ngrok-free.dev',
    // hostnames extra, separados por virgula, para testar de outro lugar
    ...(process.env.DEV_ORIGINS ? process.env.DEV_ORIGINS.split(',') : []),
  ],
  // O service worker é o único arquivo "instável" do app: se o navegador cacheá-lo,
  // a correção dele demora a chegar no celular de quem já instalou. Headers são
  // verificados antes dos arquivos de /public, então isto vale para public/sw.js.
  // Docs: node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          // escopo / (o arquivo está na raiz de /public, mas deixa explícito)
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  // Proxy público de agendamento para o backend sass-barbearia.
  // Redireciona /api/public/* para o backend local (porta 3001 por padrão),
  // então o navegador do cliente só conhece ESTE servidor. É isso que permite
  // publicar apenas um túnel ngrok (o do frontend) e manter o backend em localhost.
  // Sobrescreva com BACKEND_URL no .env.local se o backend mudar de porta/endereço.
  async rewrites() {
    const backendUrl = (process.env.BACKEND_URL || "http://localhost:3001").replace(/\/+$/, "");
    return [
      {
        source: '/api/public/:slug*',
        destination: `${backendUrl}/api/public/:slug*`,
      },
    ];
  },
};

export default nextConfig;
