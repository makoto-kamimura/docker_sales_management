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

export type CartItem = {
  id: number; product_id: number; name: string;
  unit_price_cents: number; quantity: number; line_total_cents: number;
};

export type Cart = {
  id: number; total_items: number; subtotal_cents: number; currency: string; items: CartItem[];
};

export type Order = {
  id: number; status: string; total_cents: number; currency: string; placed_at: string;
  items?: { product_id: number; name: string; quantity: number; line_total_cents: number }[];
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
