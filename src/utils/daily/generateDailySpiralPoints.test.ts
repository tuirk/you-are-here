import { describe, it, expect } from "vitest";
import {
  DAYS_PER_MONTH,
  getRevolutionsForDay,
  getDailySpiralCoords,
  generateDailySpiralPoints,
  getDayPositions,
  SPIRAL_BASE_RADIUS,
  SPIRAL_RADIUS_GROWTH,
} from "./generateDailySpiralPoints";

/**
 * The spiral coordinate function places every particle, marker and line in
 * the scene. If it drifts, the whole visualization moves. These tests pin
 * its contract: where day 0 sits, how a revolution advances radius and
 * height, and that it never emits a non-finite number.
 */

const daysBetween = (from: Date, to: Date) =>
  Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

describe("getDailySpiralCoords", () => {
  it("starts day 0 at the top of the spiral, at base radius", () => {
    const { x, y, z, currentRadius } = getDailySpiralCoords(0, 2, 0.8, 1.2);

    // angle starts at PI/2, so the point sits on +z with x ~ 0
    expect(x).toBeCloseTo(0, 10);
    expect(y).toBe(-0);
    expect(z).toBeCloseTo(2, 10);
    expect(currentRadius).toBe(2);
  });

  it("returns to the same angle after one full revolution", () => {
    const start = getDailySpiralCoords(0, 2, 0.8, 1.2);
    const oneRev = getDailySpiralCoords(DAYS_PER_MONTH, 2, 0.8, 1.2);

    // same angular position...
    expect(oneRev.x).toBeCloseTo(start.x, 10);
    // ...but pushed outward by exactly radiusGrowth
    expect(oneRev.currentRadius).toBeCloseTo(2.8, 10);
    expect(oneRev.z).toBeCloseTo(2.8, 10);
  });

  it("descends by heightPerRev on every revolution", () => {
    expect(getDailySpiralCoords(0, 2, 0.8, 1.2).y).toBeCloseTo(0, 10);
    expect(getDailySpiralCoords(DAYS_PER_MONTH, 2, 0.8, 1.2).y).toBeCloseTo(-1.2, 10);
    // Four months is two turns now: one on the first, three on the second.
    expect(getDailySpiralCoords(DAYS_PER_MONTH * 4, 2, 0.8, 1.2).y).toBeCloseTo(-2.4, 10);
    // And nine months is three, the third turn carrying five on its own.
    expect(getDailySpiralCoords(DAYS_PER_MONTH * 9, 2, 0.8, 1.2).y).toBeCloseTo(-3.6, 10);
  });

  it("grows the radius monotonically as days advance", () => {
    let previous = -Infinity;
    for (let day = 0; day <= 365; day += 7) {
      const { currentRadius } = getDailySpiralCoords(day);
      expect(currentRadius).toBeGreaterThan(previous);
      previous = currentRadius;
    }
  });

  it("never produces NaN or Infinity, including at the edges", () => {
    for (const day of [0, 0.5, 1, 30.44, 365, 3650, -5]) {
      const c = getDailySpiralCoords(day);
      for (const value of [c.x, c.y, c.z, c.angleRad, c.currentRadius]) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });

  it("scales with the zoom-style multipliers the scene passes in", () => {
    const zoomed = getDailySpiralCoords(DAYS_PER_MONTH, 2 * 2, 0.8 * 2, 1.2 * 2);
    expect(zoomed.currentRadius).toBeCloseTo(5.6, 10);
    expect(zoomed.y).toBeCloseTo(-2.4, 10);
  });
});

describe("generateDailySpiralPoints", () => {
  const firstUse = new Date("2026-01-01T00:00:00");

  it("emits stepsPerDay points per day, plus the closing point", () => {
    const today = new Date("2026-01-11T00:00:00");
    const points = generateDailySpiralPoints(firstUse, today, 4);

    expect(daysBetween(firstUse, today)).toBe(10);
    expect(points).toHaveLength(10 * 4 + 1);
  });

  it("still returns a drawable segment on day zero", () => {
    const points = generateDailySpiralPoints(firstUse, firstUse, 4);
    // a line needs at least two points to render
    expect(points.length).toBeGreaterThanOrEqual(2);
  });

  it("advances dayIndex monotonically and keeps every position finite", () => {
    const today = new Date("2026-04-01T00:00:00");
    const points = generateDailySpiralPoints(firstUse, today, 4);

    let previousIndex = -1;
    for (const p of points) {
      expect(p.dayIndex).toBeGreaterThan(previousIndex);
      previousIndex = p.dayIndex;
      expect(Number.isFinite(p.position.x)).toBe(true);
      expect(Number.isFinite(p.position.y)).toBe(true);
      expect(Number.isFinite(p.position.z)).toBe(true);
    }
  });

  it("clamps to an empty-ish spiral when today precedes firstUseDate", () => {
    const points = generateDailySpiralPoints(firstUse, new Date("2025-06-01T00:00:00"), 4);
    expect(points.length).toBeGreaterThanOrEqual(2);
    expect(points.every((p) => Number.isFinite(p.position.x))).toBe(true);
  });

  it("ignores the time of day when counting days", () => {
    const morning = generateDailySpiralPoints(
      new Date("2026-01-01T08:30:00"),
      new Date("2026-01-11T23:45:00"),
      4
    );
    const midnight = generateDailySpiralPoints(firstUse, new Date("2026-01-11T00:00:00"), 4);
    expect(morning).toHaveLength(midnight.length);
  });
});

describe("getDayPositions", () => {
  const firstUse = new Date("2026-01-01T00:00:00");

  it("returns exactly one position per elapsed day, inclusive of both ends", () => {
    const positions = getDayPositions(firstUse, new Date("2026-01-11T00:00:00"));
    expect(positions).toHaveLength(11);
    expect(positions[0].dayIndex).toBe(0);
    expect(positions[10].dayIndex).toBe(10);
  });

  it("gives each day a distinct date, one calendar day apart", () => {
    const positions = getDayPositions(firstUse, new Date("2026-01-06T00:00:00"));
    for (let i = 1; i < positions.length; i++) {
      const delta = positions[i].date.getTime() - positions[i - 1].date.getTime();
      expect(delta).toBe(1000 * 60 * 60 * 24);
    }
  });

  it("returns a single point when firstUseDate is today", () => {
    expect(getDayPositions(firstUse, firstUse)).toHaveLength(1);
  });
});

describe("getRevolutionsForDay", () => {
  it("gives each turn two months more than the turn inside it", () => {
    // 1 + 3 + 5 + ... + (2N-1) = N squared, so turn N completes once the
    // record covers N squared months.
    for (let turn = 1; turn <= 10; turn++) {
      expect(getRevolutionsForDay(turn * turn * DAYS_PER_MONTH)).toBeCloseTo(turn, 10);

      const held = turn * turn - (turn - 1) * (turn - 1);
      expect(held).toBe(2 * turn - 1);
    }
  });

  it("puts five months on the third turn", () => {
    // The rule stated plainly, since the sequence is easy to misremember:
    // one month, then three, then five.
    expect(getRevolutionsForDay(1 * DAYS_PER_MONTH)).toBeCloseTo(1, 10);
    expect(getRevolutionsForDay(4 * DAYS_PER_MONTH)).toBeCloseTo(2, 10);
    expect(getRevolutionsForDay(9 * DAYS_PER_MONTH)).toBeCloseTo(3, 10);
  });

  it("starts at the origin and never runs backwards", () => {
    expect(getRevolutionsForDay(0)).toBe(0);

    let previous = -Infinity;
    for (let day = 0; day <= 365 * 10; day += 5) {
      const turns = getRevolutionsForDay(day);
      expect(turns).toBeGreaterThan(previous);
      previous = turns;
    }
  });

  it("holds arc length per month under a ceiling however old the record gets", () => {
    // The whole point of the mapping. A turn's circumference grows with N,
    // and so does the number of months it holds, so the two cancel: arc per
    // month climbs toward 2*PI*growth and never passes it, however many
    // decades accumulate. On the old one-month-per-turn rule the same
    // quantity grew without bound.
    // Turn N carries 2N-1 months around a circumference that grows with N,
    // so the ratio settles to PI * growth and stays there.
    const arcPerMonth = (turn: number) =>
      (2 * Math.PI * (SPIRAL_BASE_RADIUS + (turn - 0.5) * SPIRAL_RADIUS_GROWTH)) /
      (2 * turn - 1);

    const settled = Math.PI * SPIRAL_RADIUS_GROWTH;

    for (const years of [1, 3, 10, 25, 50]) {
      const arc = arcPerMonth(getRevolutionsForDay(365 * years));
      expect(arc).toBeGreaterThan(settled * 0.9);
      expect(arc).toBeLessThan(settled * 1.3);
    }
  });

  it("would have grown without bound on the old one-month-per-turn rule", () => {
    // Guards the reason for the mapping: under the old rule month N sat on
    // turn N, so its slice of curve was the whole circumference at that
    // radius and grew forever.
    const linearArcForMonth = (month: number) =>
      2 * Math.PI * (SPIRAL_BASE_RADIUS + month * SPIRAL_RADIUS_GROWTH);

    const settled = Math.PI * SPIRAL_RADIUS_GROWTH;
    expect(linearArcForMonth(120)).toBeGreaterThan(settled * 50);
  });

  it("keeps the outer radius a small fraction of what the old rule gave", () => {
    const years = 10;
    const months = (years * 365) / DAYS_PER_MONTH;

    const triangular =
      SPIRAL_BASE_RADIUS + getRevolutionsForDay(365 * years) * SPIRAL_RADIUS_GROWTH;
    // The old rule put month N on turn N.
    const linear = SPIRAL_BASE_RADIUS + months * SPIRAL_RADIUS_GROWTH;

    expect(triangular / linear).toBeLessThan(0.2);
  });

  it("stays finite before the first entry rather than rooting a negative", () => {
    for (const day of [-1, -5, -400]) {
      expect(Number.isFinite(getRevolutionsForDay(day))).toBe(true);
    }
  });
});
