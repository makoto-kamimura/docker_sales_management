"use client";

import { use, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api, jsonBody } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { yen, fmtDate } from "@/lib/format";
import { orderStatusBadge, REQUEST_KIND_LABEL, REQUEST_STATUS_LABEL, requestStatusBadge } from "@/lib/orderStatus";
import type { CustomerDetail } from "@/lib/adminTypes";

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token } = useAuth();
  const { data: c, mutate } = useSWR<CustomerDetail>(token ? `customer-${id}` : null,
    () => api<CustomerDetail>(`/admin/customers/${id}`, { auth: token }));
  const [note, setNote] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!c) return <p className="text-coffee-500 animate-pulse-soft">読み込み中…</p>;

  async function saveNote() {
    await api(`/admin/customers/${id}`, { method: "PATCH", body: jsonBody({ admin_note: note ?? "" }), auth: token });
    setSaved(true);
    mutate();
  }

  return (
    <div className="space-y-5">
      <section className="card p-6">
        <Link href="/admin/customers" className="text-xs text-coffee-500 hover:text-caramel">← 顧客管理</Link>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-espresso text-lg font-bold text-coffee-50">{c.name.slice(0, 1)}</span>
          <div>
            <h1 className="text-xl font-bold">{c.name}</h1>
            <p className="text-sm text-coffee-500">{c.email} · 会員登録 {fmtDate(c.created_at)}</p>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat label="購入回数" value={`${c.orders_count} 回`} />
          <Stat label="購入金額" value={yen(c.total_spent_cents)} />
          <Stat label="最終注文" value={c.last_order_at ? fmtDate(c.last_order_at).split(" ")[0] : "—"} />
          <Stat label="未対応の問い合わせ" value={`${c.open_requests_count} 件`} />
        </dl>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <section className="card p-6 min-w-0">
          <h2 className="font-semibold mb-3">購入履歴</h2>
          {c.orders.length === 0 && <p className="text-sm text-coffee-500">まだ注文はありません</p>}
          <ul className="divide-y divide-coffee-100">
            {c.orders.map((o) => (
              <li key={o.id} className="flex items-center gap-3 py-2.5 text-sm">
                <Link href={`/admin/orders/${o.id}`} className="font-medium text-caramel hover:underline">#{o.id}</Link>
                <span className="text-xs text-coffee-400 w-24 shrink-0">{fmtDate(o.placed_at).split(" ")[0]}</span>
                <span className="flex-1 truncate text-coffee-700">{o.items.map((i) => `${i.name}×${i.quantity}`).join("、")}</span>
                <span className={`badge ${orderStatusBadge(o.status)}`}>{o.status_label}</span>
                <span className="w-20 text-right tabular-nums font-semibold">{yen(o.total_cents)}</span>
              </li>
            ))}
          </ul>
        </section>

        <aside className="space-y-5 min-w-0">
          <section className="card p-5 text-sm space-y-2">
            <h2 className="font-semibold">顧客メモ <span className="text-xs font-normal text-coffee-400">(店舗のみ閲覧)</span></h2>
            <textarea value={note ?? c.admin_note} onChange={(e) => { setNote(e.target.value); setSaved(false); }}
                      className="input min-h-[6rem]" placeholder="好み・注意事項など" />
            <div className="flex items-center justify-end gap-3">
              {saved && <span className="text-xs text-emerald-700">保存しました</span>}
              <button onClick={saveNote} disabled={note === null} className="btn btn-primary">保存</button>
            </div>
          </section>

          {c.top_products.length > 0 && (
            <section className="card p-5 text-sm">
              <h2 className="font-semibold mb-2">よく買う商品</h2>
              <ol className="space-y-1">
                {c.top_products.map((p) => (
                  <li key={p.product_id} className="flex min-w-0 justify-between gap-2">
                    <span className="min-w-0 truncate">{p.name}</span><span className="shrink-0 whitespace-nowrap tabular-nums text-coffee-500">{p.quantity} 点</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="card p-5 text-sm">
            <h2 className="font-semibold mb-2">問い合わせ</h2>
            {c.requests.length === 0 && <p className="text-coffee-500">なし</p>}
            <ul className="space-y-2">
              {c.requests.map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/requests?user_id=${c.id}`} className="font-medium hover:text-caramel">{r.subject || REQUEST_KIND_LABEL[r.kind]}</Link>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-coffee-500">
                    <span>{REQUEST_KIND_LABEL[r.kind]}</span>
                    <span className={`badge ${requestStatusBadge(r.status)}`}>{REQUEST_STATUS_LABEL[r.status] ?? r.status}</span>
                    <span>{fmtDate(r.created_at).split(" ")[0]}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {c.addresses.length > 0 && (
            <section className="card p-5 text-sm">
              <h2 className="font-semibold mb-2">住所</h2>
              {c.addresses.map((a) => (
                <p key={a.id} className="text-coffee-600">{a.recipient} 〒{a.postal_code} {a.prefecture}{a.city}{a.line1}</p>
              ))}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-coffee-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-bold">{value}</dd>
    </div>
  );
}
