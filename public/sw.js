// Service worker do PWA Bela Face.
//
// Ele existe para o navegador tratar o site como aplicativo instalável. Nada aqui é
// guardado em cache: agenda, horários disponíveis e dados da clínica têm de vir do
// servidor em toda visita (decisão do dono: "nada em offline"). Sem cache, também não
// existe o risco clássico de service worker = cliente vendo uma versão velha da página.
//
// Se um dia quiser cache de verdade: cacheie só arquivos versionados de /_next/static
// e NUNCA /api/ nem as páginas, que carregam horários e disponibilidade.

self.addEventListener("install", () => {
  // assume o controle já na primeira visita em vez de esperar o próximo reload
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // apaga qualquer cache deixado por uma versão anterior deste arquivo
      const chaves = await caches.keys();
      await Promise.all(chaves.map((chave) => caches.delete(chave)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // POST/PUT etc. têm efeito no servidor: passam direto, sem interferência
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // recursos de outra origem (fontes do Google, imagens externas) não são nosso negócio
  if (url.origin !== self.location.origin) return;

  // Pass-through puro: sempre rede, nunca cache. O handler de fetch existir já é o que
  // falta para o Chrome considerar a página instalável. Se a rede falhar, o navegador
  // mostra a própria página de erro - é o comportamento escolhido: nada de servir uma
  // agenda velha para o cliente achar que ainda tem horário livre.
  event.respondWith(fetch(request, { cache: "no-store" }));
});
