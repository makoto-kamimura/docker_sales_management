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

  if (!user) return <p>ログインが必要です。</p>;
  if (user.role !== "admin") return <p>権限がありません。</p>;
  if (!data) return <p>読み込み中…</p>;

  const max = Math.max(1, ...data.by_day.map((d) => d.revenue_cents));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">ダッシュボード</h1>
      <p className="text-sm text-coffee-500">{data.from} ~ {data.to}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border rounded p-4">
          <div className="text-xs text-coffee-500">注文数</div>
          <div className="text-2xl font-bold">{data.total_orders}</div>
        </div>
        <div className="bg-white border rounded p-4">
          <div className="text-xs text-coffee-500">売上</div>
          <div className="text-2xl font-bold">{yen(data.total_revenue_cents)}</div>
        </div>
      </div>
      <section className="bg-white border rounded p-4">
        <h2 className="font-semibold mb-2">日次売上</h2>
        <div className="space-y-1">
          {data.by_day.map((d) => (
            <div key={d.date} className="flex items-center gap-2 text-sm">
              <span className="w-24 text-coffee-500">{d.date}</span>
              <div className="flex-1 h-3 bg-foam rounded">
                <div className="h-3 bg-espresso rounded" style={{ width: `${(d.revenue_cents / max) * 100}%` }} />
              </div>
              <span className="w-24 text-right">{yen(d.revenue_cents)}</span>
            </div>
          ))}
          {data.by_day.length === 0 && <p className="text-sm text-coffee-500">データがありません</p>}
        </div>
      </section>
    </div>
  );
}
