/**
 * src/utils/groupByDate.ts
 *
 * Group a list of items by a relative date bucket — Today / Yesterday /
 * This week / Earlier in MMM / older months. Used by Sessions list
 * (SCREEN-01) to recreate the date-section eyebrow headers shown in
 * docs/design-handoff/tpc-voice.jsx.
 */

export interface DateGroup<T> {
  /** Stable key for React lists. */
  key: string;
  /** Display label (e.g. "Today · Mar 28", "This week"). */
  label: string;
  /** Items in the group, original order preserved. */
  items: T[];
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const MS_PER_DAY = 86_400_000;

export function groupByDate<T>(
  items: readonly T[],
  pickDate: (item: T) => string | Date,
  now: Date = new Date(),
): DateGroup<T>[] {
  const today = startOfDay(now);
  const yesterday = today - MS_PER_DAY;
  const weekStart = today - 6 * MS_PER_DAY; // last 7 days inclusive of today

  // Order: today, yesterday, this-week, this-year-month, older
  const groups = new Map<string, { label: string; items: T[]; order: number }>();

  function ensure(key: string, label: string, order: number) {
    let g = groups.get(key);
    if (!g) {
      g = { label, items: [], order };
      groups.set(key, g);
    }
    return g;
  }

  for (const item of items) {
    const raw = pickDate(item);
    const d = raw instanceof Date ? raw : new Date(raw);
    if (isNaN(d.getTime())) {
      ensure("__unknown", "Earlier", 9999).items.push(item);
      continue;
    }
    const day = startOfDay(d);
    if (day === today) {
      ensure("today", `Today · ${monthLabel(d)}`, 0).items.push(item);
    } else if (day === yesterday) {
      ensure("yesterday", `Yesterday · ${monthLabel(d)}`, 1).items.push(item);
    } else if (day > weekStart) {
      ensure("this-week", "This week", 2).items.push(item);
    } else if (d.getFullYear() === now.getFullYear()) {
      // Earlier this year → bucket by month name (e.g. "March")
      const monthKey = `m-${d.getFullYear()}-${d.getMonth()}`;
      const month = d.toLocaleDateString("en-US", { month: "long" });
      ensure(monthKey, month, 100 + d.getMonth()).items.push(item);
    } else {
      const yearKey = `y-${d.getFullYear()}`;
      ensure(yearKey, String(d.getFullYear()), 10_000 - d.getFullYear()).items.push(item);
    }
  }

  return Array.from(groups.entries())
    .map(([key, g]) => ({ key, label: g.label, items: g.items, order: g.order }))
    .sort((a, b) => a.order - b.order)
    .map(({ key, label, items }) => ({ key, label, items }));
}

/**
 * Build a short-id from a session UUID / created_at — used as the eyebrow
 * label on Sessions list rows (mockup shows TPC23 / HSE-04 style ids).
 * Falls back to the last 4 hex chars of the UUID if no created_at is
 * available.
 */
export function sessionShortId(session: {
  id: string;
  mode: string;
  created_at?: string | null;
}): string {
  const prefix = session.mode === "sale" ? "TPC" : "HSE";
  const tail = (session.id || "").replace(/-/g, "").slice(-4).toUpperCase();
  return `${prefix}-${tail}`;
}
