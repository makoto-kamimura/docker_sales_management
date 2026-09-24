import Link from "next/link";
import { api } from "@/lib/api";
import { PRINT_3D_SLUGS, type Product } from "@/lib/types";
import { yen } from "@/lib/format";

async function getProducts(slug: string): Promise<Product[]> {
  try {
    return await api<Product[]>(`/products?category_slug=${slug}&sort=newest`);
  } catch {
    return [];
  }
}

export default async function Print3DPage() {
  const [models, prints] = await Promise.all([
    getProducts(PRINT_3D_SLUGS.models),
    getProducts(PRINT_3D_SLUGS.prints),
  ]);

  return (
    <div className="space-y-12">
      <section>
        <span className="eyebrow text-caramel">3D Print Lab</span>
        <h1 className="mt-2 text-2xl font-bold">3Dプリント</h1>
        <p className="text-sm text-coffee-500 mt-1 max-w-2xl leading-relaxed">
          バイク・ガレージ・キャンプで使える小物を、自宅の3Dプリンタで出力できる<strong>モデルデータ</strong>と、
          当店で出力・仕上げた<strong>プリント品</strong>の2通りで販売しています。
        </p>
      </section>

      <ProductSection
        label="3D MODEL DATA"
        title="モデルデータ (ダウンロード)"
        note="STL / 3MF などのデータ販売です。お支払い確認後、注文詳細からダウンロードできます。送料はかかりません。"
        products={models}
      />
      <ProductSection
        label="3D PRINTS"
        title="プリント品 (配送)"
        note="当店で出力・仕上げ済みの完成品です。通常の商品と同様に配送します。"
        products={prints}
      />
    </div>
  );
}

function ProductSection({ label, title, note, products }: {
  label: string; title: string; note: string; products: Product[];
}) {
  return (
    <section>
      <div className="mb-4">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-caramel">{label}</span>
        <h2 className="text-xl font-bold mt-1">{title}</h2>
        <p className="text-xs text-coffee-500 mt-1">{note}</p>
      </div>
      {products.length === 0 ? (
        <div className="card p-8 text-center text-sm text-coffee-500">現在取り扱い中の商品はありません</div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <li key={p.id} className="card card-interactive p-4 flex flex-col">
              <Link href={`/products/${p.id}`} className="font-semibold hover:text-caramel transition-colors">
                {p.name}
              </Link>
              <div className="text-xs text-coffee-400 mt-1 line-clamp-1">{p.tags.join(" · ")}</div>
              <div className="mt-auto pt-3 flex items-center justify-between">
                <span className="font-bold text-lg">{yen(p.price_cents)}</span>
                {p.is_digital ? (
                  <span className="badge badge-accent">⬇ データ</span>
                ) : (
                  <span className={`badge ${p.in_stock ? "badge-success" : "badge-muted"}`}>
                    {p.in_stock ? "在庫あり" : "在庫切れ"}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
