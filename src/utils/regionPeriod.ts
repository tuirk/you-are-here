import type { JournalEntry } from "@/types/event";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type Phase = "early" | "mid" | "late";

export interface RegionPeriod {
  /** Stable name for the period, e.g. "2026-09-mid". */
  key: string;
  /** What the tooltip says, e.g. "Around mid Sep 2026". */
  label: string;
  /** Local midnight of the first day in the period. */
  start: Date;
  /** Local midnight of the first day after it. */
  end: Date;
}

/**
 * The third of a month a day falls in: 1–10, 11–20, 21 to the end.
 *
 * Hover summaries used to cover ±14 days around wherever the pointer landed,
 * so nudging it a few days along asked Gemini about a slightly different set
 * of entries — a fresh call, and a summary that disagreed with the
 * "early/mid/late" label above it. Snapping to the same thirds the label
 * names makes the summary describe exactly the days it claims to, and lets
 * every hover inside those days share one answer.
 */
export const getRegionPeriod = (date: Date): RegionPeriod => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const phase: Phase = day <= 10 ? "early" : day <= 20 ? "mid" : "late";

  const startDay = phase === "early" ? 1 : phase === "mid" ? 11 : 21;
  const start = new Date(year, month, startDay);
  const end = phase === "late" ? new Date(year, month + 1, 1) : new Date(year, month, startDay + 10);

  return {
    key: `${year}-${String(month + 1).padStart(2, "0")}-${phase}`,
    label: `Around ${phase} ${MONTHS[month]} ${year}`,
    start,
    end,
  };
};

const startOfDay = (value: string): number => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * Entries that belong to a period: anchored inside it, or stretching through
 * it. A feeling that started in August and lasted into mid-September is part
 * of mid-September, even though its anchor is weeks earlier.
 */
export const entriesInPeriod = (entries: JournalEntry[], period: RegionPeriod): JournalEntry[] => {
  const from = period.start.getTime();
  const to = period.end.getTime();
  return entries.filter((e) => {
    const anchor = startOfDay(e.anchorDate);
    const last = e.endDate ? Math.max(anchor, startOfDay(e.endDate)) : anchor;
    return anchor < to && last >= from;
  });
};
