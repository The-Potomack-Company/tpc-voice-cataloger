export type AuthBackend = "supabase" | "firebase";

export function getAuthBackend(): AuthBackend {
  return import.meta.env.VITE_AUTH_BACKEND === "firebase" ? "firebase" : "supabase";
}

export function isFirebaseAuthBackend(): boolean {
  return getAuthBackend() === "firebase";
}
