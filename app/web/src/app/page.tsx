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
    <div className="space-y-6">
      <section className="rounded-xl bg-white border p-6">
        <h1 className="text-2xl font-bold mb-2">docker_ruby ストア</h1>
        <p className="text-coffee-600 text-sm">
          コーヒー・紅茶・お菓子のセレクトショップ。サブスクで毎週/隔週/月1お届け。
          ご質問は右下のAI接客までどうぞ。
        </p>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-semibold">新着商品</h2>
          <Link href="/search" className="text-sm underline">商品を探す</Link>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <li key={p.id} className="bg-white border rounded-lg p-4">
              <Link href={`/products/${p.id}`} className="font-medium hover:underline">
                {p.name}
              </Link>
              <div className="text-sm text-coffee-500">{p.sku}</div>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-semibold">{yen(p.price_cents)}</span>
                {p.is_subscribable && (
                  <span className="text-xs rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5">サブスク対応</span>
                )}
              </div>
              <div className="mt-1 text-xs text-coffee-400">
                {p.in_stock ? "在庫あり" : "在庫切れ"}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
