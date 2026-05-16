"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { api, jsonBody } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Address } from "@/lib/types";

export default function AccountPage() {
  const { user, token } = useAuth();
  const { data: addresses, mutate } = useSWR<Address[]>(
    token ? "addresses" : null,
    () => api<Address[]>("/me/addresses", { auth: token })
  );
  const [form, setForm] = useState<Partial<Address>>({ label: "self", is_default: true });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { setErr(null); }, [form]);

  if (!user) return <p>ログインが必要です。</p>;

  async function addAddress(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/me/addresses", { method: "POST", body: jsonBody(form), auth: token });
      mutate();
      setForm({ label: "self", is_default: true });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    }
  }

  return (
    <div className="space-y-6">
      <section className="bg-white border rounded-xl p-6">
        <h1 className="text-xl font-bold mb-2">アカウント</h1>
        <dl className="text-sm grid grid-cols-[6rem_1fr] gap-y-1">
          <dt className="text-coffee-500">氏名</dt><dd>{user.name}</dd>
          <dt className="text-coffee-500">メール</dt><dd>{user.email}</dd>
          <dt className="text-coffee-500">権限</dt><dd>{user.role}</dd>
        </dl>
      </section>

      <section className="bg-white border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">住所</h2>
        <ul className="space-y-2">
          {addresses?.map((a) => (
            <li key={a.id} className="border rounded p-3 text-sm">
              <div className="font-medium">{a.recipient} {a.is_default && <span className="text-xs text-emerald-700">[既定]</span>}</div>
              <div className="text-coffee-600">〒{a.postal_code} {a.prefecture}{a.city}{a.line1}{a.line2 ?? ""}</div>
            </li>
          ))}
          {addresses && addresses.length === 0 && <li className="text-sm text-coffee-500">登録された住所はありません</li>}
        </ul>

        <details>
          <summary className="cursor-pointer text-sm">新しい住所を追加</summary>
          <form onSubmit={addAddress} className="grid grid-cols-2 gap-2 mt-3 text-sm">
            <input placeholder="宛名" required value={form.recipient ?? ""} onChange={(e) => setForm({ ...form, recipient: e.target.value })} className="border rounded px-2 py-1 col-span-2" />
            <input placeholder="郵便番号 (100-0001)" required value={form.postal_code ?? ""} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} className="border rounded px-2 py-1" />
            <input placeholder="都道府県" required value={form.prefecture ?? ""} onChange={(e) => setForm({ ...form, prefecture: e.target.value })} className="border rounded px-2 py-1" />
            <input placeholder="市区町村" required value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} className="border rounded px-2 py-1 col-span-2" />
            <input placeholder="住所1" required value={form.line1 ?? ""} onChange={(e) => setForm({ ...form, line1: e.target.value })} className="border rounded px-2 py-1 col-span-2" />
            <input placeholder="住所2" value={form.line2 ?? ""} onChange={(e) => setForm({ ...form, line2: e.target.value })} className="border rounded px-2 py-1 col-span-2" />
            <input placeholder="電話" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="border rounded px-2 py-1 col-span-2" />
            {err && <p className="text-rose-600 col-span-2">{err}</p>}
            <button className="col-span-2 rounded bg-espresso text-white py-2">追加</button>
          </form>
        </details>
      </section>
    </div>
  );
}
