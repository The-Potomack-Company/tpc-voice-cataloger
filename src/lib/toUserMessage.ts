const NETWORK_TOKENS = /failed to fetch|networkerror|err_internet_disconnected|\bnetwork\b/i;
const BAD_CREDENTIALS = /invalid login credentials|invalid email or password/i;

// Single funnel for backend/error text → user copy (D-09): only ever returns one of
// three fixed strings so raw Supabase/JSON/stack text never reaches the user.
export function toUserMessage(err: unknown): string {
  const message = String((err as { message?: string })?.message ?? "");

  if (BAD_CREDENTIALS.test(message)) {
    return "Wrong email or password";
  }

  if (NETWORK_TOKENS.test(message) || navigator.onLine === false) {
    return "Connection problem — try again";
  }

  return "Something went wrong";
}
