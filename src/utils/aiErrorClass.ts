/**
 * AI-failure error taxonomy (D-08) for the queue drains (REL-1/REL-3).
 *
 * Generalizes the seed classifier at services/gemini.ts:146-151 without
 * touching gemini.ts: the proxy surfaces HTTP status only as text in the
 * thrown `Error.message` ("Proxy returned HTTP <status>: ..."), so we
 * regex-parse the status rather than refactor processAudioWithAi to throw a
 * typed error. The typed-error refactor is a deferred future cleanup
 * (RESEARCH Open Question 1) — keeping the diff tight here.
 *
 *   permanent → drop (4xx validation/auth, unsupported format, Zod failure)
 *   transient → retry (offline, timeout/abort, network, 429, 5xx)
 */

export function classifyAiError(error: unknown): "permanent" | "transient" {
  if (!navigator.onLine) return "transient"; // offline is always retryable
  if (error instanceof DOMException && error.name === "AbortError") return "transient"; // request timeout
  const msg = error instanceof Error ? error.message : String(error);
  if (/abort|Load failed|Failed to fetch|NetworkError/i.test(msg)) return "transient";
  const httpMatch = msg.match(/HTTP (\d{3})/); // "Proxy returned HTTP 4xx/5xx"
  if (httpMatch) {
    const status = Number(httpMatch[1]);
    if (status === 429 || status >= 500) return "transient"; // rate-limit / server fault
    if (status >= 400) return "permanent"; // validation / auth — retrying won't help
  }
  if (/Zod validation failed|unsupported format/i.test(msg)) return "permanent";
  return "transient"; // safe default: retry rather than drop (don't lose work on an unknown error)
}
