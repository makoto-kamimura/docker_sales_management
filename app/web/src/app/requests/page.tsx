"use client";

import Link from "next/link";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { yen, fmtDate } from "@/lib/format";
import type { ServiceRequest } from "@/lib/types";

const KIND_LABEL: Record<string, string> = { maintenance: "整備予約", system: "開発依頼" };

const STATUS_LABEL: Record<string, string> = {
  pending: "受付待ち",
  confirmed: "予約確定",
  quoted: "見積提示",
  in_progress: "対応中",
  completed: "完了",
  cancelled: "キャンセル",
};

function statusBadge(status: string) {
  if (["completed", "confirmed"].includes(status)) return "badge-success";
  if (status === "cancelled") return "badge-muted";
  return "badge-accent";
}

export default function RequestsPage() {
  const { token } = useAuth();
  const { data: reqs } = useSWR<ServiceRequest[]>(
    token ? "service_requests" : null,
    () => api<ServiceRequest[]>("/service_requests", { auth: token })
  );

  if (!token) return <p className="card p-6 text-sm text-coffee-500">ログインが必要です。</p>;
  if (!reqs) return <p className="text-coffee-500 animate-pulse-soft">読み込み中…</p>;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">依頼状況</h1>
        <div className="flex gap-2 text-sm">
          <Link href="/maintenance" className="text-coffee-800 hover:text-caramel transition-colors">整備予約 →</Link>
          <Link href="/system" className="text-coffee-800 hover:text-caramel transition-colors">開発依頼 →</Link>
        </div>
      </div>

      {reqs.length === 0 && (
        <div className="card p-10 text-center text-sm text-coffee-500">
          まだ依頼はありません。整備の予約やシステムの開発依頼はこちらから。
        </div>
      )}

      <ul className="space-y-3">
        {reqs.map((r) => (
          <li key={r.id} className="card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-caramel">
                  {KIND_LABEL[r.kind] ?? r.kind}
                </span>
                <span className={`badge ${statusBadge(r.status)}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
              </div>
              <span className="text-xs text-coffee-400">{fmtDate(r.created_at)}</span>
            </div>
            {r.product && <div className="mt-2 text-sm font-semibold">{r.product.name}</div>}
            <p className="mt-1 text-sm text-coffee-700 whitespace-pre-line line-clamp-3">{r.body}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-coffee-500">
              {r.vehicle && <span>車種: {r.vehicle}</span>}
              {r.preferred_at && <span>希望日時: {fmtDate(r.preferred_at)}</span>}
              {r.budget_cents != null && <span>予算: {yen(r.budget_cents)}</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
