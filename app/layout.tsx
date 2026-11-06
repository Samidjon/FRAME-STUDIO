import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Providers } from "@/components/shared/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-face", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Senitukang Studio — Create your own Senitukang poster", template: "%s · Senitukang Studio" },
  description:
    "A professional online graphic design studio: Swiss grids, editable templates, an algorithmic composition generator and high-resolution export.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F0EDE5" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
};

// Apply the stored theme before paint to avoid a flash.
const themeScript = `try{var s=JSON.parse(localStorage.getItem('frame-ui')||'{}').state||{};var t=s.theme||'light';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';if(s.accent)document.documentElement.style.setProperty('--accent',s.accent)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${inter.variable} ${grotesk.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body className="min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
