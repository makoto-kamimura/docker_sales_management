"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, jsonBody } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { yen } from "@/lib/format";
import type { Category, Product } from "@/lib/types";

export default function AdminProductsPage() {
  const { user, token } = useAuth();
  const { data: products, mutate } = useSWR<Product[]>(
    user?.role === "admin" ? "admin-products" : null,
    () => api<Product[]>("/admin/products", { auth: token })
  );
  const { data: categories } = useSWR<Category[]>(
    user?.role === "admin" ? "admin-cats" : null,
    () => api<Category[]>("/categories", { auth: token })
  );
  const [form, setForm] = useState({
    sku: "", name: "", description: "", price_cents: 1000, category_id: 0,
    is_subscribable: false, tags: "", initial_stock: 10
  });
  const [err, setErr] = useState<string | null>(null);

  if (!user) return <p className="card p-6 text-sm text-coffee-500">ログインが必要です。</p>;
  if (user.role !== "admin") return <p className="card p-6 text-sm text-coffee-500">権限がありません。</p>;

  async function setStock(productId: number, stock: number) {
    await api(`/admin/inventories/${productId}`, { method: "PATCH", body: jsonBody({ stock }), auth: token });
    mutate();
  }

  async function uploadImage(productId: number, file: File) {
    const fd = new FormData();
    fd.append("image", file);
    // FormData の場合 api ヘルパーは Content-Type を設定せず、ブラウザが multipart 境界を付与する
    await api(`/admin/products/${productId}/image`, { method: "POST", body: fd, auth: token });
    mutate();
  }

  async function create(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    try {
      await api("/admin/products", {
        method: "POST",
        body: jsonBody({
          ...form,
          tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
          published_at: new Date().toISOString(),
        }),
        auth: token,
      });
      mutate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "エラー");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">商品管理</h1>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[36rem]">
          <thead className="bg-coffee-50 text-xs uppercase tracking-wide text-coffee-500">
            <tr>
              <th className="p-3 text-left font-semibold">画像</th>
              <th className="p-3 text-left font-semibold">SKU</th>
              <th className="p-3 text-left font-semibold">名前</th>
              <th className="p-3 text-right font-semibold">価格</th>
              <th className="p-3 font-semibold">サブスク</th>
              <th className="p-3 font-semibold">在庫</th>
            </tr>
          </thead>
          <tbody>
            {products?.map((p) => (
              <tr key={p.id} className="border-t border-coffee-100 hover:bg-coffee-50/40 transition-colors">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 overflow-hidden rounded-md bg-coffee-50 border border-coffee-100 grid place-items-center shrink-0">
                      {p.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-[8px] text-coffee-300">no img</span>
                      )}
                    </div>
                    <label className="text-xs text-caramel hover:underline cursor-pointer">
                      変更
                      <input type="file" accept="image/*" className="hidden"
                             onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(p.id, f); }} />
                    </label>
                  </div>
                </td>
                <td className="p-3 text-coffee-500">{p.sku}</td>
                <td className="p-3 font-medium">{p.name}</td>
                <td className="p-3 text-right tabular-nums">{yen(p.price_cents)}</td>
                <td className="p-3 text-center">{p.is_subscribable ? <span className="badge badge-success">○</span> : <span className="text-coffee-300">—</span>}</td>
                <td className="p-3 text-center">
                  <input type="number" defaultValue={p.stock ?? 0}
                         onBlur={(e) => setStock(p.id, Number(e.target.value))}
                         className="input !w-20 text-center" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="card p-5">
        <h2 className="font-semibold mb-3">商品を追加</h2>
        <form onSubmit={create} className="grid grid-cols-2 gap-3 text-sm">
          <input required placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="input" />
          <input required placeholder="名前" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
          <select required value={form.category_id} onChange={(e) => setForm({ ...form, category_id: Number(e.target.value) })} className="input">
            <option value={0}>カテゴリ</option>
            {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input required type="number" placeholder="価格 (cents)" value={form.price_cents} onChange={(e) => setForm({ ...form, price_cents: Number(e.target.value) })} className="input" />
          <input placeholder="タグ (カンマ区切り)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="input col-span-2" />
          <textarea placeholder="説明" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input col-span-2 h-20" />
          <input type="number" placeholder="初期在庫" value={form.initial_stock} onChange={(e) => setForm({ ...form, initial_stock: Number(e.target.value) })} className="input" />
          <label className="flex items-center gap-2 px-1"><input type="checkbox" checked={form.is_subscribable} onChange={(e) => setForm({ ...form, is_subscribable: e.target.checked })} className="accent-caramel" />サブスク対象</label>
          {err && <p className="text-rose-600 col-span-2">{err}</p>}
          <button className="btn btn-primary col-span-2">追加</button>
        </form>
      </section>
    </div>
  );
}
