"use client";

import { use, useState } from "react";
import useSWR from "swr";
import { api, downloadAssemblyGuide, downloadModel } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { OrderProgress } from "@/components/OrderProgress";
import { TipBox } from "@/components/TipBox";
import { yen, fmtDate } from "@/lib/format";
import { orderStatusBadge } from "@/lib/orderStatus";
import type { Order } from "@/lib/types";

const SHIPMENT_LABEL: Record<string, string> = { preparing: "準備中", shipped: "発送済み", delivered: "配達完了" };

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token } = useAuth();
  const { data: o, mutate } = useSWR<Order>(token ? `order-${id}` : null, () => api<Order>(`/orders/${id}`, { auth: token }));
  const [dlErr, setDlErr] = useState<string | null>(null);

  async function download(get: () => Promise<void>) {
    setDlErr(null);
    try {
      await get();
    } catch (e) {
      setDlErr(e instanceof Error ? e.message : "ダウンロードに失敗しました");
    }
  }

  if (!token) return <p className="card p-6 text-sm text-coffee-500">ログインが必要です。</p>;
  if (!o) return <p className="text-coffee-500 animate-pulse-soft">読み込み中…</p>;

  return (
    <article className="card p-6 space-y-5 max-w-3xl">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">注文 #{o.id}</h1>
          <p className="text-sm text-coffee-500 mt-1">{fmtDate(o.placed_at)}</p>
        </div>
        <span className={`badge ${orderStatusBadge(o.status)}`}>{o.status_label}</span>
      </header>

      <section className="space-y-2">
        <OrderProgress status={o.status} physical={o.physical ?? true} events={o.events} />
        {o.due_on && o.status !== "completed" && o.status !== "cancelled" && (
          <p className="text-xs text-coffee-500 text-center">発送予定日: {o.due_on}（目安）</p>
        )}
      </section>

      <table className="w-full text-sm">
        <tbody>
          {o.items?.map((i) => (
            <tr key={i.product_id} className="border-t border-coffee-100">
              <td className="py-2.5">
                {i.name} <span className="text-coffee-400">× {i.quantity}</span>
                {i.is_digital && (
                  o.downloadable ? (
                    <>
                      <button onClick={() => download(() => downloadModel(i.product_id, token))}
                              className="ml-3 text-xs font-medium text-caramel hover:underline">
                        ⬇ ダウンロード
                      </button>
                      {i.has_assembly && (
                        <button onClick={() => download(() => downloadAssemblyGuide(i.product_id, token))}
                                className="ml-3 text-xs font-medium text-caramel hover:underline">
                          📄 組み立て説明書 (PDF)
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="ml-3 text-xs text-coffee-400">お支払い確認後にダウンロードできます</span>
                  )
                )}
              </td>
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

      {dlErr && <p className="text-sm text-rose-600">{dlErr}</p>}

      {o.accepts_tips && <TipBox orderId={o.id} tips={o.tips ?? []} token={token} onChange={() => mutate()} />}

      <div className="text-right">
        <Link href={`/contact?order_id=${o.id}`} className="text-sm text-coffee-800 hover:text-caramel transition-colors">
          この注文について問い合わせる →
        </Link>
      </div>

      {o.shipment && (
        <section className="text-sm rounded-xl p-4 bg-coffee-50 border border-coffee-100 flex items-center gap-2">
          <span aria-hidden>🚚</span>
          <span>
            配送: {SHIPMENT_LABEL[o.shipment.status] ?? o.shipment.status}{o.shipment.carrier ? ` / ${o.shipment.carrier}` : ""}
            {o.shipment.tracking_number ? ` (${o.shipment.tracking_number})` : ""}
          </span>
        </section>
      )}
    </article>
  );
}
