"use client";

import { useState } from "react";
import { api, jsonBody } from "@/lib/api";
import type { Tip } from "@/lib/types";

/** 店舗側の投げ銭の操作 (入金確認 / 取り消し / 入金待ちに戻す) */
export function TipActions({ tip, token, onDone, onError }: {
  tip: Pick<Tip, "id" | "status" | "amount_cents">;
  token: string | null;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function update(status: Tip["status"], confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    try {
      await api(`/admin/tips/${tip.id}`, { method: "PATCH", body: jsonBody({ status }), auth: token });
      onDone();
    } catch (e) {
      onError(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  const button = "btn btn-outline !px-2.5 !py-1 text-xs";
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {tip.status === "pending" && (
        <>
          <button type="button" disabled={busy} onClick={() => update("paid")} className="btn btn-primary !px-2.5 !py-1 text-xs">入金確認</button>
          <button type="button" disabled={busy} onClick={() => update("cancelled", "この投げ銭を取り消しますか？")} className={button}>取り消し</button>
        </>
      )}
      {tip.status !== "pending" && (
        <button type="button" disabled={busy} onClick={() => update("pending", "入金待ちに戻しますか？")} className={button}>入金待ちに戻す</button>
      )}
    </div>
  );
}
