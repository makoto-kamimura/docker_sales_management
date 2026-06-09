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

export default async function Home() {
  const products = await getProducts();
  return (
    <div className="space-y-10">
      {/* ヒーロー */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-espresso via-coffee-700 to-coffee-800 text-coffee-50 px-8 py-12 sm:px-12 sm:py-16 shadow-lift">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-caramel/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-10 bottom-0 h-56 w-56 rounded-full bg-coffee-300/20 blur-3xl"
        />
        <div className="relative max-w-xl">
          <span className="badge bg-white/15 text-coffee-50 backdrop-blur">☕ Specialty Coffee Store</span>
          <h1 className="mt-4 text-3xl sm:text-4xl font-bold leading-tight">
            毎日に、ちょうどいい<br className="hidden sm:block" />一杯を。
          </h1>
          <p className="mt-3 text-sm sm:text-base text-coffee-100/90 leading-relaxed">
            コーヒー・紅茶・お菓子のセレクトショップ。サブスクで毎週 / 隔週 / 月1お届け。
            ご質問は右下のAI接客までお気軽にどうぞ。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/search" className="btn btn-accent">商品を探す</Link>
            <Link href="/subscriptions" className="btn btn-outline !bg-white/10 !text-coffee-50 !border-white/25 hover:!bg-white/20">
              サブスクを見る
            </Link>
          </div>
        </div>
      </section>

      {/* 新着商品 */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-lg font-bold">新着商品</h2>
          <Link href="/search" className="text-sm font-medium text-caramel hover:underline">
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
                <div className="mb-3 grid h-32 place-items-center rounded-xl bg-gradient-to-br from-coffee-50 to-foam text-4xl">
                  ☕
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
