import { describe, it, expect } from "vitest";
import { calculateDailySegment } from "./dailyDurationSegments";
import { getDailySpiralCoords } from "./generateDailySpiralPoints";

/**
 * Duration segments are the smeared trails — a feeling that lasted weeks is
 * drawn as a ribbon of particles along this path. If the path collapses or
 * inverts, a "since that day" entry stops reading as duration.
 */

const firstUse = new Date("2026-01-01T00:00:00");

describe("calculateDailySegment", () => {
  it("returns one more point than requested, so both ends are included", () => {
    const points = calculateDailySegment(
      new Date("2026-02-01T00:00:00"),
      new Date("2026-03-01T00:00:00"),
      firstUse,
      100
    );
    expect(points).toHaveLength(101);
  });

  it("caps the point count so a long span cannot blow up the buffer", () => {
    const points = calculateDailySegment(
      new Date("2026-01-01T00:00:00"),
      new Date("2030-01-01T00:00:00"),
      firstUse,
      5000
    );
    expect(points).toHaveLength(501);
  });

  it("starts the segment at the start date's spiral coordinate", () => {
    const start = new Date("2026-02-01T00:00:00");
    const points = calculateDailySegment(start, new Date("2026-03-01T00:00:00"), firstUse, 50);

    const dayIndex = 31; // 1 Jan -> 1 Feb
    const expected = getDailySpiralCoords(dayIndex);
    expect(points[0].x).toBeCloseTo(expected.x, 6);
    expect(points[0].y).toBeCloseTo(expected.y, 6);
    expect(points[0].z).toBeCloseTo(expected.z, 6);
  });

  it("ends the segment at the end date's spiral coordinate", () => {
    const points = calculateDailySegment(
      new Date("2026-02-01T00:00:00"),
      new Date("2026-03-01T00:00:00"),
      firstUse,
      50
    );
    const expected = getDailySpiralCoords(59); // 1 Jan -> 1 Mar
    expect(points[points.length - 1].x).toBeCloseTo(expected.x, 6);
    expect(points[points.length - 1].z).toBeCloseTo(expected.z, 6);
  });

  it("descends monotonically, matching the spiral's downward sweep", () => {
    const points = calculateDailySegment(
      new Date("2026-02-01T00:00:00"),
      new Date("2026-05-01T00:00:00"),
      firstUse,
      120
    );
    for (let i = 1; i < points.length; i++) {
      expect(points[i].y).toBeLessThan(points[i - 1].y);
    }
  });

  it("collapses to a single spot for a same-day feeling", () => {
    const day = new Date("2026-02-10T00:00:00");
    const points = calculateDailySegment(day, day, firstUse, 20);

    expect(points).toHaveLength(21);
    for (const p of points) {
      expect(p.x).toBeCloseTo(points[0].x, 10);
      expect(p.y).toBeCloseTo(points[0].y, 10);
      expect(p.z).toBeCloseTo(points[0].z, 10);
    }
  });

  it("clamps a backwards range instead of drawing in reverse", () => {
    const points = calculateDailySegment(
      new Date("2026-03-01T00:00:00"),
      new Date("2026-02-01T00:00:00"),
      firstUse,
      20
    );
    // end is pinned to start, so the ribbon degenerates to a point
    for (const p of points) {
      expect(p.x).toBeCloseTo(points[0].x, 10);
      expect(p.z).toBeCloseTo(points[0].z, 10);
    }
  });

  it("clamps dates before firstUseDate to the spiral origin", () => {
    const points = calculateDailySegment(
      new Date("2025-06-01T00:00:00"),
      new Date("2026-02-01T00:00:00"),
      firstUse,
      30
    );
    const origin = getDailySpiralCoords(0);
    expect(points[0].x).toBeCloseTo(origin.x, 6);
    expect(points[0].z).toBeCloseTo(origin.z, 6);
  });

  it("never emits a non-finite coordinate", () => {
    const points = calculateDailySegment(
      new Date("2026-02-01T00:00:00"),
      new Date("2027-02-01T00:00:00"),
      firstUse,
      200
    );
    for (const p of points) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
      expect(Number.isFinite(p.z)).toBe(true);
    }
  });
});
