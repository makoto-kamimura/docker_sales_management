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
        className="antialiased min-h-screen bg-cream text-coffee-800"
        suppressHydrationWarning
      >
        <AuthProvider>
          <Header />
          <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
          <ChatWidget />
        </AuthProvider>
      </body>
    </html>
  );
}
