import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, jsonBody } from "./api";

type User = { id: number; email: string; name: string; role: "member" | "admin" };
type Tokens = { access_token: string; refresh_token: string };
type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);
const KEY = "dr_auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  const logout = useCallback(async () => {
    setUser(null); setToken(null);
    await AsyncStorage.removeItem(KEY);
  }, []);

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
