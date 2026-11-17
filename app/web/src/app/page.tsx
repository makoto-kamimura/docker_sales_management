import Link from "next/link";
import { api } from "@/lib/api";
import { SERVICE_SLUGS, type Product } from "@/lib/types";
import { yen } from "@/lib/format";
import { ORDER_FLOW, ORDER_STATUS_LABEL } from "@/lib/orderStatus";
import { HeroPromo } from "@/components/HeroPromo";
import { fetchStorefront } from "@/lib/storefront";

// 読み込めなかったときは null (公開中の商品がまだ 0 件のときと、表示を分ける)
async function getProducts(): Promise<Product[] | null> {
  try {
    return await api<Product[]>("/products");
  } catch {
    return null;
  }
}

// 取り扱いのカード。販売中のカテゴリ (slug) だけを出す
const CATEGORIES = [
  { slug: "3d-prints", label: "3D PRINTS", title: "3Dプリント品", desc: "受注後に出力・仕上げてお届けする完成品。", href: "/3d", cta: "見る →" },
  { slug: "3d-models", label: "3D MODELS", title: "3Dモデルデータ", desc: "自宅のプリンタで出力できるSTLデータ。購入後すぐダウンロード。", href: "/search?category=3d-models", cta: "見る →" },
  { slug: "handmade", label: "HANDMADE", title: "ハンドメイド雑貨", desc: "手縫いのレザー小物や無垢材の木工品。", href: "/search?category=handmade", cta: "見る →" },
  { slug: "materials", label: "MATERIALS", title: "素材・キット", desc: "フィラメントやクラフトキット。定期便も。", href: "/search?category=materials", cta: "見る →" },
  { slug: "diy-plans", label: "DIY PLANS", title: "DIY設計図", desc: "家具や棚を自分で作れる図面データ (PDF / DXF)。", href: "/search?category=diy-plans", cta: "見る →" },
  { slug: "custom", label: "CUSTOM", title: "オーダーメイド", desc: "名入れ・サイズ変更・一点ものの制作を依頼。", href: "/custom", cta: "相談する →" },
] as const;

// 受注してから作る (制作の工程がある) カテゴリ
const MADE_TO_ORDER_SLUGS = ["3d-prints", "handmade", "custom"];

export default async function Home() {
  const [products, storefront] = await Promise.all([getProducts(), fetchStorefront()]);
  // 店頭の状態を読めなかったときは、すべて出す (読めないことで案内が消えないように)
  const active = storefront ? new Set(storefront.categories.map((c) => c.slug)) : null;
  const categories = CATEGORIES.filter((c) => !active || active.has(c.slug));
  const madeToOrder = !active || MADE_TO_ORDER_SLUGS.some((s) => active.has(s));
  const customOrders = storefront ? storefront.custom_orders : true;
  return (
    <div className="space-y-16">
      {/* ヒーロー — docs/design/hero.html の15秒ループ */}
      <HeroPromo />

      {/* カテゴリ — 取り扱い領域 */}
      <section>
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-xl font-bold">取り扱い</h2>
          <span className="text-xs uppercase tracking-[0.18em] text-coffee-400">
            {categories.length} {categories.length === 1 ? "Category" : "Categories"}
          </span>
        </div>
        <ul className={`grid gap-4 ${categories.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
          {categories.map((c) => (
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

      {/* 制作状況の見える化 (受注してから作るものを販売しているときだけ) */}
      {madeToOrder && <section className="card p-6 sm:p-8">
        <span className="eyebrow">Made to order</span>
        <h2 className="mt-2 text-xl font-bold">いま、どの工程？が見える</h2>
        <p className="mt-1.5 text-sm text-coffee-500 max-w-2xl leading-relaxed">
          プリント品やハンドメイド作品はご注文を受けてからつくります。
          注文詳細ページで、受付から完了までの進み具合を確認できます。
        </p>
        <ol className="mt-6 flex flex-wrap items-center gap-y-3 text-xs sm:text-sm">
          {ORDER_FLOW.map((s, i) => (
            <li key={s} className="flex items-center">
              <span className={`rounded-full border px-3 py-1.5 font-medium ${
                ["awaiting_production", "in_production", "inspection"].includes(s)
                  ? "border-caramel/40 bg-caramel/10 text-coffee-800"
                  : "border-coffee-200 bg-coffee-50 text-coffee-600"
              }`}>
                {ORDER_STATUS_LABEL[s]}
              </span>
              {i < ORDER_FLOW.length - 1 && <span aria-hidden className="mx-1.5 text-coffee-300">→</span>}
            </li>
          ))}
        </ol>
      </section>}

      {/* 新着商品 */}
      <section>
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-xl font-bold">新着商品</h2>
          <Link href="/search" className="text-sm font-medium text-coffee-800 hover:text-caramel transition-colors">
            すべて見る →
          </Link>
        </div>
        {!products ? (
          <div className="card p-10 text-center text-sm text-coffee-500">
            商品を読み込めませんでした。時間をおいて、もう一度お試しください。
          </div>
        ) : products.length === 0 ? (
          <div className="card p-10 text-center text-sm text-coffee-500">
            <p>ただいま出品の準備中です。</p>
            {customOrders && (
              <p className="mt-2">
                名入れや一点ものの制作は、
                <Link href="/custom" className="font-semibold text-caramel hover:underline">オーダーメイド</Link>
                からご相談いただけます。
              </p>
            )}
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
                  {SERVICE_SLUGS.includes(p.category_slug as (typeof SERVICE_SLUGS)[number]) ? (
                    <span className="text-coffee-500">オーダーメイド (依頼制)</span>
                  ) : p.is_digital ? (
                    <span className="text-coffee-500">⬇ ダウンロード販売</span>
                  ) : p.in_stock ? (
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
