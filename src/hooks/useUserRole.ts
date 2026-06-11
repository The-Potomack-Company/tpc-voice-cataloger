import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "../stores/authStore";
import { supabase } from "../lib/supabase";
import { isFirebaseAuthBackend } from "../lib/authBackend";
import { roleFromFirebaseClaims, type AppUser } from "../lib/firebaseAuth";
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
  const userId = user?.id;
  const isFirebaseAuth = isFirebaseAuthBackend();
  const firebaseRole = isFirebaseAuth ? roleFromFirebaseClaims(user as AppUser) : null;
  const [role, setRole] = useState<string | null | undefined>(undefined);
  // Bump to force the effect to re-run (retry affordance on the surfaced toast).
  const [reloadKey, setReloadKey] = useState(0);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!userId) return;
    if (isFirebaseAuth) return;

    let cancelled = false;
    supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
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
    // WR-02: key on userId (stable across auth-store object replacement on token
    // refresh) and DON'T setRole(undefined) on cleanup — a same-id refresh would
    // otherwise blank the role, flip loading true, and momentarily drop isAdmin,
    // churning admin-only UI. The `cancelled` flag alone discards stale
    // resolutions; this stays fail-closed (a real id change unmounts/refetches).
    return () => {
      cancelled = true;
    };
  }, [isFirebaseAuth, userId, reloadKey, retry]);

  if (isFirebaseAuth) {
    return {
      role: firebaseRole,
      isAdmin: firebaseRole === "admin",
      loading: false,
      error: false,
      retry,
    };
  }

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
