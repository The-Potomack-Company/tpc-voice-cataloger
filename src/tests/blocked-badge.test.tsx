/**
 * REL-3 / D-10 contract — Wave-0 RED stub.
 *
 * Defines the blocked-count badge contract that Plan 33-02 (REL-3) implements:
 * a Badge (tone="err") rendered in the AppLayout header next to OfflineIndicator
 * showing the count of blocked (ai_status='failed' + permanently-failed
 * write-ahead) items, where click/tap opens a detail list of those items.
 *
 * These are intentionally `it.todo` so the suite stays GREEN until REL-3 ships
 * the component; turn each todo into a real assertion in 33-02. Mirrors
 * layout.test.tsx for render/import shape. Keep this file in sync with D-10.
 */
import { describe, it } from "vitest";

describe("BlockedBadge (REL-3 / D-10) — contract pending 33-02", () => {
  it.todo("renders a Badge with tone=\"err\" when blockedCount > 0");

  it.todo("shows the blocked-item count as the badge text");

  it.todo("renders nothing (no badge) when blockedCount is 0");

  it.todo("is mounted in the AppLayout header next to OfflineIndicator");

  it.todo("opens a blocked-items detail list on click/tap");
});
