"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, jsonBody } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { PERMISSIONS, ROLE_LABEL, type Permission, type Role } from "@/lib/permissions";
import type { AdminUser } from "@/lib/adminTypes";

// スタッフ権限 (管理者のみ): ロールと 販売 / 制作 / 注文 の権限を設定する
export default function StaffPermissionsPage() {
  const { user: me, token } = useAuth();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const { data: users, mutate } = useSWR<AdminUser[]>(
    token ? ["admin-users", query] : null,
    () => api<AdminUser[]>(`/admin/users?per=100${query ? `&q=${encodeURIComponent(query)}` : ""}`, { auth: token })
  );
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState<number | null>(null);

  async function save(u: AdminUser, body: { role?: Role; permissions?: Permission[] }) {
    setErr(null);
    setSaving(u.id);
    try {
      const updated = await api<AdminUser>(`/admin/users/${u.id}`, { method: "PATCH", body: jsonBody(body), auth: token });
      mutate((list) => list?.map((x) => (x.id === u.id ? updated : x)), { revalidate: false });
    } catch (e) {
      setErr(`${u.name}: ${e instanceof Error ? e.message : "更新に失敗しました"}`);
      mutate();
    } finally {
      setSaving(null);
    }
  }

  function changeRole(u: AdminUser, role: Role) {
    if (role === "admin" && !window.confirm(`${u.name} を管理者にしますか？すべての管理機能と権限設定を使えるようになります。`)) return;
    save(u, { role });
  }

  function togglePermission(u: AdminUser, key: Permission, on: boolean) {
    const next = PERMISSIONS.map((p) => p.key).filter((k) => (k === key ? on : u.permissions.includes(k)));
    save(u, { permissions: next });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">スタッフ権限</h1>
          <p className="mt-1 text-sm text-coffee-500">スタッフごとに使える管理画面を設定します。管理者はすべての権限を持ちます。</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); }} className="flex flex-wrap items-end gap-2 text-sm">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="名前・メールで会員を検索" className="input !w-56"
                 aria-label="ユーザー検索" />
          <button className="btn btn-primary">検索</button>
          {query && (
            <button type="button" onClick={() => { setQ(""); setQuery(""); }} className="btn btn-outline">スタッフ一覧に戻る</button>
          )}
        </form>
      </div>

      <ul className="grid gap-3 sm:grid-cols-3">
        {PERMISSIONS.map((p) => (
          <li key={p.key} className="card p-4">
            <div className="font-semibold">{p.label}</div>
            <div className="mt-0.5 text-xs text-coffee-500">{p.description}</div>
          </li>
        ))}
      </ul>

      {err && <p role="alert" className="card border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-coffee-50 text-xs uppercase tracking-wide text-coffee-500">
            <tr>
              <th className="p-3 text-left font-semibold">ユーザー</th>
              <th className="p-3 text-left font-semibold">ロール</th>
              {PERMISSIONS.map((p) => <th key={p.key} className="p-3 text-center font-semibold">{p.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => {
              const self = u.id === me?.id;
              return (
                <tr key={u.id} className={`border-t border-coffee-100 ${saving === u.id ? "opacity-60" : ""}`}>
                  <td className="p-3">
                    <div className="font-medium">{u.name}{self && <span className="ml-1.5 text-xs text-coffee-400">(自分)</span>}</div>
                    <div className="text-xs text-coffee-400">{u.email} · 登録 {fmtDate(u.created_at)}</div>
                  </td>
                  <td className="p-3">
                    <select value={u.role} disabled={self || saving === u.id} onChange={(e) => changeRole(u, e.target.value as Role)}
                            className="input !w-auto !py-1" aria-label={`${u.name} のロール`}
                            title={self ? "自分自身のロールは変更できません" : undefined}>
                      {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                  </td>
                  {PERMISSIONS.map((p) => (
                    <td key={p.key} className="p-3 text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-caramel disabled:opacity-40"
                        checked={u.permissions.includes(p.key)}
                        // 管理者は常に全権限、会員は権限を持てない (スタッフにすると設定できる)
                        disabled={u.role !== "staff" || saving === u.id}
                        onChange={(e) => togglePermission(u, p.key, e.target.checked)}
                        aria-label={`${u.name} の${p.label}権限`}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {users && users.length === 0 && (
          <p className="p-8 text-center text-sm text-coffee-500">{query ? "該当するユーザーはいません" : "スタッフはまだいません。会員を検索してスタッフにできます"}</p>
        )}
      </div>
      <p className="text-xs text-coffee-400">
        会員をスタッフにするとチェックボックスで権限を選べます。変更は API に即時反映され、対象ユーザーの画面は再読み込み時にメニューが切り替わります。
      </p>
    </div>
  );
}
