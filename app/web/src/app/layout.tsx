import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { Header } from "@/components/Header";
import { ChatWidget } from "@/components/ChatWidget";

export const metadata: Metadata = {
  title: "ROUTE & ROAST — Riders Cafe",
  description: "コーヒーと、走るための全部。豆・パーツ・整備・ナビを揃えるライダーズカフェ。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body
        className="antialiased min-h-screen text-coffee-800 flex flex-col"
        suppressHydrationWarning
      >
        <AuthProvider>
          <Header />
          <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-8 sm:py-10">
            <div className="animate-in">{children}</div>
          </main>
          <footer className="mt-16 border-t border-coffee-200">
            <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-coffee-500">
              <span className="flex items-center gap-2 font-semibold tracking-wide text-coffee-800">
                <span aria-hidden className="text-caramel">●</span> ROUTE &amp; ROAST
                <span className="font-normal text-coffee-400">Riders Cafe</span>
              </span>
              <span className="tracking-wide">COFFEE · PARTS · MAINTENANCE · SYSTEM · © {new Date().getFullYear()}</span>
            </div>
          </footer>
          <ChatWidget />
        </AuthProvider>
      </body>
    </html>
  );
}
