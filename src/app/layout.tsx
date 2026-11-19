import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ICC BFC Finances", template: "%s · ICC BFC Finances" },
  description: "Gestion financière des églises Impact Centre Chrétien — Bourgogne-Franche-Comté",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "ICC Finances", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#6D28D9",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('icc-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body>
        {children}
        <Toaster position="top-center" richColors closeButton toastOptions={{ style: { borderRadius: 14, fontFamily: "var(--font-geist-sans)" } }} />
      </body>
    </html>
  );
}
