# v1.4 Phase 1 Provisioning

Do not run `gcloud` or `firebase` CLI from the worker. Perform these console steps manually.

## Firebase Auth

1. In GCP project `gen-lang-client-0662587427` / Firebase app "Potomack App", open Authentication.
2. Confirm Google is enabled as a sign-in provider.
3. Add `app.potomackco.com` to Firebase Authentication authorized domains. Keep the Firebase default domains.
4. In Google Cloud OAuth consent settings, confirm the app is internal or otherwise restricted to The Potomack Co. Workspace users.
5. In Firebase project settings, open the web app named `tpc-hub` and copy the public web config into deployment env:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

## Auth Backend Flag

Keep `VITE_AUTH_BACKEND=supabase` for staff until Phase 2 is deployed.

The Phase 1 Firebase login path is intentionally dark-launched. Firebase ID tokens cannot satisfy current Supabase RLS, so normal data calls still require the Supabase auth backend until the PostgREST/Cloud SQL data path lands in Phase 2.

## Firebase Role Claims

Preferred custom claim shape:

```json
{
  "role": "admin",
  "is_active": true
}
```

Accepted forward-compatible variants:

```json
{ "admin": true, "is_active": true }
{ "roles": ["admin"], "is_active": true }
```

If no admin claim is present, an authenticated `@potomackco.com` user falls back to `specialist`. `is_active: false` always denies role access. Admin access is never granted by fallback.

## Domain Restriction

The app sends Google OAuth `hd=potomackco.com` during popup sign-in and checks the signed-in Firebase user after login. Users outside `@potomackco.com`, or tokens with an incompatible `hd` claim, are immediately signed out.
