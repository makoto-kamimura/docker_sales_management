"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { api, jsonBody } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { fileSize, yen } from "@/lib/format";
import type { Product } from "@/lib/types";

// カートに入らない依頼制のカテゴリ
const SERVICE: Record<string, { href: (id: string) => string; label: string; note: string }> = {
  custom: {
    href: (id) => `/custom?product_id=${id}`,
    label: "この内容で制作を依頼する",
    note: "オーダーメイドは依頼制です。サイズ・素材・希望納期をお知らせいただければ、お見積りをお送りします。",
  },
};

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token } = useAuth();
  const router = useRouter();
  const { data: p } = useSWR<Product>(`product-${id}`, () => api<Product>(`/products/${id}`));
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [active, setActive] = useState(0); // 表示中の写真

  async function addToCart() {
    if (!token) { router.push("/login"); return; }
    setBusy(true); setMsg(null);
    try {
      await api("/cart/items", { method: "POST", body: jsonBody({ product_id: Number(id), quantity: p?.is_digital ? 1 : qty }), auth: token });
      setMsg("カートに追加しました");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "エラー");
    } finally {
      setBusy(false);
    }
  }

  if (!p) return <p className="text-coffee-500 animate-pulse-soft">読み込み中…</p>;

  const service = SERVICE[p.category_slug];
  // 3Dモデル管理から販売している商品は、実モデル画像・実利用画像 (最大3枚) を切り替えて表示する
  const images = (p.photos?.length ?? 0) > 0
    ? p.photos!.map((ph) => ({ key: `photo-${ph.id}`, url: ph.url, alt: ph.caption || `${p.name} (${ph.kind_label})`, label: ph.kind_label, caption: ph.caption }))
    : p.image_url ? [{ key: "main", url: p.image_url, alt: p.name, label: "", caption: "" }] : [];
  const current = images[Math.min(active, images.length - 1)];

  return (
    <article className="grid md:grid-cols-2 gap-6 max-w-4xl">
      <div className="space-y-2">
        <div className="card relative grid place-items-center overflow-hidden aspect-square bg-coffee-50">
          {current ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current.url} alt={current.alt} className="h-full w-full object-cover" />
              {current.label && <span className="badge absolute left-2 top-2 bg-white/90 text-coffee-700">{current.label}</span>}
            </>
          ) : (
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-coffee-300">{p.sku}</span>
          )}
        </div>
        {current?.caption && <p className="px-1 text-xs text-coffee-500">{current.caption}</p>}
        {images.length > 1 && (
          <div className="grid grid-cols-3 gap-2">
            {images.map((img, i) => (
              <button key={img.key} type="button" onClick={() => setActive(i)} aria-label={`${i + 1}枚目の写真を表示`} aria-pressed={i === active}
                      className={`aspect-square overflow-hidden rounded-lg border-2 transition-opacity ${i === active ? "border-caramel" : "border-transparent opacity-75 hover:opacity-100"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
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
          {!service && (p.is_digital ? (
            <span className={`badge ${p.in_stock ? "badge-accent" : "badge-muted"}`}>
              {p.in_stock ? "ダウンロード販売" : "準備中"}
            </span>
          ) : (
            <span className={`badge ${p.in_stock ? "badge-success" : "badge-muted"}`}>
              {p.in_stock ? `在庫: ${p.stock ?? "あり"}` : "在庫切れ"}
            </span>
          ))}
        </div>

        {p.is_digital && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-xl border border-coffee-100 bg-coffee-50/60 p-4 text-sm">
            <dt className="text-coffee-500">形式</dt>
            <dd className="font-medium">{p.file_format ?? "—"}{p.file_size ? <span className="text-coffee-400 ml-2">{fileSize(p.file_size)}</span> : null}</dd>
            <dt className="text-coffee-500">ライセンス</dt>
            <dd>{p.license || "—"}</dd>
            <dt className="text-coffee-500">お届け</dt>
            <dd>お支払い確認後、注文詳細・アカウントページからダウンロード</dd>
          </dl>
        )}

        {service ? (
          <div className="space-y-2">
            <Link href={service.href(id)} className="btn btn-accent w-full">{service.label}</Link>
            <p className="text-xs text-coffee-500 leading-relaxed">{service.note}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              {!p.is_digital && (
                <input type="number" min={1} max={99} value={qty} onChange={(e) => setQty(Number(e.target.value))}
                       className="input !w-20 text-center" />
              )}
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
