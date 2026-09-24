// 注文の制作・発送フロー (API の Order::STATUSES と対応)
//   注文受付 → 入金確認 → 制作待ち → 制作中 → 検品 → 発送準備 → 発送済み → 完了

export const ORDER_FLOW = [
  "received", "paid", "awaiting_production", "in_production", "inspection", "ready_to_ship", "shipped", "completed",
] as const;

export type OrderStatus = (typeof ORDER_FLOW)[number] | "cancelled";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  received: "注文受付",
  paid: "入金確認",
  awaiting_production: "制作待ち",
  in_production: "制作中",
  inspection: "検品",
  ready_to_ship: "発送準備",
  shipped: "発送済み",
  completed: "完了",
  cancelled: "キャンセル",
};

/** デジタル商品のみの注文は制作・発送がない */
export const DIGITAL_FLOW: OrderStatus[] = ["received", "paid", "completed"];

export function orderStatusBadge(status: string) {
  if (status === "completed" || status === "shipped") return "badge-success";
  if (status === "cancelled") return "badge-muted";
  return "badge-accent";
}

// --- 問い合わせ / オーダーメイド依頼 ---------------------------------------

export const REQUEST_KIND_LABEL: Record<string, string> = { inquiry: "問い合わせ", custom: "オーダーメイド" };

export const REQUEST_STATUSES: Record<string, string[]> = {
  inquiry: ["pending", "answered", "closed"],
  custom: ["pending", "quoted", "in_progress", "completed", "cancelled"],
};

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  pending: "受付待ち",
  answered: "回答済み",
  closed: "解決",
  quoted: "見積提示",
  in_progress: "制作中",
  completed: "完了",
  cancelled: "キャンセル",
};

export function requestStatusBadge(status: string) {
  if (["completed", "answered", "closed"].includes(status)) return "badge-success";
  if (status === "cancelled") return "badge-muted";
  return "badge-accent";
}
