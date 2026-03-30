import { useState, useEffect } from "react";
import { useAuthStore } from "../stores/authStore";
import { supabase } from "../lib/supabase";

export function useUserRole(): {
  role: string | null;
  isAdmin: boolean;
  loading: boolean;
} {
  const user = useAuthStore((s) => s.user);
  const [role, setRole] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setRole(null);
        } else {
          setRole(data?.role ?? null);
        }
      });
    return () => { cancelled = true; setRole(undefined); };
  }, [user]);

  const loading = !!user && role === undefined;

  return { role: role ?? null, isAdmin: role === "admin", loading };
}
