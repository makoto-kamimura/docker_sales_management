"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { adminGroupsFor } from "@/lib/permissions";

// CraftFlow の管理画面: 付与された権限 (販売 / 制作 / 注文) のメニューだけを出す
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (loading) return <p className="text-coffee-500 animate-pulse-soft">読み込み中…</p>;
  if (!user) return <p className="card p-6 text-sm text-coffee-500">ログインが必要です。</p>;
  if (user.role !== "admin" && user.role !== "staff") {
    return <p className="card p-6 text-sm text-coffee-500">権限がありません。</p>;
  }

  const groups = adminGroupsFor(user);
  if (groups.length === 0) {
    return <p className="card p-6 text-sm text-coffee-500">管理画面の権限が割り当てられていません。管理者に権限の付与を依頼してください。</p>;
  }
  const allowed = pathname === "/admin" || groups.some((g) => g.links.some((l) => pathname.startsWith(l.href)));

  return (
    <div className="space-y-6">
      <nav aria-label="管理メニュー" className="flex flex-wrap gap-x-6 gap-y-3 border-b border-coffee-200 pb-3">
        {groups.map((g) => (
          <div key={g.label} className="flex items-center gap-1">
            <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.2em] text-coffee-400">{g.label}</span>
            {g.links.map((l) => {
              const active = pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    active ? "bg-espresso text-coffee-50" : "text-coffee-700 hover:bg-coffee-100"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      {allowed ? children : <p className="card p-6 text-sm text-coffee-500">この画面を利用する権限がありません。</p>}
    </div>
  );
}
