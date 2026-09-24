"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, ApiError, jsonBody, setAuthRefresher } from "./api";
import type { Permission, Role } from "./permissions";

/** member: 購入者 / staff: スタッフ (permissions の管理画面だけ) / admin: 店舗管理者 (permissions は全権限) */
export type User = { id: number; email: string; name: string; role: Role; permissions: Permission[] };
type Tokens = { access_token: string; refresh_token: string };
type Stored = Tokens & { user: User };

type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
};

const AuthCtx = createContext<AuthState | null>(null);

const STORAGE_KEY = "dr_auth";

function readStored(): Stored | null {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshing = useRef<Promise<string | null> | null>(null);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // リフレッシュトークン (7日) でアクセストークンを更新する。期限切れ・退会済みなどで更新できなければログアウトする。
  // 同時に複数のリクエストが 401 になっても更新は1回にまとめる
  const refreshAccessToken = useCallback(() => {
    if (refreshing.current) return refreshing.current;
    const p = (async () => {
      const stored = readStored();
      if (!stored?.refresh_token) {
        logout();
        return null;
      }
      try {
        const tokens = await api<Tokens>("/auth/refresh", {
          method: "POST",
          body: jsonBody({ refresh_token: stored.refresh_token }),
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, ...tokens }));
        setToken(tokens.access_token);
        return tokens.access_token;
      } catch (e) {
        if (e instanceof ApiError) logout(); // 通信エラーのときはログイン状態を保つ
        return null;
      }
    })();
    refreshing.current = p;
    p.finally(() => { if (refreshing.current === p) refreshing.current = null; });
    return p;
  }, [logout]);

  useEffect(() => {
    setAuthRefresher(refreshAccessToken);
    const stored = readStored();
    if (stored) {
      setToken(stored.access_token);
      setUser(stored.user);
      // ロール・権限は管理者が変更し得るので、保存済みのユーザー情報を最新にする (トークン切れなら更新される)
      api<User>("/me", { auth: stored.access_token })
        .then((me) => {
          const current = readStored();
          if (!current) return; // ログアウト済み
          setUser(me);
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, user: me }));
        })
        .catch(() => { /* 更新できなければ refreshAccessToken がログアウトさせる */ });
    }
    setLoading(false);
    return () => setAuthRefresher(null);
  }, [refreshAccessToken]);

  const persist = useCallback((tokens: Tokens, u: User) => {
    setToken(tokens.access_token);
    setUser(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...tokens, user: u }));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<Tokens & { user: User }>("/auth/login", {
      method: "POST",
      body: jsonBody({ email, password }),
    });
    persist(data, data.user);
  }, [persist]);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const data = await api<Tokens & { user: User }>("/auth/register", {
      method: "POST",
      body: jsonBody({ email, password, name }),
    });
    persist(data, data.user);
  }, [persist]);

  return (
    <AuthCtx.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
