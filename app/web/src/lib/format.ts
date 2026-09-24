export function yen(cents: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(cents);
}

export function fmtDate(s: string | undefined | null) {
  if (!s) return "";
  return new Date(s).toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" });
}

export function fileSize(bytes: number | null | undefined) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
