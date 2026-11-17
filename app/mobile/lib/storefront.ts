// いま店頭で扱っているもの (販売中のカテゴリ・オーダーメイドの受付・定期便)。
// 販売するカテゴリは Web の管理画面で切り替える。タブやボタンはこれを見て出し分ける

import { useEffect, useState } from 'react';

import { api } from '@/lib/api';

export type Storefront = {
  categories: { id: number; slug: string; name: string; service: boolean }[];
  custom_orders: boolean;
  subscriptions: boolean;
};

/** 読み込み中・読み込めないときは undefined (呼び出し側は、出し分けの項目を出さないでおく) */
export function useStorefront(): Storefront | undefined {
  const [storefront, setStorefront] = useState<Storefront>();
  useEffect(() => {
    let cancelled = false;
    api<Storefront>('/storefront')
      .then((s) => { if (!cancelled) setStorefront(s); })
      .catch(() => { /* つながらないときは出さない */ });
    return () => { cancelled = true; };
  }, []);
  return storefront;
}
