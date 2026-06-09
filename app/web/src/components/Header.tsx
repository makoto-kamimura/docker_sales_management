"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";

export function Header() {
  const { user, logout } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-coffee-900/30 bg-espresso/90 text-coffee-50 backdrop-blur-md supports-[backdrop-filter]:bg-espresso/75 shadow-soft">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-6">
        <Link
          href="/"
          className="font-bold text-lg tracking-wide flex items-center gap-2 transition-transform hover:scale-[1.03]"
        >
          <span aria-hidden className="text-xl">☕</span>
          <span className="bg-gradient-to-r from-coffee-50 to-caramel bg-clip-text text-transparent">
            docker_ruby
          </span>
        </Link>
        <nav className="hidden md:flex gap-1 text-sm">
          <NavLink href="/search">商品検索</NavLink>
          <NavLink href="/cart">カート</NavLink>
          <NavLink href="/orders">注文履歴</NavLink>
          <NavLink href="/subscriptions">サブスク</NavLink>
          {user?.role === "admin" && (
            <>
              <span className="self-center mx-1 h-4 w-px bg-coffee-50/20" />
              <NavLink href="/admin/orders" accent>販売管理</NavLink>
              <NavLink href="/admin/products" accent>商品管理</NavLink>
              <NavLink href="/admin/dashboard" accent>ダッシュボード</NavLink>
            </>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {user ? (
            <>
              <Link
                href="/account"
                className="flex items-center gap-2 rounded-full px-2 py-1 hover:bg-white/10 transition-colors"
              >
                <span className="grid place-items-center h-7 w-7 rounded-full bg-caramel/90 text-white text-xs font-bold">
                  {user.name?.slice(0, 1) || "?"}
                </span>
                <span className="hidden sm:inline">{user.name}</span>
              </Link>
              <button
                onClick={logout}
                className="text-coffee-200 hover:text-caramel transition-colors text-xs"
              >
                ログアウト
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-caramel transition-colors">
                ログイン
              </Link>
              <Link href="/register" className="btn btn-accent !py-1.5 !px-4">
                登録
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  children,
  accent,
}: {
  href: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 transition-colors hover:bg-white/10 ${
        accent ? "text-caramel hover:text-caramel" : "hover:text-caramel"
      }`}
    >
      {children}
    </Link>
  );
}
