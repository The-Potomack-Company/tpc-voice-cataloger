import { supabase } from "../lib/supabase";
import { enqueueWrite } from "../hooks/useWriteAheadQueue";
import pkg from "../../package.json";

// app_source is a stable data-layer identifier; do NOT change when the
// package is renamed (e.g. tpc-app → tpc-voice-cataloger). Existing
// analytics_events rows are keyed on this value, and the dashboard
// queries rely on its continuity.
const APP_SOURCE = "tpc-app";
const APP_VERSION = (pkg as { version: string }).version;

type Json = unknown;

export interface AnalyticsEventPayload {
  event_type: string;
  /**
   * Override the auto-resolved user email. Use when the auth session is about to be
   * (or has just been) invalidated — supabase.auth.getUser() can return null mid-signout.
   */
  user_email?: string | null;
  session_id?: string | null;
  execution_time_ms?: number;
  error_message?: string | null;
  error_count?: number;
  success_count?: number;
  cancelled?: boolean;
  total_items?: number;
  total_photos?: number;
  photo_count?: number;
  items_content?: Json;
  receipt_number?: string | null;
  category_id?: string | null;
  generated_title?: string | null;
  generated_description?: string | null;
  field_mode?: string | null;
  field_selection?: string | null;
  import_mode?: string | null;
  detection_method?: string | null;
  input_rows?: number;
  output_rows?: number;
  columns_mapped?: number;
  skipped_count?: number;
  total_groups?: number;
}

export interface UiInteractionPayload {
  interaction_type: "click" | "view" | "focus" | "blur" | "submit" | "walkthrough_step";
  element_id?: string;
  page_path?: string;
  session_id?: string | null;
  metadata?: Record<string, unknown>;
}

async function getUserContext(): Promise<{ userId: string | null; email: string | null }> {
  try {
    const { data } = await supabase.auth.getUser();
    return { userId: data.user?.id ?? null, email: data.user?.email ?? null };
  } catch {
    return { userId: null, email: null };
  }
}

function buildAnalyticsRow(payload: AnalyticsEventPayload, email: string | null) {
  return {
    app_source: APP_SOURCE,
    app_version: APP_VERSION || null,
    user_email: email,
    // Stamp at event time, not insert time — preserves accuracy across the queue/drain path.
    created_at: new Date().toISOString(),
    ...payload,
  };
}

/**
 * Emit a business/workflow/performance/error event into the shared analytics_events table.
 * Offline-safe (reuses write-ahead queue). Never throws — analytics must not break user flows.
 */
export async function trackEvent(payload: AnalyticsEventPayload): Promise<void> {
  try {
    const { email } = await getUserContext();
    await enqueueWrite({
      table: "analytics_events",
      operation: "insert",
      payload: buildAnalyticsRow(payload, email),
    });
  } catch (err) {
    console.warn("[analytics] trackEvent failed", err);
  }
}

/**
 * Synchronous direct-insert variant for events that must land while the current auth
 * context is still valid (e.g. logout — the queued path drains after sign-out, by which
 * time RLS rejects the insert and the event ends up attributed to the next session).
 * Awaits the supabase insert. Never throws.
 */
export async function trackEventNow(payload: AnalyticsEventPayload): Promise<void> {
  try {
    const { email } = await getUserContext();
    const row = buildAnalyticsRow(payload, email) as never;
    await supabase.from("analytics_events").insert(row);
  } catch (err) {
    console.warn("[analytics] trackEventNow failed", err);
  }
}

/**
 * Emit a fine-grained UI interaction event into ui_interactions.
 * Offline-safe. Never throws.
 */
export async function trackUiInteraction(payload: UiInteractionPayload): Promise<void> {
  try {
    const { userId, email } = await getUserContext();
    await enqueueWrite({
      table: "ui_interactions",
      operation: "insert",
      payload: {
        app_source: APP_SOURCE,
        app_version: APP_VERSION || null,
        user_id: userId,
        user_email: email,
        // Stamp at event time, not drain time.
        created_at: new Date().toISOString(),
        ...payload,
      },
    });
  } catch (err) {
    console.warn("[analytics] trackUiInteraction failed", err);
  }
}

/**
 * Convenience for timing a block. Emits one event with execution_time_ms on success,
 * or an `<event_type>.failed` event with error_message on throw (re-throws original).
 */
export async function withTiming<T>(
  eventType: string,
  fn: () => Promise<T>,
  extra?: Partial<AnalyticsEventPayload>,
): Promise<T> {
  const started = performance.now();
  try {
    const result = await fn();
    trackEvent({
      event_type: eventType,
      execution_time_ms: Math.round(performance.now() - started),
      ...extra,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    trackEvent({
      event_type: `${eventType}.failed`,
      execution_time_ms: Math.round(performance.now() - started),
      error_message: message,
      error_count: 1,
      ...extra,
    });
    throw err;
  }
}
