import type { OrderStatus } from './orderStatus';

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
};

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

export type CartItem = {
  id: number; product_id: number; name: string;
  unit_price_cents: number; quantity: number; line_total_cents: number; is_digital: boolean;
};

export type Cart = {
  id: number; total_items: number; subtotal_cents: number; currency: string;
  /** false ならデジタル商品のみ → 配送先不要 */
  requires_shipping: boolean;
  items: CartItem[];
};

export type Order = {
  id: number; status: OrderStatus; status_label: string; total_cents: number; currency: string; placed_at: string;
  /** 支払い済みでデジタル商品をダウンロードできる状態か */
  downloadable?: boolean;
  /** 0円の商品を含む注文で、投げ銭できる */
  accepts_tips?: boolean;
  tips?: { id: number; amount_cents: number; message: string; status: string; status_label: string; created_at: string }[];
  /** 物販品を含む (制作・発送の工程がある) */
  physical?: boolean;
  due_on?: string | null;
  events?: { status: OrderStatus; status_label: string; created_at: string }[];
  items?: { product_id: number; name: string; quantity: number; line_total_cents: number; is_digital: boolean; has_assembly?: boolean }[];
};

export type Subscription = {
  id: number; status: string; quantity: number; interval_days: number; next_delivery_on: string;
  plan: { id: number; code: string; name: string };
  product: { id: number; sku: string; name: string; price_cents: number };
};

export type Address = {
  id: number; label: string; recipient: string; postal_code: string;
  prefecture: string; city: string; line1: string; line2?: string; phone?: string; is_default: boolean;
};
