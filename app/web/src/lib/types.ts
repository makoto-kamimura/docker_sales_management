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
  /** 3Dモデルデータ等のダウンロード販売品 (在庫・配送なし) */
  is_digital: boolean;
  in_stock: boolean;
  stock?: number;
  license?: string;
  file_format?: string | null;
  file_size?: number | null;
  file_name?: string | null; // admin API のみ
  /** 3Dモデル管理から販売している商品のプレビュー写真 (最大3枚。商品詳細のみ) */
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
  currency: string;
  /** false ならデジタル商品のみ → 配送先不要 */
  requires_shipping: boolean;
  items: CartItem[];
};

export type Order = {
  id: number;
  status: OrderStatus;
  status_label: string;
  total_cents: number;
  currency: string;
  placed_at: string;
  item_count?: number;
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

/** 投げ銭 (0円で販売した商品を含む注文)。入金は店舗が確認する */
export type Tip = {
  id: number;
  order_id: number;
  amount_cents: number;
  message: string;
  status: "pending" | "paid" | "cancelled";
  status_label: string;
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

export type Subscription = {
  id: number;
  status: "active" | "paused" | "cancelled";
  quantity: number;
  interval_days: number;
  next_delivery_on: string;
  plan: { id: number; code: string; name: string };
  product: { id: number; sku: string; name: string; price_cents: number };
};
