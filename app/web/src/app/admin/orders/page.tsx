"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api, jsonBody } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { yen, fmtDate } from "@/lib/format";

type AdminOrder = {
  id: number; status: string; total_cents: number; currency: string; placed_at: string;
  user: { id: number; email: string; name: string };
};

export default function AdminOrdersPage() {
  const { user, token } = useAuth();
  const [status, setStatus] = useState("");
  const { data: orders, mutate } = useSWR<AdminOrder[]>(
    user?.role === "admin" ? ["admin-orders", status] : null,
    () => api<AdminOrder[]>(`/admin/orders${status ? `?status=${status}` : ""}`, { auth: token })
  );

  if (!user) return <p className="card p-6 text-sm text-coffee-500">ログインが必要です。</p>;
  if (user.role !== "admin") return <p className="card p-6 text-sm text-coffee-500">権限がありません。</p>;

  async function setStatusOf(id: number, newStatus: string) {
    await api(`/admin/orders/${id}`, { method: "PATCH", body: jsonBody({ status: newStatus }), auth: token });
    mutate();
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">販売管理 <span className="text-coffee-400 font-normal">/ 注文一覧</span></h1>
      <div className="flex gap-2 items-center text-sm">
        <span className="field-label !mb-0">ステータス</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input !w-auto">
          <option value="">すべて</option>
          {["pending", "paid", "shipped", "delivered", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[40rem]">
          <thead className="bg-coffee-50 text-xs uppercase tracking-wide text-coffee-500">
            <tr>
              <th className="p-3 text-left font-semibold">#</th>
              <th className="p-3 text-left font-semibold">顧客</th>
              <th className="p-3 text-left font-semibold">日時</th>
              <th className="p-3 text-right font-semibold">金額</th>
              <th className="p-3 font-semibold">ステータス</th>
              <th className="p-3 font-semibold">操作</th>
            </tr>
          </thead>
          <tbody>
            {orders?.map((o) => (
              <tr key={o.id} className="border-t border-coffee-100 hover:bg-coffee-50/40 transition-colors">
                <td className="p-3"><Link className="font-medium text-caramel hover:underline" href={`/orders/${o.id}`}>#{o.id}</Link></td>
                <td className="p-3">{o.user.name}<div className="text-xs text-coffee-400">{o.user.email}</div></td>
                <td className="p-3 text-coffee-600">{fmtDate(o.placed_at)}</td>
                <td className="p-3 text-right font-semibold tabular-nums">{yen(o.total_cents)}</td>
                <td className="p-3 text-center"><span className="badge badge-accent">{o.status}</span></td>
                <td className="p-3">
                  <select defaultValue={o.status} onChange={(e) => setStatusOf(o.id, e.target.value)}
                          className="input !w-auto !py-1 !text-xs">
                    {["pending", "paid", "shipped", "delivered", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
