// 管理画面 (販売・制作・注文・権限設定) の API 型
import type { OrderStatus } from "./orderStatus";
import type { Permission, Role } from "./permissions";
import type { Tip } from "./types";

/** 店舗側の投げ銭 (購入者・確認者つき) */
export type AdminTip = Tip & {
  user: { id: number; name: string; email: string };
  confirmed_by: { id: number; name: string } | null;
};

export type AdminTipList = {
  summary: { pending_count: number; pending_cents: number; paid_count: number; paid_cents: number };
  tips: AdminTip[];
};

export type StaffUser = { id: number; name: string; role: "staff" | "admin" };

/** 版に含まれる3Dモデルファイル */
export type ModelFile = {
  id: number;
  filename: string;
  format: string;
  byte_size: number;
  /** ブラウザの3Dプレビューに対応 (STL / OBJ / 3MF) */
  previewable: boolean;
};

/** 3Dモデルの版 (current: 最新版)。1つの版に複数のファイルを持てる */
export type ModelVersion = {
  id: number;
  number: number;
  note: string;
  current: boolean;
  files: ModelFile[];
  /** ファイルの合計サイズ */
  byte_size: number;
  created_at: string;
  created_by: { id: number; name: string } | null;
};

/** 3Dモデルの写真。featured (最大3枚) をプレビュー表示する */
export type ModelPhoto = {
  id: number;
  kind: "real_model" | "in_use";
  kind_label: string;
  caption: string;
  featured: boolean;
  position: number;
  url: string;
};

export type AssemblyStep = { id: number; position: number; title: string; body: string; image_url: string | null };

export type ModelAssetSummary = {
  id: number;
  name: string;
  /** 販売フラグ (ショップの商品と連動) */
  for_sale: boolean;
  price_cents: number;
  updated_at: string;
  preview_image_url: string | null;
  /** プレビュー表示の写真 (最大3枚) */
  preview_photos: ModelPhoto[];
  photos_count: number;
  current_version: { number: number; files_count: number; formats: string[] } | null;
  versions_count: number;
  assembly_steps_count: number;
  product: { id: number; sku: string; published: boolean } | null;
};

export type ModelAssetDetail = ModelAssetSummary & {
  description: string;
  license: string;
  /** 必要な部品・工具 */
  assembly_notes: string;
  created_at: string;
  created_by: { id: number; name: string } | null;
  versions: ModelVersion[];
  photos: ModelPhoto[];
  assembly_steps: AssemblyStep[];
};

/** 権限設定の1行 (permissions は実際に持っている権限。管理者は全権限) */
export type AdminUser = { id: number; name: string; email: string; role: Role; permissions: Permission[]; created_at: string };

/** 制作ボードのカード / 注文一覧の1行 */
export type OrderCard = {
  id: number;
  status: OrderStatus;
  status_label: string;
  total_cents: number;
  placed_at: string;
  paid_at: string | null;
  due_on: string | null;
  overdue: boolean;
  digital_only: boolean;
  user: { id: number; name: string; email: string };
  assignee: { id: number; name: string } | null;
  items: { product_id: number; name: string; quantity: number; is_digital: boolean }[];
};

export type OrderDetail = Omit<OrderCard, "items"> & {
  subtotal_cents: number;
  tax_cents: number;
  shipping_cents: number;
  materials_consumed_at: string | null;
  accepts_tips: boolean;
  tips: AdminTip[];
  address: { recipient: string; postal_code: string; prefecture: string; city: string; line1: string; line2?: string; phone?: string } | null;
  shipment: { status: string; carrier: string | null; tracking_number: string | null; shipped_at: string | null } | null;
  items: { product_id: number; sku: string; name: string; quantity: number; unit_price_cents: number; line_total_cents: number; is_digital: boolean }[];
  events: {
    status: OrderStatus; status_label: string; from_status: string | null; note: string; created_at: string;
    actor: { id: number; name: string } | null;
  }[];
};

export type ProductionBoard = {
  columns: { status: OrderStatus; label: string; orders: OrderCard[] }[];
  staff: StaffUser[];
  low_materials: { id: number; name: string; stock: number; unit: string }[];
};

export type Material = {
  id: number;
  code: string;
  name: string;
  unit: string;
  stock: number;
  reorder_point: number;
  unit_cost_cents: number;
  supplier: string;
  note: string;
  low: boolean;
  required_for_queue: number;
  projected_stock: number;
  products: { id: number; sku: string; name: string }[];
};

export type Recipe = {
  product_id: number;
  items: { material_id: number; name: string; unit: string; quantity: number }[];
};

export type Customer = {
  id: number;
  name: string;
  email: string;
  created_at: string;
  orders_count: number;
  total_spent_cents: number;
  last_order_at: string | null;
  open_requests_count: number;
};

export type CustomerDetail = Customer & {
  admin_note: string;
  addresses: { id: number; recipient: string; postal_code: string; prefecture: string; city: string; line1: string; line2?: string; is_default: boolean }[];
  orders: { id: number; status: OrderStatus; status_label: string; total_cents: number; placed_at: string; items: { name: string; quantity: number }[] }[];
  top_products: { product_id: number; name: string; quantity: number }[];
  requests: { id: number; kind: string; status: string; subject: string; created_at: string }[];
};

export type Analytics = {
  from: string;
  to: string;
  total_orders: number;
  total_revenue_cents: number;
  average_order_cents: number;
  by_day: { date: string; revenue_cents: number; orders: number }[];
  by_category: { slug: string; name: string; revenue_cents: number; quantity: number }[];
  top_products: { product_id: number; name: string; revenue_cents: number; quantity: number }[];
  customers: { buyers: number; repeat_buyers: number; repeat_rate: number; new_members: number };
  production: {
    wip: { status: OrderStatus; label: string; count: number }[];
    overdue: number;
    avg_lead_time_days: number | null;
    stage_hours: { status: OrderStatus; label: string; avg_hours: number | null; samples: number }[];
  };
};
