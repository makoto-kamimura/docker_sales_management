"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { api, jsonBody } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { yen } from "@/lib/format";
import type { Product } from "@/lib/types";

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token } = useAuth();
  const router = useRouter();
  const { data: p } = useSWR<Product>(`product-${id}`, () => api<Product>(`/products/${id}`));
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function addToCart() {
    if (!token) { router.push("/login"); return; }
    setBusy(true); setMsg(null);
    try {
      await api("/cart/items", { method: "POST", body: jsonBody({ product_id: Number(id), quantity: qty }), auth: token });
      setMsg("カートに追加しました");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "エラー");
    } finally {
      setBusy(false);
    }
  }

  if (!p) return <p>読み込み中…</p>;

  return (
    <article className="bg-white border rounded-xl p-6 space-y-4 max-w-2xl">
      <div>
        <p className="text-xs text-coffee-500">{p.sku}</p>
        <h1 className="text-xl font-bold">{p.name}</h1>
      </div>
      <p className="text-sm text-coffee-700 whitespace-pre-line">{p.description}</p>
      <div className="flex flex-wrap gap-2 text-xs">
        {p.tags.map((t) => <span key={t} className="bg-foam rounded-full px-2 py-0.5">{t}</span>)}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-2xl font-bold">{yen(p.price_cents)}</span>
        <span className={`text-sm ${p.in_stock ? "text-emerald-600" : "text-rose-600"}`}>
          {p.in_stock ? `在庫: ${p.stock ?? "あり"}` : "在庫切れ"}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <input type="number" min={1} max={99} value={qty} onChange={(e) => setQty(Number(e.target.value))}
               className="w-20 rounded border px-2 py-1" />
        <button onClick={addToCart} disabled={busy || !p.in_stock} className="rounded bg-espresso text-white px-4 py-2 disabled:opacity-50">
          カートに追加
        </button>
        {p.is_subscribable && (
          <a href="/subscriptions" className="text-sm underline">サブスクで購入</a>
        )}
      </div>
      {msg && <p className="text-sm">{msg}</p>}
    </article>
  );
}
