/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_BACKEND?: "supabase" | "firebase";
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_POSTGREST_URL?: string;
  readonly VITE_POSTGREST_ANON_KEY?: string;
  readonly VITE_CATALOGER_API_URL?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FEATURE_CONTINUOUS_CAPTURE?: string;
  readonly VITE_FEATURE_PHOTO_NOTES?: string;
}

interface ImportMetaEnv {
  readonly VITE_AUTH_BACKEND?: "firebase" | "supabase";
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FEATURE_CONTINUOUS_CAPTURE?: string;
  readonly VITE_FEATURE_PHOTO_NOTES?: string;
}
