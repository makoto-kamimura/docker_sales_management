"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtDate, yen } from "@/lib/format";
import { LoadError } from "@/components/LoadError";
import { TipActions } from "@/components/TipActions";
import { TipStatusBadge } from "@/components/TipBox";
import type { AdminTipList } from "@/lib/adminTypes";

// 投げ銭 (注文権限): 0円販売の注文に届いた投げ銭の入金確認・取り消し
export default function AdminTipsPage() {
  const { token } = useAuth();
  const [status, setStatus] = useState("pending");
  const { data, error, mutate } = useSWR<AdminTipList>(
    token ? ["admin-tips", status] : null,
    () => api<AdminTipList>(`/admin/tips?per=100${status ? `&status=${status}` : ""}`, { auth: token })
  );
  const [err, setErr] = useState<string | null>(null);

  if (error && !data) return <LoadError error={error} onRetry={() => mutate()} />;
  if (!data) return <p className="text-coffee-500 animate-pulse-soft">読み込み中…</p>;
  const { summary, tips } = data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">投げ銭</h1>
          <p className="mt-1 text-sm text-coffee-500">
            0円で販売した商品を含む注文に届いた投げ銭です。振込などの入金を確認したら「入金確認」にしてください。
          </p>
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="状態で絞り込み" className="input !w-auto">
          <option value="pending">入金待ち</option>
          <option value="paid">入金確認済み</option>
          <option value="cancelled">取り消し</option>
          <option value="">すべて</option>
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card p-4">
          <div className="text-xs text-coffee-500">入金待ち</div>
          <div className="mt-1 text-xl font-bold tabular-nums">{yen(summary.pending_cents)} <span className="text-sm font-normal text-coffee-500">{summary.pending_count} 件</span></div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-coffee-500">入金確認済み (累計)</div>
          <div className="mt-1 text-xl font-bold tabular-nums">{yen(summary.paid_cents)} <span className="text-sm font-normal text-coffee-500">{summary.paid_count} 件</span></div>
        </div>
      </div>

      {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="bg-coffee-50 text-xs uppercase tracking-wide text-coffee-500">
            <tr>
              <th className="p-3 text-left font-semibold">日時</th>
              <th className="p-3 text-left font-semibold">注文 / 購入者</th>
              <th className="p-3 text-right font-semibold">金額</th>
              <th className="p-3 text-left font-semibold">メッセージ</th>
              <th className="p-3 text-left font-semibold">状態</th>
              <th className="p-3 text-right font-semibold">操作</th>
            </tr>
          </thead>
          <tbody>
            {tips.map((t) => (
              <tr key={t.id} className="border-t border-coffee-100 align-top">
                <td className="whitespace-nowrap p-3 text-coffee-600">{fmtDate(t.created_at)}</td>
                <td className="p-3">
                  <Link href={`/admin/orders/${t.order_id}`} className="font-medium text-caramel hover:underline">注文 #{t.order_id}</Link>
                  <div className="text-xs text-coffee-500">
                    <Link href={`/admin/customers/${t.user.id}`} className="hover:text-caramel">{t.user.name}</Link> · {t.user.email}
                  </div>
                </td>
                <td className="p-3 text-right font-semibold tabular-nums">{yen(t.amount_cents)}</td>
                <td className="max-w-[18rem] whitespace-pre-line p-3 text-xs text-coffee-600">{t.message || "—"}</td>
                <td className="p-3">
                  <TipStatusBadge tip={t} />
                  {t.confirmed_by && <div className="mt-1 text-[11px] text-coffee-400">{t.confirmed_by.name}{t.paid_at && ` · ${fmtDate(t.paid_at)}`}</div>}
                </td>
                <td className="p-3">
                  <TipActions tip={t} token={token} onDone={() => { setErr(null); mutate(); }} onError={setErr} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tips.length === 0 && <p className="p-8 text-center text-sm text-coffee-500">該当する投げ銭はありません</p>}
      </div>
    </div>
  );
}
