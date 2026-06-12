export const ALLOWED_DOMAIN = "potomackco.com";
const GOOGLE_PROVIDER_ID = "google.com";

export function isAllowedWorkspaceEmail(email) {
  return typeof email === "string" && email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

export function hasGoogleIdentity(decodedToken) {
  const firebase = decodedToken?.firebase;
  const identities = firebase?.identities;
  return firebase?.sign_in_provider === GOOGLE_PROVIDER_ID
    || Boolean(identities && Object.prototype.hasOwnProperty.call(identities, GOOGLE_PROVIDER_ID));
}

export function hasGoogleProviderData(userRecord) {
  return Array.isArray(userRecord?.providerData)
    && userRecord.providerData.some((provider) => provider?.providerId === GOOGLE_PROVIDER_ID);
}

export function validateWorkspaceSignIn(decodedToken, userRecord) {
  const email = decodedToken?.email ?? userRecord?.email;
  if (!isAllowedWorkspaceEmail(email)) {
    return { ok: false, reason: "Email must be in the Potomack Workspace domain" };
  }
  if (decodedToken?.email_verified !== true || userRecord?.emailVerified !== true) {
    return { ok: false, reason: "Email must be verified by Google Workspace" };
  }
  if (!hasGoogleIdentity(decodedToken) || !hasGoogleProviderData(userRecord)) {
    return { ok: false, reason: "Google Workspace sign-in is required" };
  }
  return { ok: true };
}

export function workspaceCustomClaims(existingClaims = {}) {
  return {
    ...existingClaims,
    workspace: ALLOWED_DOMAIN,
    workspace_role: "authenticated",
  };
}

export function deactivatedCustomClaims(existingClaims = {}) {
  const { workspace, workspace_role, ...rest } = existingClaims;
  void workspace;
  void workspace_role;
  return {
    ...rest,
    is_active: false,
  };
}
