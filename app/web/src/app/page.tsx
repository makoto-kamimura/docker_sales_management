import Link from "next/link";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";
import { yen } from "@/lib/format";

async function getProducts(): Promise<Product[]> {
  try {
    return await api<Product[]>("/products");
  } catch {
    return [];
  }
}

const CATEGORIES = [
  { label: "COFFEE", title: "コーヒー豆", desc: "自家焙煎のスペシャルティ。走る前の一杯を。", href: "/search?category=coffee", cta: "見る →" },
  { label: "PARTS", title: "パーツ", desc: "タイヤ・オイル・カスタムパーツを厳選。", href: "/search?category=parts", cta: "見る →" },
  { label: "MAINTENANCE", title: "整備", desc: "点検・消耗品交換・カスタム取付の予約。", href: "/maintenance", cta: "予約する →" },
  { label: "SYSTEM", title: "システム", desc: "ナビ・電装・インカムの取付や開発を依頼。", href: "/system", cta: "依頼する →" },
] as const;

export default async function Home() {
  const products = await getProducts();
  return (
    <div className="space-y-16">
      {/* ヒーロー — モダン・ミニマル: 余白とタイポで見せる */}
      <section className="relative overflow-hidden rounded-2xl bg-espresso text-coffee-50 px-8 py-16 sm:px-14 sm:py-24">
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 h-full w-1.5 bg-caramel"
        />
        <div className="relative max-w-2xl">
          <span className="eyebrow text-caramel">Riders Cafe · Since 2026</span>
          <h1 className="mt-5 text-4xl sm:text-6xl font-bold leading-[1.05] tracking-tight">
            コーヒーと、<br />走るための全部。
          </h1>
          <p className="mt-6 text-sm sm:text-base text-coffee-300 leading-relaxed max-w-lg">
            自家焙煎のコーヒー豆から、パーツ・整備・ナビシステムまで。
            ライダーの「走る」を一か所で支えるカフェ＆ガレージ。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/search" className="btn btn-accent">商品を探す</Link>
            <Link
              href="/subscriptions"
              className="btn btn-outline !text-coffee-50 !border-white/25 hover:!bg-white/10 hover:!border-white/40"
            >
              サブスクを見る
            </Link>
          </div>
        </div>
      </section>

      {/* カテゴリ — 4つの取り扱い領域 */}
      <section>
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-xl font-bold">取り扱い</h2>
          <span className="text-xs uppercase tracking-[0.18em] text-coffee-400">4 Categories</span>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CATEGORIES.map((c) => (
            <li key={c.label}>
              <Link
                href={c.href}
                className="card card-interactive group flex h-full flex-col p-6"
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-caramel">
                  {c.label}
                </span>
                <span className="mt-2 text-lg font-bold">{c.title}</span>
                <span className="mt-1.5 text-xs text-coffee-500 leading-relaxed">{c.desc}</span>
                <span className="mt-4 text-sm font-medium text-coffee-800 group-hover:text-caramel transition-colors">
                  {c.cta}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* 新着商品 */}
      <section>
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-xl font-bold">新着商品</h2>
          <Link href="/search" className="text-sm font-medium text-coffee-800 hover:text-caramel transition-colors">
            すべて見る →
          </Link>
        </div>
        {products.length === 0 ? (
          <div className="card p-10 text-center text-sm text-coffee-500">
            商品を読み込めませんでした。
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map((p) => (
              <li key={p.id} className="card card-interactive p-5 flex flex-col">
                <div className="mb-4 grid h-36 place-items-center overflow-hidden rounded-lg bg-coffee-50 border border-coffee-100">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-coffee-300">
                      {p.sku}
                    </span>
                  )}
                </div>
                <Link
                  href={`/products/${p.id}`}
                  className="font-semibold hover:text-caramel transition-colors"
                >
                  {p.name}
                </Link>
                <div className="text-xs text-coffee-400 mt-0.5">{p.sku}</div>
                <div className="mt-auto pt-3 flex items-center justify-between">
                  <span className="text-lg font-bold">{yen(p.price_cents)}</span>
                  {p.is_subscribable && <span className="badge badge-success">サブスク対応</span>}
                </div>
                <div className="mt-1.5 text-xs">
                  {p.in_stock ? (
                    <span className="text-emerald-600">● 在庫あり</span>
                  ) : (
                    <span className="text-coffee-400">● 在庫切れ</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
