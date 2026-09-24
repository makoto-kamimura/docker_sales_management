import { RequestForm } from "@/components/RequestForm";

export const metadata = { title: "お問い合わせ — CraftFlow" };

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ order_id?: string }> }) {
  const { order_id } = await searchParams;
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <span className="eyebrow">Contact</span>
        <h1 className="mt-2 text-2xl font-bold">お問い合わせ</h1>
        <p className="text-sm text-coffee-500 mt-1 leading-relaxed">
          作品・納期・配送などについてお気軽にどうぞ。ご注文についてのお問い合わせは、対象の注文を選ぶとスムーズです。
        </p>
      </div>
      <RequestForm kind="inquiry" submitLabel="送信する" initialOrderId={order_id} />
    </div>
  );
}
