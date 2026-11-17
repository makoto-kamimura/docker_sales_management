"use client";

import useSWR from "swr";
import { api } from "@/lib/api";
import { customOrderStarter, openConcierge, useConciergeSettings } from "@/lib/concierge";
import type { Product } from "@/lib/types";

/**
 * オーダーメイドの画面の「AIコンシェルジュを通してオーダーする」。
 * チャットを開いて相談を始め、AI が内容をまとめた依頼書で依頼できる。AIコンシェルジュが使えないときは出さない
 */
export function ConciergeOrderButton({ productId }: { productId?: string }) {
  const settings = useConciergeSettings();
  const validId = productId && /^\d+$/.test(productId) ? productId : null;
  const { data: product } = useSWR<Product>(validId ? `product-${validId}` : null, () => api<Product>(`/products/${validId}`), {
    shouldRetryOnError: false,
  });
  if (!settings?.enabled) return null;

  return (
    <>
      <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-coffee-900">AIコンシェルジュと相談してオーダー</div>
          <p className="mt-1 text-sm leading-relaxed text-coffee-500">
            つくりたいもののイメージを伝えると、AIが用途・サイズ・素材などを聞き取り、依頼書にまとめます。
            内容を確かめて「はい」を押すと、そのまま依頼できます。
          </p>
        </div>
        <button
          type="button"
          onClick={() => openConcierge({ starter: customOrderStarter(product?.name) })}
          className="btn btn-accent shrink-0"
        >
          AIコンシェルジュを通してオーダーする
        </button>
      </div>
      <div className="flex items-center gap-3 text-xs text-coffee-400" role="separator">
        <span className="h-px flex-1 bg-coffee-200" />
        または フォームに書いて依頼
        <span className="h-px flex-1 bg-coffee-200" />
      </div>
    </>
  );
}
