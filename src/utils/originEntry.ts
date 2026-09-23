import { JournalEntry } from "@/types/event";

/**
 * Which entry the record opens with.
 *
 * The centre used to be marked by a portal — a lit disc drawn at the world
 * origin, independent of anything written. It was removed because it could
 * never be more than decoration parked on top of the record: it had no way
 * to say anything about the day it sat on, and once a full year of dust
 * grew around it there was nothing to distinguish it from the entries it
 * was competing with.
 *
 * The beginning is worth marking, though. So it is marked with the record
 * itself — the first day is drawn scattered far wider than any other, which
 * needs only to know which day that is.
 *
 * Earliest by the day it is ABOUT, not the day it was written. A record can
 * open with something written months later about a day long past, and that
 * day is still where the spiral starts.
 */
export const getOriginEntryId = (entries: JournalEntry[]): string | null => {
  let earliest: { time: number; id: string } | null = null;

  for (const entry of entries) {
    const time = new Date(entry.anchorDate).getTime();
    if (!Number.isFinite(time)) continue;
    // Strictly earlier, so two entries on the same first day resolve to the
    // first in the list rather than flickering between them on re-render.
    if (!earliest || time < earliest.time) earliest = { time, id: entry.id };
  }

  return earliest ? earliest.id : null;
};
