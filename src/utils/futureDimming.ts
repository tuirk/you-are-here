const DAY_MS = 1000 * 60 * 60 * 24;

/** How faint the furthest-out projection gets. */
export const FUTURE_FLOOR = 0.25;

/** Beyond this many days ahead, a projection sits at the floor. */
export const FUTURE_HORIZON_DAYS = 45;

/**
 * How hard the approach is eased. A projection climbs toward solid only in
 * its final days rather than across the whole horizon.
 *
 * This number is the whole balance of the effect. At 2 something four days
 * out drew at 93%, indistinguishable from a lived day. At 10 it sits near
 * 55% — clearly still a ghost, but visibly closer than next month.
 */
export const FUTURE_APPROACH_EXPONENT = 10;

/**
 * The floor on how sparse a projection's dust gets, however far off it is.
 * Below this a distant entry stops being a faint presence and just goes
 * missing.
 */
export const PROJECTION_DENSITY_FLOOR = 0.3;

/**
 * How dense a projection's dust should be, for a given solidity.
 *
 * Dimming a particle's alpha barely changes how solid a cluster looks,
 * because the layers blend additively: the framebuffer accumulates
 * colour x alpha for every particle that covers a pixel. Hundreds of motes
 * at a quarter alpha still stack to pure white wherever they overlap, so
 * pulling opacity down left the future looking exactly as lived as the
 * past. That is the override that kept undoing this fix — not the curve.
 *
 * Thinning the cluster is what actually reads as a ghost, because it
 * lowers the number of overlapping contributions rather than the size of
 * each one.
 */
export const getProjectionDensity = (solidity: number): number => {
  // A non-finite solidity would otherwise reach Math.floor in the callers
  // and size a buffer with NaN. Treat it as the faintest case.
  const clamped = Number.isFinite(solidity) ? Math.min(Math.max(solidity, 0), 1) : 0;
  return PROJECTION_DENSITY_FLOOR + (1 - PROJECTION_DENSITY_FLOOR) * clamped;
};

const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * How solid something dated `target` should look right now, from
 * FUTURE_FLOOR (a distant projection) to 1 (lived, or arriving today).
 *
 * A forward projection is a guess, not a memory — "dreading next month" has
 * not happened and should not sit on the spiral with the same weight as a
 * day you actually lived. Drawing it faint and letting it fill in as the
 * date approaches makes the spiral honest about what it knows: the past is
 * solid, the future is a ghost that slowly becomes real.
 *
 * It does reach full as the date arrives, so a thing genuinely about to
 * happen stops looking hypothetical — but the climb is eased hard, so most
 * of the horizon stays faint and only the last few days brighten. A gentler
 * curve made anything within a week look lived; a hard cutoff made arrival
 * snap. This is the middle.
 */
export const getFutureDimming = (
  target: Date,
  today: Date,
  horizonDays: number = FUTURE_HORIZON_DAYS,
  floor: number = FUTURE_FLOOR
): number => {
  const daysAhead = (startOfDay(target).getTime() - startOfDay(today).getTime()) / DAY_MS;

  // Anything at or before today is lived experience, drawn at full strength.
  if (daysAhead <= 0) return 1;
  if (horizonDays <= 0) return floor;

  const nearness = daysAhead >= horizonDays ? 0 : 1 - daysAhead / horizonDays;
  return floor + (1 - floor) * Math.pow(nearness, FUTURE_APPROACH_EXPONENT);
};
