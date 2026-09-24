"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { yen, fmtDate } from "@/lib/format";
import { ORDER_FLOW, ORDER_STATUS_LABEL, orderStatusBadge } from "@/lib/orderStatus";
import type { OrderCard } from "@/lib/adminTypes";

export default function AdminOrdersPage() {
  const { token } = useAuth();
  const [status, setStatus] = useState("");
  const { data: orders } = useSWR<OrderCard[]>(
    token ? ["admin-orders", status] : null,
    () => api<OrderCard[]>(`/admin/orders?per=50${status ? `&status=${status}` : ""}`, { auth: token })
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">注文管理</h1>
        <div className="flex gap-2 items-center text-sm">
          <span className="field-label !mb-0">ステータス</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input !w-auto">
            <option value="">すべて</option>
            {[...ORDER_FLOW, "cancelled" as const].map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}
          </select>
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[48rem]">
          <thead className="bg-coffee-50 text-xs uppercase tracking-wide text-coffee-500">
            <tr>
              <th className="p-3 text-left font-semibold">#</th>
              <th className="p-3 text-left font-semibold">顧客</th>
              <th className="p-3 text-left font-semibold">商品</th>
              <th className="p-3 text-left font-semibold">注文日時</th>
              <th className="p-3 text-right font-semibold">金額</th>
              <th className="p-3 font-semibold">ステータス</th>
              <th className="p-3 text-left font-semibold">担当 / 納期</th>
            </tr>
          </thead>
          <tbody>
            {orders?.map((o) => (
              <tr key={o.id} className="border-t border-coffee-100 hover:bg-coffee-50/40 transition-colors">
                <td className="p-3"><Link className="font-medium text-caramel hover:underline" href={`/admin/orders/${o.id}`}>#{o.id}</Link></td>
                <td className="p-3">
                  <Link href={`/admin/customers/${o.user.id}`} className="hover:text-caramel">{o.user.name}</Link>
                  <div className="text-xs text-coffee-400">{o.user.email}</div>
                </td>
                <td className="p-3 text-coffee-600 max-w-[14rem] truncate">
                  {o.items.map((i) => `${i.name}×${i.quantity}`).join("、")}
                </td>
                <td className="p-3 text-coffee-600">{fmtDate(o.placed_at)}</td>
                <td className="p-3 text-right font-semibold tabular-nums">{yen(o.total_cents)}</td>
                <td className="p-3 text-center"><span className={`badge ${orderStatusBadge(o.status)}`}>{o.status_label}</span></td>
                <td className="p-3 text-xs text-coffee-600">
                  {o.assignee?.name ?? <span className="text-coffee-300">未割り当て</span>}
                  {o.due_on && <div className={o.overdue ? "text-red-600 font-semibold" : ""}>{o.overdue ? "納期遅れ " : "納期 "}{o.due_on}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders && orders.length === 0 && <p className="p-8 text-center text-sm text-coffee-500">該当する注文はありません</p>}
      </div>
    </div>
  );
}
