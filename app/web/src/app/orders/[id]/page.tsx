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

  if (!token) return <p>ログインが必要です。</p>;
  if (!o) return <p>読み込み中…</p>;

  return (
    <article className="bg-white border rounded-xl p-6 space-y-4 max-w-2xl">
      <header>
        <h1 className="text-xl font-bold">注文 #{o.id}</h1>
        <p className="text-sm text-coffee-500">{fmtDate(o.placed_at)} · ステータス: <strong>{o.status}</strong></p>
      </header>

      <table className="w-full text-sm">
        <tbody>
          {o.items?.map((i) => (
            <tr key={i.product_id} className="border-t">
              <td className="py-2">{i.name} × {i.quantity}</td>
              <td className="py-2 text-right">{yen(i.line_total_cents)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t text-sm">
          <tr><td className="py-1">小計</td><td className="py-1 text-right">{yen(o.subtotal_cents ?? 0)}</td></tr>
          <tr><td className="py-1">消費税</td><td className="py-1 text-right">{yen(o.tax_cents ?? 0)}</td></tr>
          <tr><td className="py-1">送料</td><td className="py-1 text-right">{yen(o.shipping_cents ?? 0)}</td></tr>
          <tr><td className="py-1 font-bold">合計</td><td className="py-1 text-right font-bold">{yen(o.total_cents)}</td></tr>
        </tfoot>
      </table>

      {o.shipment && (
        <section className="text-sm border rounded p-3 bg-coffee-50">
          配送: {o.shipment.status}{o.shipment.carrier ? ` / ${o.shipment.carrier}` : ""}
          {o.shipment.tracking_number ? ` (${o.shipment.tracking_number})` : ""}
        </section>
      )}
    </article>
  );
}
