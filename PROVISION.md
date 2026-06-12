# v1.4 Migration Provisioning

Do not run `gcloud` or `firebase` CLI from the worker. Run these commands from a trusted local shell with billing enabled on project `gen-lang-client-0662587427` ("Potomack App").

## Phase 1 Auth Baseline

1. In Firebase Authentication, confirm Google is enabled as a sign-in provider.
2. Add `app.potomackco.com` to Firebase Authentication authorized domains. Keep the Firebase default domains.
3. In Google Cloud OAuth consent settings, confirm the app is internal or restricted to The Potomack Co. Workspace users.
4. Copy the Firebase web config into app deployment env:

```bash
VITE_AUTH_BACKEND=supabase
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=gen-lang-client-0662587427.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=gen-lang-client-0662587427
VITE_FIREBASE_STORAGE_BUCKET=gen-lang-client-0662587427.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Keep `VITE_AUTH_BACKEND=supabase` for staff until the Phase 2 PostgREST and `cataloger-api` services are deployed and smoke-tested.

## Cloud SQL

```bash
gcloud config set project gen-lang-client-0662587427
gcloud services enable sqladmin.googleapis.com run.googleapis.com secretmanager.googleapis.com artifactregistry.googleapis.com
gcloud artifacts repositories create potomack \
  --repository-format=docker \
  --location=us-central1 \
  --description="Potomack app Cloud Run images"

gcloud sql instances create potomack-cataloger-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --storage-type=HDD \
  --storage-size=10GB \
  --availability-type=zonal \
  --no-backup

DB_PASSWORD="$(openssl rand -base64 32)"
gcloud sql databases create cataloger --instance=potomack-cataloger-db
gcloud sql users create cataloger_app --instance=potomack-cataloger-db --password="$DB_PASSWORD"
```

Store the connection string and service credentials:

```bash
printf '%s' "postgres://cataloger_app:${DB_PASSWORD}@/cataloger?host=/cloudsql/gen-lang-client-0662587427:us-central1:potomack-cataloger-db" \
  | gcloud secrets create cataloger-postgres-uri --data-file=-

gcloud iam service-accounts create cataloger-postgrest \
  --display-name="Cataloger PostgREST"
gcloud iam service-accounts create cataloger-api \
  --display-name="Cataloger API"
gcloud projects add-iam-policy-binding gen-lang-client-0662587427 \
  --member="serviceAccount:cataloger-postgrest@gen-lang-client-0662587427.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"
gcloud projects add-iam-policy-binding gen-lang-client-0662587427 \
  --member="serviceAccount:cataloger-api@gen-lang-client-0662587427.iam.gserviceaccount.com" \
  --role="roles/firebaseauth.admin"
gcloud secrets add-iam-policy-binding cataloger-postgres-uri \
  --member="serviceAccount:cataloger-postgrest@gen-lang-client-0662587427.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Apply schema from a trusted machine that can reach Cloud SQL:

```bash
for f in db/migrations/*.sql; do
  psql "$CATALOGER_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
```

The first migration sets `cataloger_app` to `NOINHERIT` and grants it `anon` and `authenticated` membership. NOINHERIT means the login role can only use those privileges via explicit `SET ROLE` (what PostgREST does per request) — it never holds them passively. Keep this before the PostgREST deploy: PostgREST connects as `cataloger_app` and must be allowed to `SET ROLE anon` or `SET ROLE authenticated` for request-scoped database access.

## Firebase JWKS for PostgREST

PostgREST reads the Firebase Secure Token JWKS from the `PGRST_JWT_SECRET` environment variable, injected from Secret Manager. The Firebase project audience is `PGRST_JWT_AUD=gen-lang-client-0662587427`. Fetch the current JWKS and redeploy PostgREST when Google rotates keys.

```bash
curl -fsSL https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com \
  | gcloud secrets create firebase-securetoken-jwks --data-file=-
gcloud secrets add-iam-policy-binding firebase-securetoken-jwks \
  --member="serviceAccount:cataloger-postgrest@gen-lang-client-0662587427.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

The app mints `workspace=potomackco.com` and `workspace_role=authenticated` via `cataloger-api`. PostgREST maps only `.workspace_role` to the database role; tokens lacking it fall back to `anon`, which has no cataloger table grants.

## Cloud Run Deploys

Build and deploy PostgREST:

```bash
gcloud builds submit --config=postgrest/cloudbuild.yaml .

gcloud run deploy cataloger-postgrest \
  --image=us-central1-docker.pkg.dev/gen-lang-client-0662587427/potomack/postgrest \
  --region=us-central1 \
  --allow-unauthenticated \
  --service-account=cataloger-postgrest@gen-lang-client-0662587427.iam.gserviceaccount.com \
  --add-cloudsql-instances=gen-lang-client-0662587427:us-central1:potomack-cataloger-db \
  --set-env-vars=PGRST_JWT_AUD=gen-lang-client-0662587427,PGRST_OPENAPI_SERVER_PROXY_URI=https://cataloger-postgrest-REPLACE.a.run.app \
  --set-secrets=PGRST_DB_URI=cataloger-postgres-uri:latest,PGRST_JWT_SECRET=firebase-securetoken-jwks:latest
```

Build and deploy `cataloger-api`:

```bash
gcloud builds submit --config=cataloger-api/cloudbuild.yaml .

gcloud run deploy cataloger-api \
  --image=us-central1-docker.pkg.dev/gen-lang-client-0662587427/potomack/cataloger-api \
  --region=us-central1 \
  --allow-unauthenticated \
  --service-account=cataloger-api@gen-lang-client-0662587427.iam.gserviceaccount.com \
  --set-env-vars=FIREBASE_PROJECT_ID=gen-lang-client-0662587427,CATALOGER_API_ALLOWED_ORIGINS=https://app.potomackco.com\\,https://gen-lang-client-0662587427.web.app
```

## App Env Flip

After smoke tests pass:

```bash
VITE_AUTH_BACKEND=firebase
VITE_POSTGREST_URL=https://cataloger-postgrest-REPLACE.a.run.app
VITE_CATALOGER_API_URL=https://cataloger-api-REPLACE.a.run.app
```

`VITE_POSTGREST_ANON_KEY` is optional in Firebase mode and defaults to a placeholder because standalone PostgREST does not require a Supabase anon key.
