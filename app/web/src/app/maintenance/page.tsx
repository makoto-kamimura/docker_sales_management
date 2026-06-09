import { ServiceRequestForm } from "@/components/ServiceRequestForm";

export const metadata = { title: "整備の予約 — ROUTE & ROAST" };

export default function MaintenancePage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <span className="eyebrow">Maintenance</span>
        <h1 className="mt-2 text-2xl font-bold">整備の予約</h1>
        <p className="text-sm text-coffee-500 mt-1">
          点検・消耗品交換・カスタム取付のご予約を受け付けます。希望日時と車種をお知らせください。
        </p>
      </div>
      <ServiceRequestForm kind="maintenance" categorySlug="maintenance" submitLabel="予約を申し込む" />
    </div>
  );
}
