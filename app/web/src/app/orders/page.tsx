"use client";

import Link from "next/link";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { yen, fmtDate } from "@/lib/format";
import type { Order } from "@/lib/types";

export default function OrdersPage() {
  const { token } = useAuth();
  const { data: orders } = useSWR<Order[]>(token ? "orders" : null, () => api<Order[]>("/orders", { auth: token }));

  if (!token) return <p className="card p-6 text-sm text-coffee-500">ログインが必要です。</p>;
  if (!orders) return <p className="text-coffee-500 animate-pulse-soft">読み込み中…</p>;

  return (
    <div className="space-y-5 max-w-3xl">
      <h1 className="text-2xl font-bold">注文履歴</h1>
      {orders.length === 0 && (
        <div className="card p-10 text-center text-sm text-coffee-500">まだ注文はありません</div>
      )}
      <ul className="space-y-3">
        {orders.map((o) => (
          <li key={o.id} className="card card-interactive p-4 flex justify-between items-center">
            <div>
              <Link href={`/orders/${o.id}`} className="font-semibold hover:text-caramel transition-colors">注文 #{o.id}</Link>
              <div className="text-xs text-coffee-500 mt-1 flex items-center gap-2">
                <span>{fmtDate(o.placed_at)}</span>
                <span className={`badge ${statusBadge(o.status)}`}>{o.status}</span>
              </div>
            </div>
            <div className="font-bold text-lg tabular-nums">{yen(o.total_cents)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function statusBadge(status: string) {
  if (["delivered", "paid", "shipped"].includes(status)) return "badge-success";
  if (status === "cancelled") return "badge-muted";
  return "badge-accent";
}
