/**
 * src/constants/devUsers.ts
 *
 * Centralized allowlist of developer/test user UUIDs whose data must be
 * filtered out of admin/analytics views to keep dogfood traffic from
 * polluting production-facing aggregates.
 *
 * Behavior:
 *   - When ANOTHER admin (e.g. Jeff) is viewing cross-user data, sessions /
 *     items / events whose owning user (`created_by` or `assigned_to` for
 *     sessions, `user_id` for events) is in this list are excluded.
 *   - The dev user himself still sees his OWN data normally. The filter is
 *     applied to *cross-user* aggregates only.
 *
 * Add more UUIDs here as the dogfood allowlist grows. One-place edit.
 */

/** Josh Maserin (admin) — confirmed via Supabase profiles query. */
export const JOSH_USER_ID = "a70ae46e-5d51-47cb-9dff-a6a8a7a08bfd";

/** All dev/dogfood user UUIDs. */
export const DEV_USER_IDS: readonly string[] = [JOSH_USER_ID];

/** Membership check. */
export function isDevUser(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return DEV_USER_IDS.includes(userId);
}

/**
 * Filter helper for sessions in cross-user admin views.
 *
 * - `viewerId` is the currently authenticated user's UUID. The viewer
 *   ALWAYS sees their own sessions, even if they themselves are a dev user.
 * - Sessions owned (`created_by`) or assigned (`assigned_to`) to a dev user
 *   other than the viewer are excluded.
 */
export function filterDevSessions<
  T extends { created_by?: string | null; assigned_to?: string | null },
>(sessions: readonly T[], viewerId: string | null | undefined): T[] {
  return sessions.filter((s) => {
    const owner = s.created_by ?? null;
    const assignee = s.assigned_to ?? null;
    const ownerIsDev = owner !== null && owner !== viewerId && isDevUser(owner);
    const assigneeIsDev =
      assignee !== null && assignee !== viewerId && isDevUser(assignee);
    return !ownerIsDev && !assigneeIsDev;
  });
}
