"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      await register(email, password, name);
      router.push("/account");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white border rounded-xl p-6">
      <h1 className="text-xl font-bold mb-4">会員登録</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block">
          <span className="text-sm">お名前</span>
          <input required value={name} onChange={(e) => setName(e.target.value)}
                 className="mt-1 w-full rounded border px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm">メールアドレス</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                 className="mt-1 w-full rounded border px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm">パスワード (8文字以上)</span>
          <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
                 className="mt-1 w-full rounded border px-3 py-2" />
        </label>
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <button disabled={busy} className="w-full rounded bg-espresso text-white py-2 disabled:opacity-50">
          登録する
        </button>
      </form>
    </div>
  );
}
