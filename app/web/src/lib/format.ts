export function yen(cents: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(cents);
}

export function fmtDate(s: string | undefined | null) {
  if (!s) return "";
  return new Date(s).toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" });
}
