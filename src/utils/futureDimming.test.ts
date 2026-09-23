import { describe, it, expect } from "vitest";
import { getFutureDimming, FUTURE_FLOOR, FUTURE_HORIZON_DAYS,
  getProjectionDensity,
  PROJECTION_DENSITY_FLOOR,
} from "./futureDimming";

/**
 * The past is solid, the future is a ghost. If this inverts or flattens, a
 * thing you only anticipate starts carrying the same visual weight as a day
 * you actually lived — which is the one claim the spiral must not make.
 */

const TODAY = new Date("2026-06-15T00:00:00");

const inDays = (n: number) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + n);
  return d;
};

describe("getFutureDimming", () => {
  it("draws today at full strength", () => {
    expect(getFutureDimming(TODAY, TODAY)).toBe(1);
  });

  it("draws the past at full strength", () => {
    for (const days of [-1, -30, -400]) {
      expect(getFutureDimming(inDays(days), TODAY)).toBe(1);
    }
  });

  it("never draws a projection below the floor", () => {
    for (const days of [FUTURE_HORIZON_DAYS, 200, 5000]) {
      expect(getFutureDimming(inDays(days), TODAY)).toBe(FUTURE_FLOOR);
    }
  });

  it("never lets an unlived day reach the solidity of a lived one", () => {
    for (let days = 1; days < FUTURE_HORIZON_DAYS; days++) {
      const value = getFutureDimming(inDays(days), TODAY);
      expect(value).toBeGreaterThanOrEqual(FUTURE_FLOOR);
      expect(value).toBeLessThan(1);
    }
  });

  it("keeps a projection a few days out clearly a ghost", () => {
    // The case that exposed the bug: a birthday four days away used to draw
    // at 93%, which is why the future still looked lit. A gentler easing
    // made anything inside a week read as already lived.
    expect(getFutureDimming(inDays(4), TODAY)).toBeLessThan(0.6);
    expect(getFutureDimming(inDays(7), TODAY)).toBeLessThan(0.45);
  });

  it("brightens monotonically as the date approaches", () => {
    let previous = 0;
    for (let days = FUTURE_HORIZON_DAYS; days >= 0; days--) {
      const value = getFutureDimming(inDays(days), TODAY);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it("keeps the far half of the horizon genuinely faint", () => {
    // Eased, not linear: at the midpoint a linear ramp would already be
    // ~62% solid, which reads as lived rather than anticipated.
    const midpoint = getFutureDimming(inDays(FUTURE_HORIZON_DAYS / 2), TODAY);
    expect(midpoint).toBeLessThan(0.5);
  });

  it("approaches solid smoothly rather than snapping on arrival", () => {
    // A hard cutoff at the horizon made a projection pop from ghost to
    // lived overnight. The last few days should visibly gather weight.
    const week = getFutureDimming(inDays(7), TODAY);
    const days = getFutureDimming(inDays(2), TODAY);
    const tomorrow = getFutureDimming(inDays(1), TODAY);

    expect(days).toBeGreaterThan(week);
    expect(tomorrow).toBeGreaterThan(days);
    expect(tomorrow).toBeLessThan(1);
    expect(getFutureDimming(TODAY, TODAY)).toBe(1);
  });

  it("ignores the time of day", () => {
    const morning = getFutureDimming(new Date("2026-06-25T09:30:00"), TODAY);
    const midnight = getFutureDimming(new Date("2026-06-25T00:00:00"), TODAY);
    expect(morning).toBe(midnight);
  });

  it("respects a custom horizon and floor", () => {
    expect(getFutureDimming(inDays(10), TODAY, 10, 0.1)).toBeCloseTo(0.1, 5);
    expect(getFutureDimming(inDays(40), TODAY, 10, 0.1)).toBeCloseTo(0.1, 5);
  });

  it("degrades safely on a zero horizon", () => {
    expect(getFutureDimming(inDays(3), TODAY, 0)).toBe(FUTURE_FLOOR);
  });
});

describe("getProjectionDensity", () => {
  it("leaves a lived day at full density", () => {
    expect(getProjectionDensity(1)).toBe(1);
  });

  it("bottoms out at the floor rather than deleting the entry", () => {
    expect(getProjectionDensity(0)).toBe(PROJECTION_DENSITY_FLOOR);
    expect(PROJECTION_DENSITY_FLOOR).toBeGreaterThan(0);
  });

  it("thins monotonically as a projection gets further off", () => {
    let previous = Infinity;
    for (let i = 10; i >= 0; i--) {
      const density = getProjectionDensity(i / 10);
      expect(density).toBeLessThanOrEqual(previous);
      previous = density;
    }
  });

  it("clamps nonsense input instead of inverting the cluster", () => {
    expect(getProjectionDensity(-5)).toBe(PROJECTION_DENSITY_FLOOR);
    expect(getProjectionDensity(42)).toBe(1);
    expect(getProjectionDensity(Number.NaN)).toBe(PROJECTION_DENSITY_FLOOR);
  });

  it("actually thins a near-future entry, not just its opacity", () => {
    // The regression this exists to stop: dimming alpha alone left a dense
    // additively-blended cluster saturating to white, so the future kept
    // looking lived however hard the curve was pulled down.
    const fourDaysOut = getFutureDimming(inDays(4), TODAY);
    expect(getProjectionDensity(fourDaysOut)).toBeLessThan(0.8);
  });
});
