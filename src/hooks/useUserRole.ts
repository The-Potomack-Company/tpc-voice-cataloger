import { useState, useEffect } from "react";
import { useAuthStore } from "../stores/authStore";
import { supabase } from "../lib/supabase";

export function useUserRole(): {
  role: string | null;
  isAdmin: boolean;
  loading: boolean;
} {
  const user = useAuthStore((s) => s.user);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          setRole(null);
        } else {
          setRole(data?.role ?? null);
        }
        setLoading(false);
      });
  }, [user]);

  return { role, isAdmin: role === "admin", loading };
}
