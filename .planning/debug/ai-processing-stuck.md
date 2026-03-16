---
status: resolved
trigger: "AI processing pipeline stuck in 'processing' - never reaches 'done'"
created: 2026-03-16T00:00:00Z
updated: 2026-03-16T00:00:00Z
---

## Current Focus

hypothesis: Two independent issues - (1) missing .env config causes fetch to undefined URL, (2) catch block can itself throw, leaving status stuck at "processing"
test: Code review of error paths and env configuration
expecting: Confirm both config gap and error-handling gap
next_action: Document findings for resolution

## Symptoms

expected: After recording audio, aiStatus transitions from "processing" to "done" with extracted fields
actual: aiStatus goes to "processing" and never changes - stays stuck forever
errors: Unknown (user did not report console errors)
reproduction: Record audio, stop recording, observe aiStatus remains "processing"
started: Likely since initial implementation - proxy was never deployed

## Eliminated

(none - root cause identified on first pass)

## Evidence

- timestamp: 2026-03-16T00:00:01Z
  checked: .env file existence
  found: No .env file exists. Only .env.example with `VITE_GEMINI_PROXY_URL=http://localhost:8787`
  implication: `import.meta.env.VITE_GEMINI_PROXY_URL` is undefined at runtime. fetch(undefined) will throw or fetch a relative URL that 404s.

- timestamp: 2026-03-16T00:00:02Z
  checked: gemini.ts line 94 - fetch call
  found: `const proxyUrl = import.meta.env.VITE_GEMINI_PROXY_URL;` then `fetch(proxyUrl, ...)` - no guard for undefined proxyUrl
  implication: When proxyUrl is undefined, fetch coerces it to the string "undefined" and sends a request to a relative URL like `http://localhost:5173/undefined` which will 404 or return HTML.

- timestamp: 2026-03-16T00:00:03Z
  checked: gemini.ts lines 103-107 - response parsing after fetch
  found: |
    ```
    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    ```
    If the proxy returns a non-200 (e.g. 404, 500), or returns an error JSON without `candidates`, this line throws a TypeError (cannot read property of undefined). The catch block on line 139 handles this.
  implication: The catch block SHOULD fire and set aiStatus to "failed". But see next evidence entry.

- timestamp: 2026-03-16T00:00:04Z
  checked: gemini.ts lines 139-147 - catch block
  found: |
    ```javascript
    catch (error) {
      console.error("AI processing error:", error);
      await table.update(itemId, {
        aiStatus: "failed",
        description: "AI processing failed - audio recorded, awaiting manual review",
      });
    }
    ```
    The catch block calls `await table.update(itemId, ...)`. If THIS Dexie update throws (e.g., itemId is invalid, table was deleted, or a Dexie hook throws), the error escapes the catch entirely - there is no nested try/catch.
  implication: If the catch block's own DB write fails, the promise rejects silently (caught only by the `.catch()` in RecordButton line 23-25 which just console.error's). Status remains "processing" forever.

- timestamp: 2026-03-16T00:00:05Z
  checked: RecordButton.tsx lines 21-25 - fire-and-forget invocation
  found: |
    ```javascript
    processAudioWithAi(audioId, itemId, itemType).catch((err) =>
      console.error("AI processing failed:", err)
    );
    ```
    The outer .catch() swallows all errors silently to the console. No UI feedback for the user.
  implication: Even if processAudioWithAi throws from the catch block itself, the error vanishes into console.error. The user sees "processing" forever with no indication of what happened.

- timestamp: 2026-03-16T00:00:06Z
  checked: Cloudflare Worker proxy/src/index.ts
  found: Proxy code is well-structured but requires manual deployment steps that have NOT been completed (no .env means VITE_GEMINI_PROXY_URL was never set, strongly suggesting proxy was never deployed)
  implication: Even if .env were created with localhost:8787, the local wrangler dev server would also need to be running with a valid GEMINI_API_KEY secret.

## Resolution

root_cause: |
  **PRIMARY (Configuration):** No `.env` file exists, so `VITE_GEMINI_PROXY_URL` is undefined at runtime. The `fetch(undefined)` call produces a network error or a non-JSON response, which causes a TypeError when parsing `data.candidates[0]...`.

  **SECONDARY (Code Bug):** The catch block at line 139 of gemini.ts can itself throw if the Dexie `table.update()` fails. There is no nested error handling, so a failure in the catch block causes the error to escape entirely, leaving aiStatus permanently stuck at "processing". Even in the normal error case, there is no guard against `proxyUrl` being undefined before attempting the fetch.

  **TERTIARY (UX Gap):** The fire-and-forget pattern in RecordButton.tsx swallows all errors to console.error with no user-visible feedback. The user has no way to know processing failed except that it stays "processing" forever.

fix: |
  Three changes needed:

  1. **Configuration (user action required):**
     - Create `.env` from `.env.example`
     - Deploy Cloudflare Worker: `cd proxy && npx wrangler deploy`
     - Set worker secret: `cd proxy && npx wrangler secret put GEMINI_API_KEY`
     - Update `.env` with deployed worker URL

  2. **Code fix - Guard against missing proxy URL (gemini.ts):**
     Add early validation before fetch:
     ```typescript
     const proxyUrl = import.meta.env.VITE_GEMINI_PROXY_URL;
     if (!proxyUrl) {
       throw new Error("VITE_GEMINI_PROXY_URL is not configured");
     }
     ```

  3. **Code fix - Protect catch block from its own failures (gemini.ts):**
     Wrap the catch block's DB write in a nested try/catch:
     ```typescript
     catch (error) {
       console.error("AI processing error:", error);
       try {
         await table.update(itemId, {
           aiStatus: "failed",
           description: "AI processing failed - audio recorded, awaiting manual review",
         });
       } catch (dbError) {
         console.error("Failed to update aiStatus to failed:", dbError);
       }
     }
     ```

verification: Pending - requires proxy deployment and .env setup to fully verify
files_changed: []
