import type { Tables } from "../db/database.types";

type Item = Tables<"items">;

/**
 * Canonical "needs human review" predicate.
 * Mirrors the failedCount logic at SessionDetail.tsx:303-307 so the
 * SessionTile badge and the SessionDetail StatStrip never drift.
 */
export function isNeedsReview(item: Pick<Item, "ai_status" | "title">): boolean {
  return (
    item.ai_status === "failed" ||
    (!item.title && (item.ai_status ?? "") !== "queued")
  );
}
