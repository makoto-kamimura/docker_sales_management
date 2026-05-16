"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";

export function Header() {
  const { user, logout } = useAuth();
  return (
    <header className="bg-espresso text-coffee-50 border-b border-coffee-900 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
        <Link href="/" className="font-bold text-lg tracking-wide flex items-center gap-2">
          <span aria-hidden>☕</span>docker_ruby
        </Link>
        <nav className="flex gap-4 text-sm">
          <Link href="/search" className="hover:text-caramel transition-colors">商品検索</Link>
          <Link href="/cart" className="hover:text-caramel transition-colors">カート</Link>
          <Link href="/orders" className="hover:text-caramel transition-colors">注文履歴</Link>
          <Link href="/subscriptions" className="hover:text-caramel transition-colors">サブスク</Link>
          {user?.role === "admin" && (
            <>
              <span className="text-coffee-400">|</span>
              <Link href="/admin/orders" className="text-caramel hover:underline">販売管理</Link>
              <Link href="/admin/products" className="text-caramel hover:underline">商品管理</Link>
              <Link href="/admin/dashboard" className="text-caramel hover:underline">ダッシュボード</Link>
            </>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {user ? (
            <>
              <Link href="/account" className="hover:text-caramel transition-colors">{user.name}</Link>
              <button onClick={logout} className="text-coffee-200 hover:text-caramel underline">ログアウト</button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-caramel transition-colors">ログイン</Link>
              <Link href="/register" className="rounded bg-caramel hover:bg-coffee-500 text-white px-3 py-1 font-medium transition-colors">
                登録
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
