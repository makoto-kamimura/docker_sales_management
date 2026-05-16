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

  if (!user) return <p>ログインが必要です。</p>;
  if (user.role !== "admin") return <p>権限がありません。</p>;

  async function setStatusOf(id: number, newStatus: string) {
    await api(`/admin/orders/${id}`, { method: "PATCH", body: jsonBody({ status: newStatus }), auth: token });
    mutate();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">販売管理 / 注文一覧</h1>
      <div className="flex gap-2 items-center text-sm">
        <span>ステータス:</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border px-2 py-1">
          <option value="">すべて</option>
          {["pending", "paid", "shipped", "delivered", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <table className="w-full bg-white border rounded-xl overflow-hidden text-sm">
        <thead className="bg-coffee-50">
          <tr>
            <th className="p-2 text-left">#</th>
            <th className="p-2 text-left">顧客</th>
            <th className="p-2 text-left">日時</th>
            <th className="p-2 text-right">金額</th>
            <th className="p-2">ステータス</th>
            <th className="p-2">操作</th>
          </tr>
        </thead>
        <tbody>
          {orders?.map((o) => (
            <tr key={o.id} className="border-t">
              <td className="p-2"><Link className="underline" href={`/orders/${o.id}`}>#{o.id}</Link></td>
              <td className="p-2">{o.user.name}<div className="text-xs text-coffee-500">{o.user.email}</div></td>
              <td className="p-2">{fmtDate(o.placed_at)}</td>
              <td className="p-2 text-right">{yen(o.total_cents)}</td>
              <td className="p-2 text-center">{o.status}</td>
              <td className="p-2">
                <select defaultValue={o.status} onChange={(e) => setStatusOf(o.id, e.target.value)}
                        className="rounded border px-2 py-1 text-xs">
                  {["pending", "paid", "shipped", "delivered", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
