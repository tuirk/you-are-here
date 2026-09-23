import { Vector3 } from "three";

export interface DailySpiralPoint {
  position: Vector3;
  date: Date;
  dayIndex: number;
}

/** Average month length. The unit of time the spiral is laid out in. */
export const DAYS_PER_MONTH = 30.44;

/**
 * How far round the spiral a given day sits.
 *
 * Each turn holds two months more than the turn inside it: the first holds
 * one, the second three, the third five. So after N turns the record covers
 * 1+3+5+...+(2N-1) months, which is exactly N squared — and inverting that
 * is just a square root.
 *
 * The reason to do this is not compression for its own sake. A turn's
 * circumference grows linearly with N, so on a one-month-per-turn mapping
 * every passing month was given a longer and longer stretch of curve to sit
 * on: month 36 got about 280 world units of arc where month 1 got 10.
 * Entries thinned out toward the present, and the spiral grew without bound
 * to pay for it.
 *
 * Letting turn N hold a linearly growing number of months makes those two
 * growths cancel. Arc length per month settles to PI * growth and stops
 * there, so a month always occupies about the same amount of curve however
 * old the record is.
 *
 * What it costs: radius after ten years is 15 turns' worth under the old
 * n-per-turn rule and 11 under this one, and a day in year three spans a
 * fraction of the angle a day in month one does. Time is deliberately
 * foreshortened, the way distance is in perspective.
 */
export const getRevolutionsForDay = (dayIndex: number): number => {
  const months = dayIndex / DAYS_PER_MONTH;

  // Days before the first entry have no turn to belong to. Continue
  // linearly so the curve stays finite through zero instead of taking the
  // square root of a negative.
  if (months <= 0) return months;

  return Math.sqrt(months);
};

/**
 * The shape of the spiral, in one place.
 *
 * These three numbers were previously written out by hand in nine separate
 * components. Any change had to be made identically in all of them or the
 * markers, clusters, click target and camera would quietly disagree about
 * where a given day sits.
 *
 * BASE_RADIUS is deliberately small so day zero starts at the origin and
 * the record opens outward from it, rather than beginning partway out with
 * a hollow ring in the middle.
 *
 * GROWTH and HEIGHT are what separate one turn from the next, so together
 * they have to clear the GIRTH of the dust — twice, since both turns throw
 * their dust into the same gap. The turn gap is hypot(2.80, 2.68) = 3.88.
 * The widest band reaches about 1.34 across the curve at two sigma (see
 * getBandSpread), so neighbouring turns put ~2.68 into a 3.88 gap and about
 * 1.20 of dark is left between them.

 * That margin is now the tighter of the two constraints on this number.
 * Pulling the turns in any further, or widening the girth again, starts
 * closing it — and once the gap is gone the turns read as one disc.
 *
 * That is the number to recompute when the band gets wider. Dust that is
 * allowed to touch the next turn does not read as a thicker ribbon; it
 * reads as the spiral having collapsed into a disc, and under additive
 * blending the overlap sums straight to white.
 *
 * These are affordable only because of the mapping above. On
 * one-month-per-turn, ten years was 120 turns, and a growth of 2.80 would
 * have put the outer edge at a radius of 336. Under the new mapping ten
 * years is under 11 turns, so the same growth lands at 31 — a tenth of it.
 *
 * Arc per day settles at PI * GROWTH / DAYS_PER_MONTH = 0.29 world units.
 * The band's reach ALONG the curve is sized against that, not against the
 * turn gap — the two are independent now that the offsets are taken in the
 * curve's own frame rather than in world axes.
 */
export const SPIRAL_BASE_RADIUS = 0.3;
export const SPIRAL_RADIUS_GROWTH = 2.80;
export const SPIRAL_HEIGHT_PER_REV = 2.68;

export const getDailySpiralCoords = (
  dayIndex: number,
  baseRadius: number = SPIRAL_BASE_RADIUS,
  radiusGrowth: number = SPIRAL_RADIUS_GROWTH,
  heightPerRev: number = SPIRAL_HEIGHT_PER_REV
) => {
  const revolutions = getRevolutionsForDay(dayIndex);
  // Clockwise, starting at the top. The first turn is one month; each
  // turn after it holds two months more than the one inside it.
  const angleRad = -revolutions * Math.PI * 2 + Math.PI / 2;
  // Radius grows with each revolution
  const currentRadius = baseRadius + revolutions * radiusGrowth;
  // Position
  const x = currentRadius * Math.cos(angleRad);
  const y = -revolutions * heightPerRev; // downward spiral
  const z = currentRadius * Math.sin(angleRad);

  return { x, y, z, angleRad, currentRadius };
};

/**
 * Generates smooth spiral line points from firstUseDate to today.
 * Uses multiple sub-steps per day for a smooth curve.
 */
export const generateDailySpiralPoints = (
  firstUseDate: Date,
  today: Date,
  stepsPerDay: number = 4,
  baseRadius: number = SPIRAL_BASE_RADIUS,
  radiusGrowth: number = SPIRAL_RADIUS_GROWTH,
  heightPerRev: number = SPIRAL_HEIGHT_PER_REV
): DailySpiralPoint[] => {
  const points: DailySpiralPoint[] = [];

  const start = new Date(firstUseDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setHours(0, 0, 0, 0);

  const totalDays = Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

  // Always have at least a small spiral even on day 0
  const totalSteps = Math.max(1, totalDays * stepsPerDay);

  for (let step = 0; step <= totalSteps; step++) {
    const dayIndex = (step / stepsPerDay);
    const { x, y, z } = getDailySpiralCoords(dayIndex, baseRadius, radiusGrowth, heightPerRev);

    // Calculate the date for this point
    const date = new Date(start);
    date.setDate(date.getDate() + Math.floor(dayIndex));

    points.push({
      position: new Vector3(x, y, z),
      date,
      dayIndex,
    });
  }

  return points;
};

/**
 * Returns positions for each individual day (one per day, for markers).
 */
export const getDayPositions = (
  firstUseDate: Date,
  today: Date,
  baseRadius: number = SPIRAL_BASE_RADIUS,
  radiusGrowth: number = SPIRAL_RADIUS_GROWTH,
  heightPerRev: number = SPIRAL_HEIGHT_PER_REV
): DailySpiralPoint[] => {
  const points: DailySpiralPoint[] = [];

  const start = new Date(firstUseDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setHours(0, 0, 0, 0);

  const totalDays = Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

  for (let dayIndex = 0; dayIndex <= totalDays; dayIndex++) {
    const { x, y, z } = getDailySpiralCoords(dayIndex, baseRadius, radiusGrowth, heightPerRev);

    const date = new Date(start);
    date.setDate(date.getDate() + dayIndex);

    points.push({
      position: new Vector3(x, y, z),
      date,
      dayIndex,
    });
  }

  return points;
};
