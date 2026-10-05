import type { Metadata } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { yen } from "@/lib/format";
import type { LegalNotice } from "@/lib/types";

// 特定商取引法に基づく表記。JS なしでも読めるようにサーバーで描画する。
// 販売者の情報と店舗の方針は管理画面 (設定 › ショップ情報)、料金・支払方法・定期便は実際の計算に使う値を表示する
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "特定商取引法に基づく表記 | CraftFlow" };

const PENDING = "（準備中）";
const ON_REQUEST = "請求があった場合には遅滞なく開示します。";

export default async function TokushohoPage() {
  let n: LegalNotice;
  try {
    n = await api<LegalNotice>("/legal_notice");
  } catch {
    return <p className="card p-6 text-sm text-coffee-500">表記を読み込めませんでした。時間をおいてから、もう一度お試しください。</p>;
  }

  const { seller, pricing } = n;
  const contactPhone = seller.disclose_on_request
    ? ON_REQUEST
    : [seller.phone || PENDING, seller.contact_hours && `（受付時間：${seller.contact_hours}）`].filter(Boolean).join("");

  const rows: [string, React.ReactNode][] = [
    ["販売事業者", seller.name || PENDING],
    ["運営統括責任者", seller.representative || PENDING],
    ["所在地", seller.disclose_on_request ? ON_REQUEST : seller.address || PENDING],
    ["電話番号", contactPhone],
    ["メールアドレス", seller.email || PENDING],
    [
      "お問い合わせ",
      <>
        <Link href="/contact" className="text-caramel hover:underline">お問い合わせフォーム</Link>
        、またはメールで受け付けます。
      </>,
    ],
    ["販売価格", `各商品ページに表示しています。表示価格は税抜で、別途消費税（${pricing.tax_rate_percent}%）がかかります。`],
    [
      "商品代金以外の必要料金",
      <ul key="fees" className="list-disc pl-5 space-y-1">
        <li>消費税（{pricing.tax_rate_percent}%）</li>
        <li>
          送料：1回のご注文につき {yen(pricing.shipping_flat_cents)}（全国一律）。商品の小計が {yen(pricing.free_shipping_threshold_cents)} 以上の場合と、
          3Dデータ・DIY設計図だけのご注文は無料です。
        </li>
        <li>銀行振込の場合の振込手数料（お客様のご負担）</li>
      </ul>,
    ],
    [
      "お支払い方法",
      <ul key="methods" className="list-disc pl-5 space-y-1">
        {n.card_enabled && <li>クレジットカード（決済サービス Stripe。{yen(n.card_min_amount_cents)} 以上のご注文）。カード情報は当店には保存しません。</li>}
        <li>銀行振込（振込先はご注文後にご連絡します）</li>
        {n.card_enabled && <li>定期便はクレジットカードのみです。</li>}
      </ul>,
    ],
    [
      "お支払い時期",
      <ul key="timing" className="list-disc pl-5 space-y-1">
        {n.card_enabled && <li>クレジットカード：ご注文の確定時に決済します。</li>}
        <li>銀行振込：{n.transfer_payment_due || PENDING}</li>
        {n.card_enabled && <li>定期便：お申し込み時に1回目を、以後はお届けの間隔ごとに決済します。</li>}
      </ul>,
    ],
    [
      "商品の引渡し時期",
      <ul key="delivery" className="list-disc pl-5 space-y-1">
        <li>3Dプリント品・ハンドメイド・素材：{n.shipping_lead_time || PENDING}</li>
        <li>3Dデータ・DIY設計図：お支払いの確認後、すぐに注文詳細・アカウント画面からダウンロードできます。</li>
        <li>オーダーメイド：お見積もりの際に個別にご案内します。</li>
      </ul>,
    ],
    ["返品・交換・キャンセル", <span key="returns" className="whitespace-pre-line">{n.returns_policy || PENDING}</span>],
  ];

  if (n.card_enabled && n.subscription_plans.length > 0) {
    rows.push([
      "定期便（サブスクリプション）",
      <div key="subs" className="space-y-2">
        <ul className="list-disc pl-5 space-y-1">
          {n.subscription_plans.map((p) => (
            <li key={p.name}>{p.name}：{p.interval_days}日ごとにお届け、商品価格から {p.discount_percent}% 割引</li>
          ))}
        </ul>
        <p>
          1回あたりのお支払い金額は、割引後の単価 × 数量に消費税と送料を加えた額です（お申し込み時の価格で固定）。
          お申し込み画面に表示し、お申し込み時に1回目を、以後はお届けの間隔ごとにクレジットカードで決済します。
        </p>
        <p>
          契約期間の定めはなく、解約されるまで続きます。サブスク画面からいつでも解約・一時停止・次回のスキップができ、次回の決済から反映されます。
          決済済みの回のお届けはキャンセルできません。
        </p>
      </div>,
    ]);
  }

  rows.push(
    [
      "投げ銭",
      `無料でお届けした作品を含むご注文に、任意で ${yen(n.tip_range_cents.min)}〜${yen(n.tip_range_cents.max)} の投げ銭（応援）をいただけます。商品の対価ではなく、お支払い後の返金はいたしません。`,
    ],
    [
      "動作環境（3Dデータ・DIY設計図）",
      "3Dデータは STL / 3MF / OBJ / STEP（複数ファイルは ZIP）、DIY設計図は PDF / PNG / JPG / SVG / DXF / DWG で提供します。ご利用には、各形式を開けるソフトウェア（3Dプリンターのスライサー、CAD、PDF ビューアなど）が必要です。",
    ],
  );
  if (n.extra_notes) rows.push(["その他", <span key="notes" className="whitespace-pre-line">{n.extra_notes}</span>]);

  return (
    <article className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">特定商取引法に基づく表記</h1>
      {!n.complete && (
        <p className="rounded-xl border border-coffee-200 bg-coffee-50 px-4 py-3 text-sm text-coffee-600">
          一部の項目を準備中です。
        </p>
      )}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="border-t border-coffee-100 first:border-t-0 align-top">
                <th scope="row" className="w-28 sm:w-52 bg-coffee-50 p-4 text-left font-semibold text-coffee-700">{label}</th>
                <td className="p-4 leading-relaxed text-coffee-800">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-coffee-400">最終更新：{new Date(n.updated_at).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}</p>
    </article>
  );
}
