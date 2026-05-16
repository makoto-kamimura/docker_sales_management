"use client";

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
  logout: () => void;
};

const AuthCtx = createContext<AuthState | null>(null);

const STORAGE_KEY = "dr_auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!saved) {
      setLoading(false);
      return;
    }
    try {
      const { access_token, user } = JSON.parse(saved);
      setToken(access_token);
      setUser(user);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(STORAGE_KEY);
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
