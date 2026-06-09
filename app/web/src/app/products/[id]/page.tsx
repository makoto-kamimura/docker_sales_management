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

  if (!p) return <p className="text-coffee-500 animate-pulse-soft">読み込み中…</p>;

  return (
    <article className="grid md:grid-cols-2 gap-6 max-w-4xl">
      <div className="card grid place-items-center aspect-square md:aspect-auto md:min-h-[20rem] bg-gradient-to-br from-coffee-50 to-foam text-7xl">
        ☕
      </div>
      <div className="card p-6 space-y-5 self-start">
        <div>
          <p className="text-xs font-medium text-coffee-400">{p.sku}</p>
          <h1 className="text-2xl font-bold mt-0.5">{p.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {p.tags.map((t) => <span key={t} className="badge badge-accent">{t}</span>)}
        </div>
        <p className="text-sm text-coffee-700 whitespace-pre-line leading-relaxed">{p.description}</p>
        <div className="flex items-center justify-between border-t border-coffee-100 pt-4">
          <span className="text-3xl font-bold">{yen(p.price_cents)}</span>
          <span className={`badge ${p.in_stock ? "badge-success" : "badge-muted"}`}>
            {p.in_stock ? `在庫: ${p.stock ?? "あり"}` : "在庫切れ"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <input type="number" min={1} max={99} value={qty} onChange={(e) => setQty(Number(e.target.value))}
                 className="input !w-20 text-center" />
          <button onClick={addToCart} disabled={busy || !p.in_stock} className="btn btn-primary flex-1">
            カートに追加
          </button>
        </div>
        {p.is_subscribable && (
          <a href="/subscriptions" className="block text-sm text-caramel hover:underline">
            🔁 サブスクで定期購入する →
          </a>
        )}
        {msg && <p className="text-sm rounded-lg bg-emerald-50 text-emerald-700 px-3 py-2">{msg}</p>}
      </div>
    </article>
  );
}
