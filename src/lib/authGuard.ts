import { supabase } from "../lib/supabase";
import { isFirebaseAuthBackend } from "./authBackend";
import { getFreshFirebaseIdToken } from "./firebaseAuth";

const REFRESH_WINDOW_SECONDS = 60;

export async function ensureFreshSession(): Promise<string> {
  if (isFirebaseAuthBackend()) {
    return getFreshFirebaseIdToken();
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("No active session — user must sign in");
  }

  const expiresAt = session.expires_at;
  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (typeof expiresAt !== "number" || expiresAt - nowInSeconds <= REFRESH_WINDOW_SECONDS) {
    const { error } = await supabase.auth.refreshSession();
    if (error) {
      throw error;
    }
  }

  // Re-read getSession after a possible refresh: it is the reliable source for the
  // current access token (refreshSession's returned session is not relied upon).
  const {
    data: { session: freshSession },
  } = await supabase.auth.getSession();

  const accessToken = freshSession?.access_token;
  if (!accessToken) {
    throw new Error("Session has no access token");
  }

  return accessToken;
}
