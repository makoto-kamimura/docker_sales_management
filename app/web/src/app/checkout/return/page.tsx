// アプリから開いた決済の画面 (Stripe Checkout / Customer Portal) の戻り先。アプリに戻るよう案内するだけ (ログイン不要)
const MESSAGES: Record<string, { title: string; body: string }> = {
  success: { title: "お支払いありがとうございます", body: "反映まで少し時間がかかることがあります。" },
  cancel: { title: "お支払いを中断しました", body: "注文詳細から、もう一度お支払いいただけます。" },
};

export default async function CheckoutReturnPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const { result } = await searchParams;
  const m = MESSAGES[result ?? ""];

  return (
    <div className="card p-8 max-w-md mx-auto text-center space-y-3">
      <h1 className="text-xl font-bold">{m?.title ?? "手続きが終わりました"}</h1>
      <p className="text-sm text-coffee-600">この画面を閉じて、アプリに戻ってください。{m?.body}</p>
    </div>
  );
}
