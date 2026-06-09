"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, jsonBody } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { yen, fmtDate } from "@/lib/format";

type AdminRequest = {
  id: number;
  kind: "maintenance" | "system";
  status: string;
  vehicle: string;
  preferred_at: string | null;
  budget_cents: number | null;
  body: string;
  contact_phone: string;
  created_at: string;
  user: { id: number; email: string; name: string };
  product: { id: number; sku: string; name: string } | null;
};

const STATUSES: Record<string, string[]> = {
  maintenance: ["pending", "confirmed", "completed", "cancelled"],
  system: ["pending", "quoted", "in_progress", "completed", "cancelled"],
};

const STATUS_LABEL: Record<string, string> = {
  pending: "受付待ち", confirmed: "予約確定", quoted: "見積提示",
  in_progress: "対応中", completed: "完了", cancelled: "キャンセル",
};

const KIND_LABEL: Record<string, string> = { maintenance: "整備予約", system: "開発依頼" };

export default function AdminRequestsPage() {
  const { user, token } = useAuth();
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");

  const query = new URLSearchParams();
  if (kind) query.set("kind", kind);
  if (status) query.set("status", status);

  const { data: reqs, mutate } = useSWR<AdminRequest[]>(
    user?.role === "admin" ? ["admin-requests", kind, status] : null,
    () => api<AdminRequest[]>(`/admin/service_requests?${query.toString()}`, { auth: token })
  );

  if (!user) return <p className="card p-6 text-sm text-coffee-500">ログインが必要です。</p>;
  if (user.role !== "admin") return <p className="card p-6 text-sm text-coffee-500">権限がありません。</p>;

  async function setStatusOf(r: AdminRequest, newStatus: string) {
    await api(`/admin/service_requests/${r.id}`, { method: "PATCH", body: jsonBody({ status: newStatus }), auth: token });
    mutate();
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">受付管理 <span className="text-coffee-400 font-normal">/ 整備・開発依頼</span></h1>

      <div className="flex flex-wrap gap-4 items-end text-sm">
        <div>
          <span className="field-label">種別</span>
          <select value={kind} onChange={(e) => { setKind(e.target.value); setStatus(""); }} className="input !w-auto">
            <option value="">すべて</option>
            <option value="maintenance">整備予約</option>
            <option value="system">開発依頼</option>
          </select>
        </div>
        <div>
          <span className="field-label">ステータス</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input !w-auto">
            <option value="">すべて</option>
            {(kind ? STATUSES[kind] : Array.from(new Set(Object.values(STATUSES).flat()))).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>
            ))}
          </select>
        </div>
      </div>

      {reqs && reqs.length === 0 && (
        <div className="card p-10 text-center text-sm text-coffee-500">該当する依頼はありません</div>
      )}

      <ul className="space-y-3">
        {reqs?.map((r) => (
          <li key={r.id} className="card p-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-caramel">
                  {KIND_LABEL[r.kind] ?? r.kind} #{r.id}
                </span>
                <span className="badge badge-accent">{STATUS_LABEL[r.status] ?? r.status}</span>
              </div>
              <span className="text-xs text-coffee-400">{fmtDate(r.created_at)}</span>
            </div>

            <div className="text-sm">
              <span className="font-semibold">{r.user.name}</span>
              <span className="text-xs text-coffee-400 ml-2">{r.user.email}</span>
              {r.contact_phone && <span className="text-xs text-coffee-400 ml-2">TEL {r.contact_phone}</span>}
            </div>

            {r.product && <div className="text-sm font-medium">対象: {r.product.name}</div>}
            <p className="text-sm text-coffee-700 whitespace-pre-line">{r.body}</p>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-coffee-500">
              {r.vehicle && <span>車種: {r.vehicle}</span>}
              {r.preferred_at && <span>希望日時: {fmtDate(r.preferred_at)}</span>}
              {r.budget_cents != null && <span>予算: {yen(r.budget_cents)}</span>}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <span className="field-label !mb-0">ステータス変更</span>
              <select value={r.status} onChange={(e) => setStatusOf(r, e.target.value)}
                      className="input !w-auto !py-1 !text-xs">
                {STATUSES[r.kind].map((s) => <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>)}
              </select>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
