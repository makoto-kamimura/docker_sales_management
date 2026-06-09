import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { Header } from "@/components/Header";
import { ChatWidget } from "@/components/ChatWidget";

export const metadata: Metadata = {
  title: "docker_ruby ストア",
  description: "EC + サブスク + AI接客",
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
          <footer className="mt-12 border-t border-coffee-200/60">
            <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-coffee-500">
              <span className="flex items-center gap-2">
                <span aria-hidden>☕</span> docker_ruby ストア
              </span>
              <span>EC + サブスク + AI接客 · © {new Date().getFullYear()}</span>
            </div>
          </footer>
          <ChatWidget />
        </AuthProvider>
      </body>
    </html>
  );
}
