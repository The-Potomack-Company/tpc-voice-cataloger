---
status: diagnosed
trigger: "Investigate why deleting an item causes a 406 (Not Acceptable) error on GET items?select=transcript&id=eq.{uuid}"
created: 2026-03-20T00:00:00Z
updated: 2026-03-20T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Race condition between async AI pipeline and item deletion
test: Code trace confirms the mechanism
expecting: n/a
next_action: Return diagnosis

## Symptoms

expected: Deleting an item should cleanly remove it without errors
actual: GET https://...supabase.co/rest/v1/items?select=transcript&id=eq.{uuid} returns 406 (Not Acceptable)
errors: 406 Not Acceptable on transcript SELECT query after deletion
reproduction: Record audio on an item (triggering AI pipeline), then delete the item while AI is still processing
started: After Phase 14 migration to Supabase

## Eliminated

(none needed - root cause found on first hypothesis)

## Evidence

- timestamp: 2026-03-20
  checked: src/services/gemini.ts lines 176-182
  found: processAudioWithAi reads transcript via `.select("transcript").eq("id", itemId).single()` - the `.single()` call adds `Accept: application/vnd.pgrst.object+json` header which causes PostgREST to return 406 when zero rows match (item already deleted)
  implication: This is the exact query producing the 406

- timestamp: 2026-03-20
  checked: src/components/ItemCard.tsx lines 93-101
  found: processAudioWithAi is called fire-and-forget after recording stops. It is an async pipeline that can take 30+ seconds (network call to Gemini proxy). No cancellation mechanism exists.
  implication: If user deletes item while AI is processing, the pipeline continues and hits a deleted row

- timestamp: 2026-03-20
  checked: src/stores/sessionStore.ts lines 375-402 (deleteItem)
  found: deleteItem does optimistic removal from store then `supabase.from("items").delete().eq("id", itemId)`. No mechanism to cancel or abort in-flight AI processing for that item.
  implication: The Supabase row is deleted before processAudioWithAi reaches the transcript-read step

- timestamp: 2026-03-20
  checked: src/services/gemini.ts lines 176-186
  found: The transcript read uses `.single()` which requires exactly 1 row. PostgREST returns 406 "Not Acceptable" (not 404) when `.single()` finds 0 rows because the Accept header `application/vnd.pgrst.object+json` demands a single JSON object.
  implication: This is the specific PostgREST behavior causing 406 vs 404

## Resolution

root_cause: Race condition in src/services/gemini.ts processAudioWithAi function. When a user deletes an item while AI processing is in-flight, the pipeline continues executing. At line 178-182, it attempts `.select("transcript").eq("id", itemId).single()` on a row that no longer exists. PostgREST returns 406 because `.single()` with `Accept: application/vnd.pgrst.object+json` requires exactly one row, but gets zero.

fix: (not applied - diagnosis only)

verification: (not applied)

files_changed: []
