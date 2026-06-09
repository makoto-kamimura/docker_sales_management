"use client";

import { use } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { yen, fmtDate } from "@/lib/format";
import type { Order } from "@/lib/types";

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token } = useAuth();
  const { data: o } = useSWR<Order>(token ? `order-${id}` : null, () => api<Order>(`/orders/${id}`, { auth: token }));

  if (!token) return <p className="card p-6 text-sm text-coffee-500">ログインが必要です。</p>;
  if (!o) return <p className="text-coffee-500 animate-pulse-soft">読み込み中…</p>;

  return (
    <article className="card p-6 space-y-5 max-w-2xl">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">注文 #{o.id}</h1>
          <p className="text-sm text-coffee-500 mt-1">{fmtDate(o.placed_at)}</p>
        </div>
        <span className="badge badge-accent">{o.status}</span>
      </header>

      <table className="w-full text-sm">
        <tbody>
          {o.items?.map((i) => (
            <tr key={i.product_id} className="border-t border-coffee-100">
              <td className="py-2.5">{i.name} <span className="text-coffee-400">× {i.quantity}</span></td>
              <td className="py-2.5 text-right tabular-nums">{yen(i.line_total_cents)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-coffee-100 text-sm">
          <tr><td className="py-1 pt-3 text-coffee-500">小計</td><td className="py-1 pt-3 text-right tabular-nums">{yen(o.subtotal_cents ?? 0)}</td></tr>
          <tr><td className="py-1 text-coffee-500">消費税</td><td className="py-1 text-right tabular-nums">{yen(o.tax_cents ?? 0)}</td></tr>
          <tr><td className="py-1 text-coffee-500">送料</td><td className="py-1 text-right tabular-nums">{yen(o.shipping_cents ?? 0)}</td></tr>
          <tr><td className="py-2 font-bold text-base">合計</td><td className="py-2 text-right font-bold text-base tabular-nums">{yen(o.total_cents)}</td></tr>
        </tfoot>
      </table>

      {o.shipment && (
        <section className="text-sm rounded-xl p-4 bg-coffee-50 border border-coffee-100 flex items-center gap-2">
          <span aria-hidden>🚚</span>
          <span>
            配送: {o.shipment.status}{o.shipment.carrier ? ` / ${o.shipment.carrier}` : ""}
            {o.shipment.tracking_number ? ` (${o.shipment.tracking_number})` : ""}
          </span>
        </section>
      )}
    </article>
  );
}
