"use client";

import useSWR from "swr";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { yen } from "@/lib/format";

type Sales = {
  from: string; to: string;
  total_orders: number; total_revenue_cents: number;
  by_day: { date: string; revenue_cents: number }[];
};

export default function AdminDashboardPage() {
  const { user, token } = useAuth();
  const { data } = useSWR<Sales>(
    user?.role === "admin" ? "admin-sales" : null,
    () => api<Sales>("/admin/dashboard/sales", { auth: token })
  );

  if (!user) return <p className="card p-6 text-sm text-coffee-500">ログインが必要です。</p>;
  if (user.role !== "admin") return <p className="card p-6 text-sm text-coffee-500">権限がありません。</p>;
  if (!data) return <p className="text-coffee-500 animate-pulse-soft">読み込み中…</p>;

  const max = Math.max(1, ...data.by_day.map((d) => d.revenue_cents));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <p className="text-sm text-coffee-500 mt-1">{data.from} 〜 {data.to}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-5 relative overflow-hidden">
          <div aria-hidden className="absolute right-3 top-3 text-3xl opacity-15">📦</div>
          <div className="text-xs font-medium text-coffee-500">注文数</div>
          <div className="text-3xl font-bold mt-1 tabular-nums">{data.total_orders}</div>
        </div>
        <div className="card p-5 relative overflow-hidden">
          <div aria-hidden className="absolute right-3 top-3 text-3xl opacity-15">💰</div>
          <div className="text-xs font-medium text-coffee-500">売上</div>
          <div className="text-3xl font-bold mt-1 tabular-nums">{yen(data.total_revenue_cents)}</div>
        </div>
      </div>
      <section className="card p-5">
        <h2 className="font-semibold mb-4">日次売上</h2>
        <div className="space-y-2">
          {data.by_day.map((d) => (
            <div key={d.date} className="flex items-center gap-3 text-sm">
              <span className="w-24 text-coffee-500 shrink-0">{d.date}</span>
              <div className="flex-1 h-2.5 bg-coffee-50 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-coffee-500 to-caramel transition-all" style={{ width: `${(d.revenue_cents / max) * 100}%` }} />
              </div>
              <span className="w-24 text-right tabular-nums">{yen(d.revenue_cents)}</span>
            </div>
          ))}
          {data.by_day.length === 0 && <p className="text-sm text-coffee-500">データがありません</p>}
        </div>
      </section>
    </div>
  );
}
