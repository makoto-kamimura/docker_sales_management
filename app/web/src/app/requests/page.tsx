"use client";

import Link from "next/link";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { yen, fmtDate } from "@/lib/format";
import { REQUEST_KIND_LABEL, REQUEST_STATUS_LABEL, requestStatusBadge } from "@/lib/orderStatus";
import { LoadError } from "@/components/LoadError";
import type { ServiceRequest } from "@/lib/types";

export default function RequestsPage() {
  const { token } = useAuth();
  const { data: reqs, error, mutate } = useSWR<ServiceRequest[]>(
    token ? "service_requests" : null,
    () => api<ServiceRequest[]>("/service_requests", { auth: token })
  );

  if (!token) return <p className="card p-6 text-sm text-coffee-500">ログインが必要です。</p>;
  if (error && !reqs) return <LoadError error={error} onRetry={() => mutate()} />;
  if (!reqs) return <p className="text-coffee-500 animate-pulse-soft">読み込み中…</p>;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">問い合わせ・依頼</h1>
        <div className="flex gap-4 text-sm">
          <Link href="/contact" className="text-coffee-800 hover:text-caramel transition-colors">問い合わせる →</Link>
          <Link href="/custom" className="text-coffee-800 hover:text-caramel transition-colors">オーダーメイドを依頼 →</Link>
        </div>
      </div>

      {reqs.length === 0 && (
        <div className="card p-10 text-center text-sm text-coffee-500">
          まだ問い合わせはありません。作品や納期のご質問、オーダーメイドのご相談はこちらから。
        </div>
      )}

      <ul className="space-y-3">
        {reqs.map((r) => (
          <li key={r.id} className="card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-caramel">
                  {REQUEST_KIND_LABEL[r.kind] ?? r.kind}
                </span>
                <span className={`badge ${requestStatusBadge(r.status)}`}>{REQUEST_STATUS_LABEL[r.status] ?? r.status}</span>
              </div>
              <span className="text-xs text-coffee-400">{fmtDate(r.created_at)}</span>
            </div>
            {r.subject && <div className="mt-2 text-sm font-semibold">{r.subject}</div>}
            <p className="mt-1 text-sm text-coffee-700 whitespace-pre-line line-clamp-3">{r.body}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-coffee-500">
              {r.order_id && <Link href={`/orders/${r.order_id}`} className="hover:text-caramel">注文 #{r.order_id}</Link>}
              {r.product && <span>メニュー: {r.product.name}</span>}
              {r.preferred_at && <span>希望納期: {fmtDate(r.preferred_at)}</span>}
              {r.budget_cents != null && <span>予算: {yen(r.budget_cents)}</span>}
            </div>
            {r.reply && (
              <div className="mt-3 rounded-lg border border-coffee-100 bg-coffee-50 p-3 text-sm">
                <div className="text-xs font-semibold text-coffee-500 mb-1">
                  ショップからの回答{r.replied_at ? `（${fmtDate(r.replied_at)}）` : ""}
                </div>
                <p className="whitespace-pre-line text-coffee-800">{r.reply}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
