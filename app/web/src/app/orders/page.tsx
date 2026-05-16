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

  if (!token) return <p>ログインが必要です。</p>;
  if (!orders) return <p>読み込み中…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">注文履歴</h1>
      {orders.length === 0 && <p className="text-sm text-coffee-500">まだ注文はありません</p>}
      <ul className="space-y-2">
        {orders.map((o) => (
          <li key={o.id} className="bg-white border rounded p-4 flex justify-between items-center">
            <div>
              <Link href={`/orders/${o.id}`} className="font-medium hover:underline">#{o.id}</Link>
              <div className="text-xs text-coffee-500">{fmtDate(o.placed_at)} · {o.status}</div>
            </div>
            <div className="font-semibold">{yen(o.total_cents)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
