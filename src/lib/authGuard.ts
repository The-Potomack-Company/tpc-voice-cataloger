import { supabase } from "../lib/supabase";

const REFRESH_WINDOW_SECONDS = 60;

export async function ensureFreshSession(): Promise<void> {
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
}
