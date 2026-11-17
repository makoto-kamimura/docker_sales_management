// いま店頭で扱っているもの (販売中のカテゴリ・オーダーメイドの受付・定期便)。
// 販売するカテゴリは、管理画面の「商品管理」で切り替える。メニューや案内はこれを見て出し分ける。
// サーバーの画面からも使うので、ここには hook を置かない (クライアント用は useStorefront.ts)

import { api } from "@/lib/api";

export type Storefront = {
  categories: { id: number; slug: string; name: string; service: boolean }[];
  custom_orders: boolean;
  subscriptions: boolean;
};

/** 読み込めないときは null (呼び出し側は、案内を消さない側に倒す) */
export async function fetchStorefront(): Promise<Storefront | null> {
  try {
    return await api<Storefront>("/storefront");
  } catch {
    return null;
  }
}

export function sells(storefront: Storefront | null | undefined, slug: string) {
  return !!storefront?.categories.some((c) => c.slug === slug);
}
