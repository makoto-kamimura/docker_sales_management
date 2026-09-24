"use client";

import { use, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api, jsonBody } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { yen, fmtDate } from "@/lib/format";
import { ORDER_FLOW, ORDER_STATUS_LABEL, orderStatusBadge, type OrderStatus } from "@/lib/orderStatus";
import { OrderProgress } from "@/components/OrderProgress";
import { TipActions } from "@/components/TipActions";
import { TipStatusBadge } from "@/components/TipBox";
import type { OrderDetail, StaffUser } from "@/lib/adminTypes";

export default function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token } = useAuth();
  const { data: o, mutate } = useSWR<OrderDetail>(token ? `admin-order-${id}` : null,
    () => api<OrderDetail>(`/admin/orders/${id}`, { auth: token }));
  const { data: staff } = useSWR<StaffUser[]>(token ? "admin-staff" : null,
    () => api<StaffUser[]>("/admin/staff", { auth: token }));
  const [next, setNext] = useState<OrderStatus | "">("");
  const [note, setNote] = useState("");
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [tipErr, setTipErr] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setErr(null);
    try {
      await api(`/admin/orders/${id}`, { method: "PATCH", body: jsonBody(body), auth: token });
      mutate();
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "更新に失敗しました");
      return false;
    }
  }

  if (!o) return <p className="text-coffee-500 animate-pulse-soft">読み込み中…</p>;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-5 min-w-0">
        <section className="card p-6 space-y-5">
          <header className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <Link href="/admin/orders" className="text-xs text-coffee-500 hover:text-caramel">← 注文管理</Link>
              <h1 className="text-2xl font-bold mt-1">注文 #{o.id}</h1>
              <p className="text-sm text-coffee-500 mt-1">
                {fmtDate(o.placed_at)} · <Link href={`/admin/customers/${o.user.id}`} className="hover:text-caramel">{o.user.name}</Link>
              </p>
            </div>
            <span className={`badge ${orderStatusBadge(o.status)}`}>{o.status_label}</span>
          </header>
          <OrderProgress status={o.status} physical={!o.digital_only} events={o.events.filter((e) => e.from_status !== e.status)} />
        </section>

        <section className="card p-6">
          <h2 className="font-semibold mb-3">明細</h2>
          <table className="w-full text-sm">
            <tbody>
              {o.items.map((i) => (
                <tr key={i.product_id} className="border-t border-coffee-100">
                  <td className="py-2">{i.is_digital && "⬇ "}{i.name} <span className="text-coffee-400">{i.sku} × {i.quantity}</span></td>
                  <td className="py-2 text-right tabular-nums">{yen(i.line_total_cents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-coffee-100">
              <tr><td className="pt-2 text-coffee-500">小計 / 税 / 送料</td><td className="pt-2 text-right tabular-nums">{yen(o.subtotal_cents)} / {yen(o.tax_cents)} / {yen(o.shipping_cents)}</td></tr>
              <tr><td className="py-1 font-bold">合計</td><td className="py-1 text-right font-bold tabular-nums">{yen(o.total_cents)}</td></tr>
            </tfoot>
          </table>
        </section>

        {(o.accepts_tips || o.tips.length > 0) && (
          <section className="card p-6">
            <h2 className="font-semibold mb-1">投げ銭</h2>
            <p className="mb-3 text-xs text-coffee-500">0円の商品を含む注文のため、購入者は注文詳細から投げ銭できます。入金を確認したら「入金確認」にしてください。</p>
            {tipErr && <p role="alert" className="mb-2 text-sm text-rose-600">{tipErr}</p>}
            {o.tips.length === 0 ? (
              <p className="text-sm text-coffee-400">まだ投げ銭はありません</p>
            ) : (
              <ul className="divide-y divide-coffee-100 text-sm">
                {o.tips.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-start gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold tabular-nums">{yen(t.amount_cents)}</span>
                        <TipStatusBadge tip={t} />
                        <span className="text-xs text-coffee-400">{fmtDate(t.created_at)}{t.confirmed_by && ` · ${t.confirmed_by.name}`}</span>
                      </div>
                      {t.message && <p className="mt-0.5 whitespace-pre-line text-xs text-coffee-600">{t.message}</p>}
                    </div>
                    <TipActions tip={t} token={token} onDone={() => { setTipErr(null); mutate(); }} onError={setTipErr} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="card p-6">
          <h2 className="font-semibold mb-3">履歴</h2>
          <ol className="space-y-2.5 border-l border-coffee-200 pl-4">
            {o.events.map((e, i) => (
              <li key={i} className="relative text-sm">
                <span aria-hidden className="absolute -left-[1.3rem] top-1.5 h-2 w-2 rounded-full bg-caramel" />
                <span className="font-medium">
                  {e.from_status === e.status ? e.note : (e.from_status ? `${ORDER_STATUS_LABEL[e.from_status as OrderStatus]} → ` : "") + e.status_label}
                </span>
                <span className="ml-2 text-xs text-coffee-400">{fmtDate(e.created_at)} · {e.actor?.name ?? "システム"}</span>
                {e.note && e.from_status !== e.status && <div className="text-xs text-coffee-500">{e.note}</div>}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <aside className="space-y-5">
        <section className="card p-5 space-y-3 text-sm">
          <h2 className="font-semibold">ステータス変更</h2>
          <select value={next} onChange={(e) => setNext(e.target.value as OrderStatus)} className="input">
            <option value="">選択してください</option>
            {[...ORDER_FLOW, "cancelled" as const].filter((s) => s !== o.status).map((s) => (
              <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>
            ))}
          </select>
          {next === "shipped" && (
            <>
              <input value={carrier} onChange={(e) => setCarrier(e.target.value)} className="input" placeholder="配送業者" />
              <input value={tracking} onChange={(e) => setTracking(e.target.value)} className="input" placeholder="追跡番号" />
            </>
          )}
          <input value={note} onChange={(e) => setNote(e.target.value)} className="input" placeholder="メモ (任意)" />
          <button
            disabled={!next}
            onClick={async () => {
              if (next === "cancelled" && !confirm(`注文 #${o.id} をキャンセルします。元に戻せません。よろしいですか？`)) return;
              if (await patch({ status: next, note, carrier, tracking_number: tracking })) { setNext(""); setNote(""); }
            }}
            className="btn btn-primary w-full"
          >
            変更する
          </button>
          {err && <p className="text-rose-600">{err}</p>}
        </section>

        <section className="card p-5 space-y-3 text-sm">
          <h2 className="font-semibold">制作</h2>
          <label className="block">
            <span className="field-label">製作担当</span>
            <select value={o.assignee?.id ?? ""} onChange={(e) => patch({ assignee_id: e.target.value || null })} className="input">
              <option value="">未割り当て</option>
              {staff?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="field-label">納期</span>
            <input type="date" defaultValue={o.due_on ?? ""} key={o.due_on ?? ""}
                   onBlur={(e) => { if (e.target.value !== (o.due_on ?? "")) patch({ due_on: e.target.value || null }); }}
                   className="input" />
          </label>
          <p className="text-xs text-coffee-500">
            材料: {o.materials_consumed_at ? `消費済み (${fmtDate(o.materials_consumed_at)})` : "未消費 (「制作中」に移すとレシピに従って消費)"}
          </p>
        </section>

        {o.address && (
          <section className="card p-5 text-sm">
            <h2 className="font-semibold mb-2">配送先</h2>
            <p>{o.address.recipient}</p>
            <p className="text-coffee-600">〒{o.address.postal_code} {o.address.prefecture}{o.address.city}{o.address.line1}{o.address.line2 ?? ""}</p>
            {o.shipment && (
              <p className="mt-2 text-xs text-coffee-500">
                配送: {({ preparing: "準備中", shipped: "発送済み", delivered: "配達完了" } as Record<string, string>)[o.shipment.status] ?? o.shipment.status}{o.shipment.carrier ? ` / ${o.shipment.carrier}` : ""}{o.shipment.tracking_number ? ` (${o.shipment.tracking_number})` : ""}
              </p>
            )}
          </section>
        )}
      </aside>
    </div>
  );
}
