import { yen } from "@/lib/format";
import type { ModelAssetSummary } from "@/lib/adminTypes";

/** 最新版の表示 (例: v2.1 · STL/3MF · 3ファイル) */
export function versionLabel(v: NonNullable<ModelAssetSummary["current_version"]>) {
  return `v${v.label} · ${v.formats.join("/")}${v.files_count > 1 ? ` · ${v.files_count}ファイル` : ""}`;
}

/** 販売フラグとショップでの公開状態 */
export function ModelSaleBadge({ model }: { model: ModelAssetSummary }) {
  return model.for_sale && model.product?.published ? (
    <span className="badge badge-success shrink-0">
      {model.price_cents === 0 ? "無料配布中" : `販売中 ${yen(model.price_cents)}`}
    </span>
  ) : (
    <span className="badge shrink-0 bg-coffee-100 text-coffee-600">非公開</span>
  );
}
