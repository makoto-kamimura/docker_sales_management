import Link from "next/link";
import { RequestForm } from "@/components/RequestForm";
import { fetchStorefront } from "@/lib/storefront";

export const metadata = { title: "オーダーメイド制作の依頼 — CraftFlow" };

export default async function CustomOrderPage({ searchParams }: { searchParams: Promise<{ product_id?: string }> }) {
  const [{ product_id }, storefront] = await Promise.all([searchParams, fetchStorefront()]);
  // 受付を休止しているときは、フォームを出さない (店頭の状態を読めなければ出す。API が最終的に判定する)
  if (storefront && !storefront.custom_orders) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <span className="eyebrow">Custom order</span>
          <h1 className="mt-2 text-2xl font-bold">オーダーメイド制作の依頼</h1>
        </div>
        <div className="card p-8 text-center text-sm leading-relaxed text-coffee-600">
          <p>現在、オーダーメイドの受付を休止しています。</p>
          <p className="mt-2">
            ご質問は<Link href="/contact" className="font-semibold text-caramel hover:underline">お問い合わせ</Link>からお送りください。
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <span className="eyebrow">Custom order</span>
        <h1 className="mt-2 text-2xl font-bold">オーダーメイド制作の依頼</h1>
        <p className="text-sm text-coffee-500 mt-1 leading-relaxed">
          名入れ・サイズ変更・一点ものの3Dプリントやレザー小物など、つくりたいものをお聞かせください。
          内容を確認してお見積りをお送りします。
        </p>
      </div>
      <RequestForm kind="custom" submitLabel="制作を依頼する" initialProductId={product_id} />
    </div>
  );
}
