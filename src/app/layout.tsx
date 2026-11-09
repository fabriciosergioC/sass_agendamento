import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { InstallPwa } from "@/components/InstallPwa";
import { bootstrapScript } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // ... (mantém o objeto original)
  // Disable sharing image by providing empty image arrays
  openGraph: { title: "Agendamento", description: "Agende seu horário direto pelo celular.", type: "website", images: [] },
  twitter: { card: "summary", images: [] },
  // Título genérico: o site serve várias clínicas. O nome de cada uma entra via
  // generateMetadata nas páginas /login?clinica={slug} (Vercel) e /b|/c/{slug} (Railway).
  title: "Agendamento",
  description: "Agende seu horário direto pelo celular.",
  applicationName: "Agendamento",
  // Ícone da instalação e da aba. Atenção: um arquivo app/favicon.ico seria
  // injetado automaticamente pelo Next e teria prioridade sobre estes links,
  // por isso ele continua fora do projeto.
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  // iOS não usa o manifest para o "Adicionar à Tela de Início": estas três linhas são
  // o que faz o app abrir em janela própria, com o nome e a barra de status certos.
  appleWebApp: {
    capable: true,
    title: "Agendamento",
    statusBarStyle: "black-translucent",
  },
  // O Next 16 traduz `capable` para a tag moderna <meta name="mobile-web-app-capable">.
  // iPhone com iOS anterior a 16.4 só obedece à tag antiga, então ela vai junto.
  // (No Next 16 `other` é um objeto chave=valor, não o array antigo de {name, content}.)
  other: {
    "apple-mobile-web-app-capable": "yes",
  },

};

// themeColor e width/initialScale viviam dentro de metadata; no Next 16 isso é
// deprecado e o export precisa ser separado (e só em Server Component).
// Docs: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-viewport.md
export const viewport: Viewport = {
  themeColor: "#d4a24e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <script
          dangerouslySetInnerHTML={{
            __html: `${bootstrapScript()}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
        <ServiceWorkerRegister />
        <InstallPwa />
      </body>
    </html>
  );
}
