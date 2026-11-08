import type { MetadataRoute } from "next";

// O navegador lê esta rota (servida em /manifest.webmanifest, com o <link rel="manifest">
// injetado automaticamente pelo Next) para saber que o site é um aplicativo instalável:
// nome, cor e ícones que aparecem na tela inicial do celular.
//
// É uma rota ESTÁTICA: com cacheComponents o resultado é calculado uma vez e servido
// igual para todo mundo. Isso é o certo aqui, porque este frontend é de uma clínica só
// (Bela Face). Se um dia o mesmo código atender várias clínicas, o nome/ícone passam a
// depender da requisição, e aí este arquivo precisa usar uma API de tempo de requisição
// (params, headers, cookies) para deixar de ser cacheado.
// Docs: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/manifest.md
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Bela Face - Agendamento",
    // "Bela Face" é o que fica embaixo do ícone na tela inicial (limite prático ~12 chars)
    short_name: "Bela Face",
    description: "Agende seu horário na Bela Face direto pelo celular.",
    start_url: "/",
    scope: "/",
    // standalone = abre em janela própria, sem a barra do navegador: parece um app
    display: "standalone",
    lang: "pt-BR",
    dir: "ltr",
    // cor da tela de abertura (splash) enquanto a página carrega
    background_color: "#141210",
    // cor da barra de status / do app no seletor de janelas
    theme_color: "#d4a24e",
    categories: ["health", "beauty", "lifestyle"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // maskable = versão com fundo até a borda e marca reduzida, para o recorte
      // circular do Android/iOS launcher não cortar o anel nem deixar espaço vazio.
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
