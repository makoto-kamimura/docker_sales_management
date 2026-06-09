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
    <div className="max-w-md mx-auto card p-7 sm:p-8">
      <div className="text-center mb-6">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-caramel text-xs font-bold tracking-wide text-white shadow-soft">R&amp;R</div>
        <h1 className="text-xl font-bold mt-3">会員登録</h1>
        <p className="text-sm text-coffee-500 mt-1">はじめての方はこちら</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="field-label">お名前</span>
          <input required value={name} onChange={(e) => setName(e.target.value)}
                 className="input" />
        </label>
        <label className="block">
          <span className="field-label">メールアドレス</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                 className="input" />
        </label>
        <label className="block">
          <span className="field-label">パスワード (8文字以上)</span>
          <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
                 className="input" />
        </label>
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <button disabled={busy} className="btn btn-accent w-full">
          登録する
        </button>
      </form>
    </div>
  );
}
