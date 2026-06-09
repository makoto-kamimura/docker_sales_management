"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { api, jsonBody } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { yen } from "@/lib/format";
import type { Product } from "@/lib/types";

const SERVICE: Record<string, { href: string; label: string; note: string }> = {
  maintenance: { href: "/maintenance", label: "この整備を予約する", note: "店頭での予約制です。希望日時を添えてお申し込みください。" },
  system: { href: "/system", label: "この取付・開発を依頼する", note: "取付・開発の依頼制です。車種と要件をお知らせください。" },
};

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

  const service = SERVICE[p.category_slug];

  return (
    <article className="grid md:grid-cols-2 gap-6 max-w-4xl">
      <div className="card grid place-items-center overflow-hidden aspect-square md:aspect-auto md:min-h-[20rem] bg-coffee-50">
        {p.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs font-bold uppercase tracking-[0.25em] text-coffee-300">{p.sku}</span>
        )}
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
          <span className="text-3xl font-bold">{yen(p.price_cents)}{service && <span className="text-sm font-medium text-coffee-400 ml-1">〜（目安）</span>}</span>
          {!service && (
            <span className={`badge ${p.in_stock ? "badge-success" : "badge-muted"}`}>
              {p.in_stock ? `在庫: ${p.stock ?? "あり"}` : "在庫切れ"}
            </span>
          )}
        </div>

        {service ? (
          <div className="space-y-2">
            <Link href={service.href} className="btn btn-accent w-full">{service.label}</Link>
            <p className="text-xs text-coffee-500 leading-relaxed">{service.note}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <input type="number" min={1} max={99} value={qty} onChange={(e) => setQty(Number(e.target.value))}
                     className="input !w-20 text-center" />
              <button onClick={addToCart} disabled={busy || !p.in_stock} className="btn btn-primary flex-1">
                カートに追加
              </button>
            </div>
            {p.is_subscribable && (
              <a href="/subscriptions" className="block text-sm text-caramel hover:underline">
                サブスクで定期購入する →
              </a>
            )}
            {msg && <p className="text-sm rounded-lg bg-emerald-50 text-emerald-700 px-3 py-2">{msg}</p>}
          </>
        )}
      </div>
    </article>
  );
}
