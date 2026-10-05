import type { OrderStatus } from "./orderStatus";

export type Product = {
  id: number;
  sku: string;
  name: string;
  description?: string;
  price_cents: number;
  currency: string;
  tags: string[];
  category_id: number;
  category_slug: string;
  image_url: string;
  is_subscribable: boolean;
  /** 3Dモデルデータ・DIY設計図等のダウンロード販売品 (在庫・配送なし) */
  is_digital: boolean;
  in_stock: boolean;
  stock?: number;
  license?: string;
  file_format?: string | null;
  file_size?: number | null;
  file_name?: string | null; // admin API のみ
  /** 3Dモデル管理 (3Dモデル・DIY設計図) から販売している商品のプレビュー写真 (最大3枚。商品詳細のみ) */
  photos?: { id: number; url: string; kind: string; kind_label: string; caption: string }[];
};

/** 3Dプリント関連カテゴリ: モデルデータ (ダウンロード) と 出力品 (物販) */
export const PRINT_3D_SLUGS = { models: "3d-models", prints: "3d-prints" } as const;

/** 購入済みデジタル商品 (GET /downloads) */
export type Download = {
  product_id: number;
  sku: string;
  name: string;
  license: string;
  file_format: string | null;
  filename: string | null;
  byte_size: number | null;
  /** 組み立て説明書 (PDF) をダウンロードできる */
  has_assembly: boolean;
};

/** カートに入らず オーダーメイド制作依頼 へ誘導するカテゴリ */
export const SERVICE_SLUGS = ["custom"] as const;

/** inquiry: 問い合わせ / custom: オーダーメイド制作依頼 */
export type RequestKind = "inquiry" | "custom";

export type ServiceRequest = {
  id: number;
  kind: RequestKind;
  status: string;
  subject: string;
  preferred_at: string | null; // custom: 希望納期
  budget_cents: number | null;
  body: string;
  contact_phone: string;
  created_at: string;
  order_id: number | null;
  reply: string;
  replied_at: string | null;
  product: { id: number; sku: string; name: string } | null;
};

export type Category = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  position: number;
};

export type Address = {
  id: number;
  label: string;
  recipient: string;
  postal_code: string;
  prefecture: string;
  city: string;
  line1: string;
  line2?: string;
  phone?: string;
  is_default: boolean;
};

export type CartItem = {
  id: number;
  product_id: number;
  name: string;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
  is_digital: boolean;
};

export type Cart = {
  id: number;
  total_items: number;
  subtotal_cents: number;
  /** 注文と同じ計算の消費税・送料・合計 */
  tax_cents: number;
  shipping_cents: number;
  total_cents: number;
  currency: string;
  /** false ならデジタル商品のみ → 配送先不要 */
  requires_shipping: boolean;
  items: CartItem[];
};

/** 特定商取引法に基づく表記。料金・支払方法・定期便のプランは、実際の計算に使う値 */
export type LegalNotice = {
  /** 表記に必要な項目がそろっているか */
  complete: boolean;
  seller: {
    name: string;
    representative: string;
    email: string;
    contact_hours: string;
    /** true なら住所・電話番号は載せず、請求があれば開示する (address / phone は null) */
    disclose_on_request: boolean;
    address: string | null;
    phone: string | null;
  };
  transfer_payment_due: string;
  shipping_lead_time: string;
  returns_policy: string;
  extra_notes: string;
  pricing: { tax_rate_percent: number; shipping_flat_cents: number; free_shipping_threshold_cents: number };
  card_enabled: boolean;
  card_min_amount_cents: number;
  subscription_plans: { name: string; interval_days: number; discount_percent: number }[];
  tip_range_cents: { min: number; max: number };
  updated_at: string;
};

export type Order = {
  id: number;
  status: OrderStatus;
  status_label: string;
  total_cents: number;
  currency: string;
  placed_at: string;
  item_count?: number;
  /** card: カード (Stripe) / transfer: 振込など (店舗が入金を確認) / free: 0円の注文 */
  payment_kind?: PaymentKind | "free";
  payment_kind_label?: string;
  /** カードで支払える (払い直せる) */
  card_payable?: boolean;
  /** 定期便の請求ごとの注文 */
  subscription_id?: number | null;
  subtotal_cents?: number;
  tax_cents?: number;
  shipping_cents?: number;
  /** 支払い済みでデジタル商品をダウンロードできる状態か */
  downloadable?: boolean;
  /** 0円の商品を含む注文で、投げ銭できる */
  accepts_tips?: boolean;
  tips?: Tip[];
  /** 物販品を含む (制作・発送の工程がある) */
  physical?: boolean;
  due_on?: string | null;
  events?: { status: OrderStatus; status_label: string; created_at: string }[];
  items?: Array<{ product_id: number; name: string; quantity: number; unit_price_cents: number; line_total_cents: number; is_digital: boolean; has_assembly?: boolean }>;
  shipment?: { status: string; carrier?: string; tracking_number?: string };
};

export type PaymentKind = "card" | "transfer";

/** 投げ銭 (0円で販売した商品を含む注文)。カードは Stripe で支払い、振込などは店舗が入金を確認する */
export type Tip = {
  id: number;
  order_id: number;
  amount_cents: number;
  message: string;
  status: "pending" | "paid" | "cancelled";
  status_label: string;
  payment_kind: PaymentKind;
  card_payable: boolean;
  created_at: string;
  paid_at: string | null;
};

export type SubscriptionPlan = {
  id: number;
  name: string;
  code: string;
  interval_days: number;
  discount_percent: number;
  description: string;
  active: boolean;
};

/** 定期便。カード (Stripe) でお届けの間隔ごとに請求する */
export type Subscription = {
  id: number;
  /** incomplete: 申し込み手続き中 / past_due: 支払いの確認待ち */
  status: "incomplete" | "active" | "paused" | "past_due" | "cancelled";
  status_label: string;
  quantity: number;
  interval_days: number;
  next_delivery_on: string;
  /** Stripe が請求する定期便 (false は以前の定期便) */
  card: boolean;
  /** 割引後の単価 */
  unit_price_cents: number;
  /** 1回のお届けの金額 (税・送料込み) */
  charge_cents: number;
  plan: { id: number; code: string; name: string };
  product: { id: number; sku: string; name: string; price_cents: number };
};
