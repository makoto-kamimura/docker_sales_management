import { FILE_CATEGORIES } from "@/lib/modelKinds";

/** 版に登録するファイル欄 (カテゴリごと: オールインワン / 分割 / その他)。どれか1つ以上に選べばよい */
export function CategorizedFileInputs({ accept, className = "" }: { accept: string; className?: string }) {
  return (
    <div className={`grid gap-2 sm:grid-cols-3 ${className}`}>
      {FILE_CATEGORIES.map((c) => (
        <label key={c.key} className="block min-w-0">
          <span className="field-label">
            {c.label} <span className="font-normal text-coffee-400">({c.hint})</span>
          </span>
          <input type="file" name={c.param} multiple accept={accept} aria-label={`${c.label}のファイル (複数選択可)`}
                 className="input text-xs" />
        </label>
      ))}
    </div>
  );
}

/** カテゴリのファイル欄のどれかでファイルを選んだか (空の欄は送らない) */
export function takeCategorizedFiles(data: FormData): boolean {
  let any = false;
  for (const { param } of FILE_CATEGORIES) {
    const files = data.getAll(param).filter((f): f is File => f instanceof File && f.size > 0);
    data.delete(param);
    files.forEach((f) => data.append(param, f));
    if (files.length > 0) any = true;
  }
  return any;
}
