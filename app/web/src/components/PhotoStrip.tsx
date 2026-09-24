/**
 * プレビュー表示の写真 (最大3枚) を並べる。1枚: 全面 / 2枚: 左右 / 3枚: 左に大きく1枚 + 右に2枚。
 * 高さは親 (className) で決める
 */
export function PhotoStrip({ photos, alt, className }: {
  photos: { id: number; url: string; caption?: string }[];
  alt: string;
  className?: string;
}) {
  const shown = photos.slice(0, 3);
  if (shown.length === 0) return null;
  const layout = shown.length === 1 ? "grid-cols-1" : shown.length === 2 ? "grid-cols-2" : "grid-cols-3 grid-rows-2";

  return (
    <div className={`grid gap-0.5 overflow-hidden bg-coffee-100 ${layout} ${className ?? ""}`}>
      {shown.map((p, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={p.id}
          src={p.url}
          alt={p.caption || `${alt} (写真 ${i + 1})`}
          loading="lazy"
          className={`h-full min-h-0 w-full object-cover ${shown.length === 3 && i === 0 ? "col-span-2 row-span-2" : ""}`}
        />
      ))}
    </div>
  );
}
