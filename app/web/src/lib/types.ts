export type Product = {
  id: number;
  sku: string;
  name: string;
  description?: string;
  price_cents: number;
  currency: string;
  tags: string[];
  category_id: number;
  is_subscribable: boolean;
  in_stock: boolean;
  stock?: number;
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
};

export type Cart = {
  id: number;
  total_items: number;
  subtotal_cents: number;
  currency: string;
  items: CartItem[];
};

export type Order = {
  id: number;
  status: "pending" | "paid" | "shipped" | "delivered" | "cancelled";
  total_cents: number;
  currency: string;
  placed_at: string;
  item_count?: number;
  subtotal_cents?: number;
  tax_cents?: number;
  shipping_cents?: number;
  items?: Array<{ product_id: number; name: string; quantity: number; unit_price_cents: number; line_total_cents: number }>;
  shipment?: { status: string; carrier?: string; tracking_number?: string };
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
