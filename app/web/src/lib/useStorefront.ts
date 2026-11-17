"use client";

import useSWR from "swr";
import { api } from "@/lib/api";
import type { Storefront } from "@/lib/storefront";

/** 店頭の状態 (クライアント用)。読み込み中・読み込めないときは undefined で、呼び出し側は出し分けの項目を出さないでおく */
export function useStorefront(): Storefront | undefined {
  const { data } = useSWR("storefront", () => api<Storefront>("/storefront"), { revalidateOnFocus: false });
  return data;
}
