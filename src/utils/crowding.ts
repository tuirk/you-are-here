import { JournalEntry } from "@/types/event";

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * How far either side of an entry counts as the same patch of sky.
 *
 * The band reaches about one day along the curve, so two entries three days
 * apart barely touch and two on the same day land exactly on top of each
 * other. Two either side is the width over which they genuinely compete.
 */
export const CROWDING_WINDOW_DAYS = 2;

/**
 * How many entries a patch carries before anything is taken away.
 *
 * A well-kept week puts three or four entries in a five-day patch, and
 * that should draw at full strength — the relief exists for the stretches
 * that pile up past what the band can carry, not for the habit of writing
 * regularly. On the demo record this leaves about five entries in six
 * completely untouched, which is the point: it should be invisible until
 * it is needed.
 */
export const CROWDING_HEADROOM = 4;

/** However crowded a week gets, no entry drops below this. */
export const CROWDING_FLOOR = 0.45;

/**
 * How brightly an entry should draw, given how many others share its days.
 *
 * Additive blending has no ceiling of its own: the framebuffer sums every
 * mote that covers a pixel, and the display clamps whatever comes out past
 * 1. So brightness on screen is not a property of an entry, it is a
 * property of how many entries landed on the same place — which means a
 * record that grows denser eventually draws every busy stretch as the same
 * flat white, and the busier it gets the more of it goes white. The colours
 * are the whole point of the picture and that is where they go to die.
 *
 * The square root is the shape that matters. Dividing by the count outright
 * would hold every patch at the same brightness and throw away the signal —
 * a week you wrote in every day SHOULD glow more than a quiet one. Under a
 * square root the total still rises with the count, just slowly enough to
 * stay under the clamp: eight entries in a patch read about twice as bright
 * as two rather than four times, and keep their colour while doing it.
 *
 * This is the same trick as a camera's exposure curve, and it is here for
 * the same reason — the scene has more range than the display does.
 */
export const getCrowdingRelief = (neighbours: number): number => {
  if (!Number.isFinite(neighbours) || neighbours <= CROWDING_HEADROOM) return 1;
  return Math.max(CROWDING_FLOOR, Math.sqrt(CROWDING_HEADROOM / neighbours));
};

/** Which day of the calendar an ISO timestamp falls on, as an integer. */
const dayIndex = (iso: string): number | null => {
  const time = new Date(iso).getTime();
  return Number.isFinite(time) ? Math.floor(time / DAY_MS) : null;
};

/**
 * How much relief each entry gets, keyed by id.
 *
 * Counts anchors rather than whole spans on purpose. A span is dust spread
 * thinly over weeks and is never what clamps a pixel; the anchor is the
 * compact, bright knot, and two of those on one day is what goes white.
 * Every entry draws one, spans included, so counting anchors covers the
 * whole record without punishing a long stretch for being long.
 */
export const getCrowdingByEntry = (
  entries: JournalEntry[],
  windowDays: number = CROWDING_WINDOW_DAYS
): Map<string, number> => {
  const perDay = new Map<number, number>();

  for (const entry of entries) {
    const day = dayIndex(entry.anchorDate);
    if (day === null) continue;
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }

  const relief = new Map<string, number>();

  for (const entry of entries) {
    const day = dayIndex(entry.anchorDate);
    if (day === null) {
      relief.set(entry.id, 1);
      continue;
    }

    let neighbours = 0;
    for (let d = day - windowDays; d <= day + windowDays; d++) {
      neighbours += perDay.get(d) ?? 0;
    }

    relief.set(entry.id, getCrowdingRelief(neighbours));
  }

  return relief;
};
