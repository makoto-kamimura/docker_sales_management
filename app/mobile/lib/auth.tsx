import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ApiError, api, jsonBody, setAuthRefresher } from "./api";

type User = { id: number; email: string; name: string; role: "member" | "admin" };
type Tokens = { access_token: string; refresh_token: string };
type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  /** SSO でログインしたときに、交換で受け取ったトークンを保存する */
  adopt: (tokens: Tokens, user: User) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);
const KEY = "dr_auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshing = useRef<Promise<string | null> | null>(null);

  const logout = useCallback(async () => {
    setUser(null); setToken(null);
    await AsyncStorage.removeItem(KEY);
  }, []);

  // リフレッシュトークン (7日) でアクセストークンを更新する。期限切れ・退会済みなどで更新できなければログアウトする。
  // 同時に複数のリクエストが 401 になっても更新は1回にまとめる
  const refreshAccessToken = useCallback(() => {
    if (refreshing.current) return refreshing.current;
    const p = (async () => {
      let stored: (Tokens & { user: User }) | null = null;
      try {
        stored = JSON.parse((await AsyncStorage.getItem(KEY)) ?? "null");
      } catch { /* 壊れた保存内容はログアウト扱い */ }
      if (!stored?.refresh_token) {
        await logout();
        return null;
      }
      try {
        const tokens = await api<Tokens>("/auth/refresh", {
          method: "POST", body: jsonBody({ refresh_token: stored.refresh_token }),
        });
        await AsyncStorage.setItem(KEY, JSON.stringify({ ...stored, access_token: tokens.access_token, refresh_token: tokens.refresh_token }));
        setToken(tokens.access_token);
        return tokens.access_token;
      } catch (e) {
        if (e instanceof ApiError) await logout(); // 通信エラーのときはログイン状態を保つ
        return null;
      }
    })();
    refreshing.current = p;
    p.finally(() => { if (refreshing.current === p) refreshing.current = null; });
    return p;
  }, [logout]);

  useEffect(() => {
    setAuthRefresher(refreshAccessToken);
    return () => setAuthRefresher(null);
  }, [refreshAccessToken]);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(KEY);
        if (saved) {
          const { access_token, user } = JSON.parse(saved);
          setToken(access_token);
          setUser(user);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (tokens: Tokens, u: User) => {
    setToken(tokens.access_token);
    setUser(u);
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...tokens, user: u }));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<Tokens & { user: User }>("/auth/login", {
      method: "POST", body: jsonBody({ email, password }),
    });
    await persist(data, data.user);
  }, [persist]);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const data = await api<Tokens & { user: User }>("/auth/register", {
      method: "POST", body: jsonBody({ email, password, name }),
    });
    await persist(data, data.user);
  }, [persist]);

  return (
    <AuthCtx.Provider value={{ user, token, loading, login, register, adopt: persist, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
