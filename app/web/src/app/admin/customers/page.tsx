"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { yen, fmtDate } from "@/lib/format";
import type { Customer } from "@/lib/adminTypes";

export default function CustomersPage() {
  const { token } = useAuth();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const { data: customers } = useSWR<Customer[]>(
    token ? ["customers", query, sort] : null,
    () => api<Customer[]>(`/admin/customers?per=50&sort=${sort}${query ? `&q=${encodeURIComponent(query)}` : ""}`, { auth: token })
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">顧客管理</h1>
        <form onSubmit={(e) => { e.preventDefault(); setQuery(q); }} className="flex items-end gap-2 text-sm">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="名前・メールで検索" className="input !w-56" />
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="input !w-auto" aria-label="並び順">
            <option value="recent">最近の購入順</option>
            <option value="spent">購入金額順</option>
            <option value="orders">購入回数順</option>
          </select>
          <button className="btn btn-primary">検索</button>
        </form>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[44rem]">
          <thead className="bg-coffee-50 text-xs uppercase tracking-wide text-coffee-500">
            <tr>
              <th className="p-3 text-left font-semibold">顧客</th>
              <th className="p-3 text-right font-semibold">購入回数</th>
              <th className="p-3 text-right font-semibold">購入金額</th>
              <th className="p-3 text-left font-semibold">最終注文</th>
              <th className="p-3 text-left font-semibold">未対応の問い合わせ</th>
            </tr>
          </thead>
          <tbody>
            {customers?.map((c) => (
              <tr key={c.id} className="border-t border-coffee-100 hover:bg-coffee-50/40 transition-colors">
                <td className="p-3">
                  <Link href={`/admin/customers/${c.id}`} className="font-medium text-caramel hover:underline">{c.name}</Link>
                  <div className="text-xs text-coffee-400">{c.email}</div>
                </td>
                <td className="p-3 text-right tabular-nums">{c.orders_count}</td>
                <td className="p-3 text-right tabular-nums font-semibold">{yen(c.total_spent_cents)}</td>
                <td className="p-3 text-coffee-600">{c.last_order_at ? fmtDate(c.last_order_at) : "—"}</td>
                <td className="p-3">{c.open_requests_count > 0 ? <span className="badge badge-accent">{c.open_requests_count} 件</span> : <span className="text-coffee-300">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers && customers.length === 0 && <p className="p-8 text-center text-sm text-coffee-500">該当する顧客はいません</p>}
      </div>
    </div>
  );
}
