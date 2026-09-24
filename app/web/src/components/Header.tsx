"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { adminHome } from "@/lib/permissions";

export function Header() {
  const { user, logout } = useAuth();
  const adminHref = adminHome(user);
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-espresso/95 text-coffee-50 backdrop-blur-md supports-[backdrop-filter]:bg-espresso/80">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3 sm:gap-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-caramel" />
          <span className="flex flex-col leading-none">
            <span className="font-bold text-base tracking-[0.04em]">CraftFlow</span>
            <span className="hidden sm:block whitespace-nowrap text-[10px] font-medium tracking-[0.2em] text-coffee-400">
              つくる人のネットショップ
            </span>
          </span>
        </Link>
        {/* 項目が入りきらない幅では折り返さず横スクロール */}
        <nav className="hidden md:flex min-w-0 gap-0.5 overflow-x-auto text-sm">
          <NavLink href="/search">商品を探す</NavLink>
          <NavLink href="/3d">3Dプリント</NavLink>
          <NavLink href="/custom">オーダーメイド</NavLink>
          <NavLink href="/cart">カート</NavLink>
          <NavLink href="/orders">注文履歴</NavLink>
          <NavLink href="/requests">問い合わせ</NavLink>
          <NavLink href="/subscriptions">サブスク</NavLink>
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3 whitespace-nowrap text-sm">
          {adminHref && (
            // 管理画面の中は権限 (販売 / 制作 / 注文) ごとのサブナビで切り替える
            <NavLink href={adminHref} accent>管理画面</NavLink>
          )}
          {user ? (
            <>
              <Link
                href="/account"
                className="flex items-center gap-2 rounded-full px-2 py-1 hover:bg-white/10 transition-colors"
              >
                <span className="grid place-items-center h-7 w-7 rounded-full bg-caramel/90 text-white text-xs font-bold">
                  {user.name?.slice(0, 1) || "?"}
                </span>
                <span className="hidden sm:inline max-w-[8rem] truncate">{user.name}</span>
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
      className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 transition-colors hover:bg-white/10 ${
        accent ? "text-caramel hover:text-caramel" : "hover:text-caramel"
      }`}
    >
      {children}
    </Link>
  );
}
