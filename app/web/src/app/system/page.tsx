import { ServiceRequestForm } from "@/components/ServiceRequestForm";

export const metadata = { title: "システム開発依頼 — ROUTE & ROAST" };

export default function SystemPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <span className="eyebrow">System</span>
        <h1 className="mt-2 text-2xl font-bold">システム開発・取付の依頼</h1>
        <p className="text-sm text-coffee-500 mt-1">
          ナビ・電装・インカムの取付や、配線・カスタムのご相談を承ります。要件と車種をお知らせください。
        </p>
      </div>
      <ServiceRequestForm kind="system" categorySlug="system" submitLabel="開発依頼を送信する" />
    </div>
  );
}
