"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api } from "@/lib/api";
import { yen } from "@/lib/format";
import type { Product, Category } from "@/lib/types";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [mode, setMode] = useState<"keyword" | "semantic">("keyword");
  const [categoryId, setCategoryId] = useState<string>("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const { data: cats } = useSWR<Category[]>("cats", () => api<Category[]>("/categories"));
  const { data: products, isLoading } = useSWR<Product[]>(
    ["search", submitted, mode, categoryId, minPrice, maxPrice],
    () => {
      if (mode === "semantic" && submitted.trim()) {
        return api<Product[]>(`/products/search?q=${encodeURIComponent(submitted)}`);
      }
      const params = new URLSearchParams();
      if (submitted) params.set("q", submitted);
      if (categoryId) params.set("category_id", categoryId);
      if (minPrice) params.set("min_price", minPrice);
      if (maxPrice) params.set("max_price", maxPrice);
      return api<Product[]>(`/products?${params.toString()}`);
    }
  );

  useEffect(() => { setSubmitted(""); }, [mode]);

  return (
    <div className="space-y-6">
      <section className="bg-white border rounded-xl p-4">
        <form
          onSubmit={(e) => { e.preventDefault(); setSubmitted(q); }}
          className="flex flex-wrap items-end gap-2"
        >
          <div className="flex-1 min-w-[16rem]">
            <label className="block text-xs text-coffee-500">キーワード / 質問</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="例: 浅煎り、香りが華やか"
                   className="mt-1 w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs text-coffee-500">モード</label>
            <select value={mode} onChange={(e) => setMode(e.target.value as "keyword" | "semantic")} className="rounded border px-2 py-2">
              <option value="keyword">キーワード</option>
              <option value="semantic">セマンティック (AI)</option>
            </select>
          </div>
          {mode === "keyword" && (
            <>
              <div>
                <label className="block text-xs text-coffee-500">カテゴリ</label>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="rounded border px-2 py-2">
                  <option value="">すべて</option>
                  {cats?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-coffee-500">最低価格</label>
                <input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="rounded border px-2 py-2 w-24" />
              </div>
              <div>
                <label className="block text-xs text-coffee-500">最高価格</label>
                <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="rounded border px-2 py-2 w-24" />
              </div>
            </>
          )}
          <button className="rounded bg-espresso text-white px-4 py-2">検索</button>
        </form>
      </section>

      <section>
        {isLoading && <p className="text-sm text-coffee-500">検索中…</p>}
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {products?.map((p) => (
            <li key={p.id} className="bg-white border rounded p-3">
              <Link href={`/products/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
              <div className="text-xs text-coffee-500">{p.tags.join(", ")}</div>
              <div className="mt-1 font-semibold">{yen(p.price_cents)}</div>
            </li>
          ))}
        </ul>
        {products && products.length === 0 && <p className="text-sm text-coffee-500">該当する商品はありません</p>}
      </section>
    </div>
  );
}
