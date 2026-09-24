"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { adminHome } from "@/lib/permissions";

// /admin → 権限に応じた最初の画面へ (権限がなければレイアウトが案内を出す)
export default function AdminIndexPage() {
  const { user } = useAuth();
  const router = useRouter();
  useEffect(() => {
    const home = adminHome(user);
    if (home) router.replace(home);
  }, [user, router]);
  return null;
}
