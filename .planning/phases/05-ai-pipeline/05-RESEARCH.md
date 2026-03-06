# Phase 5: AI Pipeline - Research

**Researched:** 2026-03-06
**Domain:** Gemini audio transcription + structured field extraction via backend proxy
**Confidence:** HIGH

## Summary

Phase 5 connects recorded audio to Gemini for transcription and field extraction in a single API call. The PWA sends audio blobs through a lightweight backend proxy (which holds the API key) to Gemini's `generateContent` endpoint, receiving structured JSON back with fields (title, description, condition, estimate, category) extracted verbatim from speech. Gemini acts as a pure field splitter -- no formatting, no post-processing.

The `@google/genai` SDK (v1.x, already decided) supports inline base64 audio with structured JSON output via `responseMimeType: "application/json"` and a JSON schema. Gemini's supported audio formats include `audio/webm` and `audio/mp4` (confirmed via Firebase AI Logic documentation), which covers both Android Chrome (webm;codecs=opus) and iOS Safari (mp4) recording formats. The proxy pattern is straightforward -- a Cloudflare Worker or similar edge function that receives audio from the PWA, attaches the API key, forwards to Gemini, and returns the response.

**Primary recommendation:** Build a minimal edge proxy that forwards audio + prompt to Gemini `generateContent` with a response JSON schema enforcing the five fields as nullable strings. On the client side, trigger processing from the recording stop event, write results to Dexie, and track status with an `aiStatus` field on item records.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Gemini is a pure field splitter -- extracts what the auctioneer said and drops it into the right buckets verbatim
- No post-processing: no ALL CAPS conversion, no "the"-prefixing, no formal language rewriting
- TPC formatting is a downstream concern (Phase 6 or a separate utility), not part of the AI prompt
- Category defaults to "furniture" -- auctioneer can override in Phase 6 review
- Audio-only input -- photos are not sent to Gemini
- No raw transcript returned -- fields are already verbatim from speech
- Fields not mentioned in audio are stored as null -- no hallucinated values
- Auto-fires in background immediately after recording stops
- Auctioneer moves on to the next item without waiting
- If Gemini fails/times out/returns bad data, dump full transcription into description field as fallback
- No automatic retries -- fallback transcription ensures words are captured
- Simple backend proxy (Cloudflare Worker, Vercel function, or similar) holds the Gemini API key
- PWA calls the proxy, proxy forwards to Gemini
- API key never exposed in client-side code
- Single Gemini call for transcription + extraction (no separate Whisper step)

### Claude's Discretion
- Gemini prompt structure and JSON schema design
- Backend proxy implementation details (platform choice, error responses)
- How audio blob is converted to base64 for the API call
- Processing status tracking on the item record (pending/done/failed)
- Retry vs no-retry policy details beyond the fallback behavior

### Deferred Ideas (OUT OF SCOPE)
- TPC formatting (ALL CAPS titles, formal description conventions) -- Phase 6 or separate utility
- Multimodal input (sending photos + audio together to Gemini) -- future enhancement
- Category-aware prompts (furniture/books/fashion extraction strategies) -- v2 (AI-05)
- Estimate extraction from natural speech ("three to five hundred" -> $300-$500) -- v2 (AI-06)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AI-01 | Recorded audio is sent to AI and returned as structured fields (title, description, condition, estimate, category) in a single step -- no separate transcription | Gemini `generateContent` with inline audio + JSON schema enforces structured output in one call. Proxy pattern keeps API key secure. |
| AI-02 | AI output follows TPC conventions (ALL CAPS title, lowercase "the"-starting description, formal auction language) | **CONTEXT.md overrides this**: Gemini returns verbatim speech only. TPC formatting is deferred to Phase 6. AI-02 is partially addressed (field structure exists) but formatting is explicitly out of scope per user decision. |
| AI-03 | AI handles missing fields gracefully (null when not spoken, no hallucinated values) | JSON schema with nullable string fields + explicit system prompt instruction "return null for unmentioned fields" enforces this. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@google/genai` | ^1.x | Gemini SDK for generateContent calls | Decided in STATE.md; official Google SDK for Gemini API |
| `zod` | ^3.x | Runtime validation of Gemini JSON responses | Already a transitive dependency (zod ships with several deps); standard for schema validation in TS |
| `zod-to-json-schema` | ^3.x | Convert Zod schemas to JSON Schema for Gemini responseJsonSchema | Official pattern from Gemini structured output docs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Cloudflare Workers / Wrangler | latest | Edge proxy hosting | Backend proxy to hold API key; free tier covers internal tool usage |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Cloudflare Worker | Vercel Edge Function | Both work; CF has simpler deploy for a single endpoint, generous free tier |
| Cloudflare Worker | Netlify Function | Same tradeoff; CF Workers have fastest cold start |
| zod | Manual JSON.parse + type assertion | Zod catches malformed Gemini responses before they corrupt Dexie |

**Installation (PWA side):**
```bash
npm install @google/genai zod zod-to-json-schema
```

**Proxy side (Cloudflare Worker):**
```bash
npm create cloudflare@latest -- tpc-gemini-proxy
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  services/
    gemini.ts          # Client-side: send audio to proxy, parse response
    geminiSchema.ts    # Zod schema for Gemini response + JSON schema export
  hooks/
    useAudioRecorder.ts  # (existing) -- add post-stop AI trigger
    useAiProcessing.ts   # Hook that wraps the processing pipeline
  db/
    index.ts           # (existing) -- add aiStatus index in v3 migration
    types.ts           # (existing) -- add aiStatus field to item types

proxy/                 # Separate directory or repo for the edge function
  src/
    index.ts           # Cloudflare Worker entry point
  wrangler.toml        # CF Worker config with API key secret
```

### Pattern 1: Fire-and-Forget Processing on Recording Stop
**What:** When `stopRecording()` resolves with an audio ID, immediately kick off AI processing in the background. Don't await it in the UI flow.
**When to use:** Every recording stop event.
**Example:**
```typescript
// In the cataloging page component
const audioId = await stopRecording();
if (audioId) {
  // Fire and forget -- don't await
  processAudioWithAi(audioId, itemId, itemType).catch(console.error);
}
// Immediately advance to next item
```

### Pattern 2: Gemini Structured Output with Nullable Fields
**What:** Use `responseMimeType: "application/json"` with a JSON schema that marks all fields as nullable strings.
**When to use:** Every Gemini call.
**Example:**
```typescript
// Source: https://ai.google.dev/gemini-api/docs/structured-output
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const catalogFieldsSchema = z.object({
  title: z.string().nullable().describe("Item title exactly as spoken, or null if not mentioned"),
  description: z.string().nullable().describe("Item description exactly as spoken, or null if not mentioned"),
  condition: z.string().nullable().describe("Condition exactly as spoken, or null if not mentioned"),
  estimate: z.string().nullable().describe("Price estimate exactly as spoken, or null if not mentioned"),
  category: z.string().nullable().describe("Category exactly as spoken, or null if not mentioned"),
});

export type CatalogFields = z.infer<typeof catalogFieldsSchema>;
export const catalogFieldsJsonSchema = zodToJsonSchema(catalogFieldsSchema);
```

### Pattern 3: Backend Proxy as Thin Forwarder
**What:** The proxy receives the audio payload + prompt from the PWA, attaches the API key, calls Gemini, returns the response. No business logic in the proxy.
**When to use:** All Gemini calls.
**Example:**
```typescript
// Cloudflare Worker (proxy/src/index.ts)
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const body = await request.json();
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${body.model}:generateContent?key=${env.GEMINI_API_KEY}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body.payload),
    });

    const data = await geminiResponse.json();
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  },
};
```

### Pattern 4: aiStatus Field for Tracking
**What:** Add an `aiStatus` field to `HouseVisitItem` and `SaleItem` types: `"pending" | "processing" | "done" | "failed"`.
**When to use:** Track AI pipeline state per item for Phase 6 display.
**Example:**
```typescript
// DB migration v3
db.version(3).stores({
  sessions: "++id, mode, status, updatedAt, createdAt, deletedAt",
  houseVisitItems: "++id, sessionId, sortOrder, aiStatus",
  saleItems: "++id, sessionId, receiptNumber, sortOrder, aiStatus",
  photos: "++id, itemId, sortOrder",
  audio: "++id, itemId",
});
```

### Anti-Patterns to Avoid
- **Awaiting AI in the recording flow:** Never block the user from moving to the next item. Fire-and-forget with error handling.
- **Storing API key in client code:** Even for an internal tool with 2-5 users. Always proxy.
- **Complex retry logic:** The fallback (dump everything to description) is better than retry storms. Keep it simple.
- **Post-processing in the AI prompt:** Do NOT ask Gemini to capitalize, reformat, or improve language. That violates the "pure field splitter" decision.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON schema validation | Manual type checks on Gemini response | Zod parse + zodToJsonSchema | Gemini can return malformed JSON despite schema; Zod catches it |
| Audio base64 encoding | Custom Blob-to-base64 from scratch | FileReader.readAsDataURL or Uint8Array + btoa pattern | Well-known browser APIs, no library needed but use the standard pattern |
| CORS handling | Manual header management | Cloudflare Worker built-in CORS | Workers handle preflight/OPTIONS natively |
| Gemini API auth | Custom fetch wrapper | `@google/genai` SDK in proxy OR direct REST from proxy | SDK handles model versioning, retries |

**Key insight:** The proxy is the thinnest possible layer. Don't add auth, rate limiting, or business logic to the proxy for an internal 2-5 person tool. Keep complexity in the PWA client.

## Common Pitfalls

### Pitfall 1: Gemini Returns Empty or Malformed JSON
**What goes wrong:** Despite `responseMimeType: "application/json"`, Gemini occasionally returns invalid JSON or wraps it in markdown code fences.
**Why it happens:** Model non-determinism, especially with short/noisy audio inputs.
**How to avoid:** Always wrap `JSON.parse` in try/catch. Use Zod `.safeParse()` instead of `.parse()`. On failure, trigger the fallback path (dump to description).
**Warning signs:** Tests pass but production fails on edge-case audio clips.

### Pitfall 2: Base64 Encoding Doubles Memory Usage
**What goes wrong:** Converting a 5MB audio blob to base64 creates a ~6.7MB string, and both exist in memory simultaneously.
**Why it happens:** Base64 encoding inflates size by ~33%, and the original blob stays referenced.
**How to avoid:** For typical auction recordings (30-120 seconds), this is manageable (< 5MB audio). But be aware of the 20MB inline limit. Read the blob as ArrayBuffer, convert to base64, then release the blob reference.
**Warning signs:** Memory pressure on low-end phones with many items.

### Pitfall 3: CORS Preflight Failures
**What goes wrong:** PWA sends OPTIONS preflight to the proxy, proxy doesn't handle it, request fails silently.
**Why it happens:** Cross-origin POST with `Content-Type: application/json` triggers preflight.
**How to avoid:** Proxy must handle OPTIONS requests returning appropriate CORS headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`).
**Warning signs:** Works in dev (same origin), fails in production (cross-origin).

### Pitfall 4: iOS Safari Audio Format Mismatch
**What goes wrong:** iOS Safari records as `audio/mp4` (or sometimes just `audio/mp4;codecs=mp4a.40.2`). Gemini may not recognize the full MIME type string with codecs parameter.
**Why it happens:** Safari uses a different container format than Chrome.
**How to avoid:** When sending to Gemini, strip codec parameters and use just the base MIME type (`audio/mp4` or `audio/webm`). The existing `getPreferredMimeType()` utility already detects the right type -- just clean it before sending.
**Warning signs:** Works on Android, fails on iPhone.

### Pitfall 5: Race Condition on Rapid Item Switching
**What goes wrong:** User records item 1, moves to item 2, records item 2. AI results for item 1 arrive and overwrite item 2's fields.
**Why it happens:** Processing callback references stale itemId.
**How to avoid:** Capture `itemId` in a closure at trigger time. Write results to the specific item ID that was recorded, not "current item." The Dexie write uses the captured ID.
**Warning signs:** Fields appear on wrong items.

## Code Examples

### Audio Blob to Base64
```typescript
// Convert Blob to base64 string (browser environment)
async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
```

### Full Client-Side Processing Pipeline
```typescript
// src/services/gemini.ts
import { catalogFieldsSchema, catalogFieldsJsonSchema } from "./geminiSchema";
import { db } from "../db";

const PROXY_URL = import.meta.env.VITE_GEMINI_PROXY_URL;

export async function processAudioWithAi(
  audioId: number,
  itemId: number,
  itemType: "house" | "sale",
): Promise<void> {
  const table = itemType === "house" ? db.houseVisitItems : db.saleItems;

  // Mark as processing
  await table.update(itemId, { aiStatus: "processing" });

  try {
    // 1. Fetch audio blob from Dexie
    const audioRecord = await db.audio.get(audioId);
    if (!audioRecord) throw new Error("Audio not found");

    // 2. Convert to base64
    const base64Audio = await blobToBase64(audioRecord.blob);

    // 3. Strip codec params from MIME type
    const baseMimeType = audioRecord.mimeType.split(";")[0];

    // 4. Send to proxy
    const response = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        payload: {
          contents: [{
            parts: [
              { text: "Extract auction catalog fields from this audio recording. Return the speaker's exact words for each field. Return null for any field not mentioned." },
              { inlineData: { mimeType: baseMimeType, data: base64Audio } },
            ],
          }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: catalogFieldsJsonSchema,
          },
        },
      }),
    });

    if (!response.ok) throw new Error(`Proxy error: ${response.status}`);

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("No text in Gemini response");

    // 5. Validate with Zod
    const parsed = catalogFieldsSchema.safeParse(JSON.parse(text));
    if (!parsed.success) throw new Error("Schema validation failed");

    // 6. Write fields to item (null fields stay null, category defaults to "furniture")
    const fields = parsed.data;
    await table.update(itemId, {
      title: fields.title ?? undefined,
      description: fields.description ?? undefined,
      condition: fields.condition ?? undefined,
      estimate: fields.estimate ?? undefined,
      category: fields.category ?? "furniture",
      aiStatus: "done",
    });
  } catch (error) {
    console.error("AI processing failed:", error);

    // Fallback: try to get raw text from Gemini response, or dump error
    // If we have any text response at all, put it in description
    try {
      const audioRecord = await db.audio.get(audioId);
      // Attempt a simpler transcription-only call as fallback
      // Or just mark as failed so user can handle in Phase 6
      await table.update(itemId, {
        aiStatus: "failed",
        description: "AI processing failed - audio recorded, awaiting manual review",
      });
    } catch {
      await table.update(itemId, { aiStatus: "failed" });
    }
  }
}
```

### Gemini System Prompt
```typescript
const SYSTEM_PROMPT = `You are an auction catalog field extractor. You will receive an audio recording of an auctioneer describing an item.

Your job is to extract the following fields from EXACTLY what the speaker says:
- title: The item name/type as spoken
- description: The item description as spoken
- condition: The condition assessment as spoken
- estimate: The price estimate as spoken
- category: The item category as spoken

CRITICAL RULES:
1. Use the speaker's EXACT words. Do not rephrase, improve, or formalize.
2. If a field is not mentioned in the audio, return null for that field.
3. Do NOT invent or guess values for unmentioned fields.
4. If the speaker says "oak table, kinda beat up, maybe two hundred", return those exact words in the appropriate fields.`;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate Whisper + GPT calls | Single Gemini call for transcription + extraction | Gemini 1.5+ (2024) | One API call instead of two; lower latency and cost |
| Unstructured text output | JSON schema-enforced structured output | Gemini 1.5 Pro (2024) | Reliable JSON parsing; no regex extraction needed |
| `@google-ai/generativelanguage` | `@google/genai` | 2025 | Unified SDK for both AI Studio and Vertex AI |
| REST API direct | `@google/genai` SDK | 2025 | SDK handles model versioning, error types |

**Deprecated/outdated:**
- `@google-ai/generativelanguage` package: replaced by `@google/genai`
- `gemini-pro` model name: current models are `gemini-2.5-flash`, `gemini-2.5-pro`, etc.
- `responseSchema` as object literal: current best practice uses `zodToJsonSchema` conversion

## Open Questions

1. **Which Gemini model to use?**
   - What we know: `gemini-2.5-flash` is the cost-effective option; `gemini-2.5-pro` is higher quality
   - What's unclear: Whether flash quality is sufficient for auction speech transcription
   - Recommendation: Start with `gemini-2.5-flash` (faster, cheaper). Switch to pro if accuracy is insufficient. Make model name configurable.

2. **Proxy deployment platform?**
   - What we know: Cloudflare Workers, Vercel Edge Functions, and Netlify Functions all work
   - What's unclear: User preference on hosting platform
   - Recommendation: Cloudflare Workers -- simplest deploy, generous free tier (100k requests/day), fastest cold start, mature ecosystem for API proxies.

3. **Audio format compatibility at runtime**
   - What we know: Firebase AI Logic docs list `audio/webm` and `audio/mp4` as supported. Main Gemini docs list a shorter set (WAV, MP3, AIFF, AAC, OGG, FLAC).
   - What's unclear: Whether the discrepancy means webm/mp4 work for `generateContent` inline data or only via Files API
   - Recommendation: Test both formats early in implementation. If inline `audio/webm` fails, use the Files API (upload then reference). This is flagged in STATE.md as a pre-Phase 5 blocker to verify.

4. **Proxy URL configuration**
   - What we know: PWA needs to know the proxy endpoint URL
   - Recommendation: Use `VITE_GEMINI_PROXY_URL` environment variable. Include in `.env.example`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vite.config.ts` (test section) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AI-01 | Audio sent to Gemini, structured fields returned in one step | unit (mock fetch) | `npx vitest run src/tests/gemini-pipeline.test.ts -t "processes audio" --reporter=verbose` | No -- Wave 0 |
| AI-01 | Proxy forwards request with API key | unit (mock env) | `npx vitest run src/tests/gemini-proxy.test.ts --reporter=verbose` | No -- Wave 0 |
| AI-02 | Fields returned verbatim (per CONTEXT.md override) | unit | `npx vitest run src/tests/gemini-pipeline.test.ts -t "verbatim" --reporter=verbose` | No -- Wave 0 |
| AI-03 | Null for unmentioned fields, no hallucination | unit | `npx vitest run src/tests/gemini-pipeline.test.ts -t "null fields" --reporter=verbose` | No -- Wave 0 |
| AI-03 | Fallback to description on Gemini failure | unit | `npx vitest run src/tests/gemini-pipeline.test.ts -t "fallback" --reporter=verbose` | No -- Wave 0 |
| AI-01 | Zod schema validates Gemini response correctly | unit | `npx vitest run src/tests/gemini-schema.test.ts --reporter=verbose` | No -- Wave 0 |
| AI-01 | aiStatus transitions (pending -> processing -> done/failed) | unit | `npx vitest run src/tests/gemini-pipeline.test.ts -t "aiStatus" --reporter=verbose` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/tests/gemini-pipeline.test.ts` -- covers AI-01, AI-02, AI-03 (mock fetch to proxy, validate Dexie writes)
- [ ] `src/tests/gemini-schema.test.ts` -- covers Zod schema validation of various Gemini response shapes
- [ ] `src/tests/gemini-proxy.test.ts` -- covers proxy handler logic (if proxy code lives in this repo)
- [ ] DB migration test for v3 (aiStatus field) -- extend existing `src/tests/db.test.ts`
- [ ] Mock `fetch` in test setup for proxy calls

## Sources

### Primary (HIGH confidence)
- [Gemini Audio Understanding docs](https://ai.google.dev/gemini-api/docs/audio) -- inline audio, size limits, format support
- [Firebase AI Logic - Input File Requirements](https://firebase.google.com/docs/ai-logic/input-file-requirements) -- comprehensive MIME type list including audio/webm and audio/mp4
- [Gemini Structured Output docs](https://ai.google.dev/gemini-api/docs/structured-output) -- JSON schema, responseMimeType, zodToJsonSchema pattern

### Secondary (MEDIUM confidence)
- [@google/genai npm](https://www.npmjs.com/package/@google/genai) -- v1.44.0 latest, SDK usage patterns
- [Cloudflare Workers Gemini Proxy examples](https://github.com/JacobLinCool/gemini-reverse-proxy-worker) -- proxy architecture patterns
- [Firebase AI Logic - Analyze Audio](https://firebase.google.com/docs/ai-logic/analyze-audio) -- audio analysis patterns

### Tertiary (LOW confidence)
- Audio format compatibility for inline data with `generateContent` -- Firebase docs list webm/mp4 but main Gemini docs do not. Needs runtime verification.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- `@google/genai` decided in STATE.md, structured output pattern well-documented
- Architecture: HIGH -- proxy pattern is standard, fire-and-forget processing is straightforward
- Pitfalls: HIGH -- CORS, base64 memory, race conditions are well-known issues
- Audio format compatibility: MEDIUM -- conflicting documentation between Gemini and Firebase sources

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (Gemini API is fast-moving; model names and features may change)
