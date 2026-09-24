"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { api, jsonBody } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { yen, fmtDate } from "@/lib/format";
import {
  REQUEST_KIND_LABEL, REQUEST_STATUSES, REQUEST_STATUS_LABEL, requestStatusBadge,
} from "@/lib/orderStatus";
import type { ServiceRequest } from "@/lib/types";

type AdminRequest = ServiceRequest & { user: { id: number; email: string; name: string } };

export default function AdminRequestsPage() {
  return (
    <Suspense fallback={<p className="text-coffee-500 animate-pulse-soft">読み込み中…</p>}>
      <AdminRequestsInner />
    </Suspense>
  );
}

function AdminRequestsInner() {
  const { token } = useAuth();
  const userId = useSearchParams().get("user_id") ?? ""; // 顧客詳細からの絞り込み
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");

  const query = new URLSearchParams();
  if (kind) query.set("kind", kind);
  if (status) query.set("status", status);
  if (userId) query.set("user_id", userId);

  const { data: reqs, mutate } = useSWR<AdminRequest[]>(
    token ? ["admin-requests", kind, status, userId] : null,
    () => api<AdminRequest[]>(`/admin/service_requests?${query.toString()}`, { auth: token })
  );

  async function patch(r: AdminRequest, body: Record<string, unknown>) {
    await api(`/admin/service_requests/${r.id}`, { method: "PATCH", body: jsonBody(body), auth: token });
    mutate();
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">問い合わせ <span className="text-coffee-400 font-normal">/ オーダーメイド依頼</span></h1>

      <div className="flex flex-wrap gap-4 items-end text-sm">
        <div>
          <span className="field-label">種別</span>
          <select value={kind} onChange={(e) => { setKind(e.target.value); setStatus(""); }} className="input !w-auto">
            <option value="">すべて</option>
            <option value="inquiry">問い合わせ</option>
            <option value="custom">オーダーメイド</option>
          </select>
        </div>
        <div>
          <span className="field-label">ステータス</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input !w-auto">
            <option value="">すべて</option>
            {(kind ? REQUEST_STATUSES[kind] : Array.from(new Set(Object.values(REQUEST_STATUSES).flat()))).map((s) => (
              <option key={s} value={s}>{REQUEST_STATUS_LABEL[s] ?? s}</option>
            ))}
          </select>
        </div>
        {userId && <Link href="/admin/requests" className="text-caramel hover:underline">顧客の絞り込みを解除</Link>}
      </div>

      {reqs && reqs.length === 0 && (
        <div className="card p-10 text-center text-sm text-coffee-500">該当する問い合わせはありません</div>
      )}

      <ul className="space-y-3">
        {reqs?.map((r) => <RequestItem key={r.id} r={r} onPatch={(body) => patch(r, body)} />)}
      </ul>
    </div>
  );
}

function RequestItem({ r, onPatch }: { r: AdminRequest; onPatch: (body: Record<string, unknown>) => Promise<void> }) {
  const [reply, setReply] = useState(r.reply);
  return (
    <li className="card p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-caramel">
            {REQUEST_KIND_LABEL[r.kind] ?? r.kind} #{r.id}
          </span>
          <span className={`badge ${requestStatusBadge(r.status)}`}>{REQUEST_STATUS_LABEL[r.status] ?? r.status}</span>
        </div>
        <span className="text-xs text-coffee-400">{fmtDate(r.created_at)}</span>
      </div>

      <div className="text-sm">
        <Link href={`/admin/customers/${r.user.id}`} className="font-semibold hover:text-caramel">{r.user.name}</Link>
        <span className="text-xs text-coffee-400 ml-2">{r.user.email}</span>
        {r.contact_phone && <span className="text-xs text-coffee-400 ml-2">TEL {r.contact_phone}</span>}
      </div>

      {r.subject && <div className="text-sm font-semibold">{r.subject}</div>}
      <p className="text-sm text-coffee-700 whitespace-pre-line">{r.body}</p>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-coffee-500">
        {r.order_id && <Link href={`/admin/orders/${r.order_id}`} className="text-caramel hover:underline">注文 #{r.order_id}</Link>}
        {r.product && <span>メニュー: {r.product.name}</span>}
        {r.preferred_at && <span>希望納期: {fmtDate(r.preferred_at)}</span>}
        {r.budget_cents != null && <span>予算: {yen(r.budget_cents)}</span>}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); onPatch({ reply }); }}
        className="space-y-2 border-t border-coffee-100 pt-3"
      >
        <label className="field-label" htmlFor={`reply-${r.id}`}>
          回答{r.replied_at && <span className="font-normal text-coffee-400">（{fmtDate(r.replied_at)} 送信済み）</span>}
        </label>
        <textarea id={`reply-${r.id}`} value={reply} onChange={(e) => setReply(e.target.value)}
                  className="input min-h-[4.5rem] text-sm" placeholder="お客様に表示される回答" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="field-label !mb-0">ステータス</span>
            <select value={r.status} onChange={(e) => onPatch({ status: e.target.value })} className="input !w-auto !py-1 !text-xs">
              {REQUEST_STATUSES[r.kind].map((s) => <option key={s} value={s}>{REQUEST_STATUS_LABEL[s] ?? s}</option>)}
            </select>
          </div>
          <button disabled={!reply.trim() || reply === r.reply} className="btn btn-primary !py-1.5">回答を送信</button>
        </div>
      </form>
    </li>
  );
}
