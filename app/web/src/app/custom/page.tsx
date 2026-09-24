import { RequestForm } from "@/components/RequestForm";

export const metadata = { title: "オーダーメイド制作の依頼 — CraftFlow" };

export default async function CustomOrderPage({ searchParams }: { searchParams: Promise<{ product_id?: string }> }) {
  const { product_id } = await searchParams;
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
