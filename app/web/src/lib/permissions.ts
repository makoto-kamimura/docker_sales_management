// 管理画面の権限: スタッフごとに 販売 / 制作 / 注文 を付与する (管理者はすべて + 権限設定)
import type { User } from "./auth";

export type Role = "member" | "staff" | "admin";
export type Permission = "sales" | "production" | "orders";

export const ROLE_LABEL: Record<Role, string> = { member: "会員", staff: "スタッフ", admin: "管理者" };

export const PERMISSIONS: { key: Permission; label: string; description: string }[] = [
  { key: "sales", label: "販売", description: "商品管理・在庫・売上分析" },
  { key: "production", label: "制作", description: "制作ボード・材料管理・3Dモデル (製作担当に指定できる)" },
  { key: "orders", label: "注文", description: "注文管理・発送・顧客管理・問い合わせ・投げ銭" },
];

type AdminGroup = { label: string; permission: Permission | "admin"; links: { href: string; label: string }[] };

export const ADMIN_GROUPS: AdminGroup[] = [
  { label: "販売", permission: "sales", links: [{ href: "/admin/products", label: "商品管理" }, { href: "/admin/dashboard", label: "売上・分析" }] },
  { label: "制作", permission: "production", links: [{ href: "/admin/production", label: "制作ボード" }, { href: "/admin/materials", label: "材料管理" }, { href: "/admin/models", label: "3Dモデル" }] },
  {
    label: "注文", permission: "orders",
    links: [
      { href: "/admin/orders", label: "注文管理" }, { href: "/admin/customers", label: "顧客管理" },
      { href: "/admin/requests", label: "問い合わせ" }, { href: "/admin/tips", label: "投げ銭" },
    ],
  },
  { label: "設定", permission: "admin", links: [{ href: "/admin/users", label: "スタッフ権限" }] },
];

/** 権限を持つか ("admin" は管理者のみ)。管理者はすべての権限を持つ */
export function can(user: User | null, permission: Permission | "admin") {
  if (!user) return false;
  if (user.role === "admin") return true;
  return permission !== "admin" && user.role === "staff" && (user.permissions ?? []).includes(permission);
}

export function adminGroupsFor(user: User | null) {
  return ADMIN_GROUPS.filter((g) => can(user, g.permission));
}

/** 管理画面で最初に開く画面 (使える画面がなければ null) */
export function adminHome(user: User | null) {
  return adminGroupsFor(user)[0]?.links[0].href ?? null;
}

export function permissionLabels(permissions: Permission[]) {
  return PERMISSIONS.filter((p) => permissions.includes(p.key)).map((p) => p.label).join("・");
}
