import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { Header } from "@/components/Header";
import { ChatWidget } from "@/components/ChatWidget";

export const metadata: Metadata = {
  title: "CraftFlow — つくる人のネットショップ",
  description: "3Dプリント・ハンドメイド作品の販売から、制作状況の見える化・顧客管理まで。つくる人のためのネットショップ。",
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
                <span aria-hidden className="text-caramel">●</span> CraftFlow
                <span className="font-normal text-coffee-400">つくる人のネットショップ</span>
              </span>
              <span className="tracking-wide">3D PRINT · HANDMADE · MATERIALS · CUSTOM ORDER · © {new Date().getFullYear()}</span>
            </div>
          </footer>
          <ChatWidget />
        </AuthProvider>
      </body>
    </html>
  );
}
