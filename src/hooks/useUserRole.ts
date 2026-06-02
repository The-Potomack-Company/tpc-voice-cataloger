import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "../stores/authStore";
import { supabase } from "../lib/supabase";
import { useNotificationStore } from "../stores/notificationStore";
import { toUserMessage } from "../lib/toUserMessage";

// SC4 / ASVS V4: a role-load FAILURE must be distinguishable from a legitimate
// "not admin" (null role). We model role as:
//   undefined → loading
//   string|null → resolved (null = not admin)
//   ROLE_ERROR sentinel → the fetch failed (fail closed: never "admin")
// The sentinel is a non-"admin" string so isAdmin (role === "admin") stays false
// on error, while letting callers tell a load failure apart from not-admin.
const ROLE_ERROR = "__role_error__";

export function useUserRole(): {
  role: string | null;
  isAdmin: boolean;
  loading: boolean;
  error: boolean;
  retry: () => void;
} {
  const user = useAuthStore((s) => s.user);
  const [role, setRole] = useState<string | null | undefined>(undefined);
  // Bump to force the effect to re-run (retry affordance on the surfaced toast).
  const [reloadKey, setReloadKey] = useState(0);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

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
          // Fail closed — keep isAdmin false (ROLE_ERROR !== "admin") and signal
          // the failure rather than silently demoting to not-admin. Surface only
          // on a definite error (here, an actual Supabase error), via the
          // toUserMessage funnel so raw backend text never reaches the user.
          setRole(ROLE_ERROR);
          useNotificationStore
            .getState()
            .notifyError(toUserMessage(error), retry);
        } else {
          setRole(data?.role ?? null);
        }
      });
    return () => {
      cancelled = true;
      setRole(undefined);
    };
  }, [user, reloadKey, retry]);

  const loading = !!user && role === undefined;
  const error = role === ROLE_ERROR;

  return {
    // Never leak the sentinel to callers as a real role.
    role: error || role === undefined ? null : role,
    isAdmin: role === "admin",
    loading,
    error,
    retry,
  };
}
