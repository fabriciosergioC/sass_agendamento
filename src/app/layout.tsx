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
  // Disable sharing image by providing empty image arrays
  openGraph: { title: "Agendamento", description: "Agende seu horário direto pelo celular.", type: "website", images: [] },
  twitter: { card: "summary", images: [] },
  // Título genérico: o site serve várias clínicas. O nome de cada uma entra via
  // generateMetadata nas páginas /login?clinica={slug} (Vercel) e /b|/c/{slug} (Railway).
  title: "Agendamento",
  description: "Agende seu horário direto pelo celular.",
  applicationName: "Agendamento",
  // O <link rel="manifest"> vem do arquivo src/app/manifest.ts, injetado pelo Next.
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-icon.png",
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
        <script
          dangerouslySetInnerHTML={{
            __html: bootstrapScript(),
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
