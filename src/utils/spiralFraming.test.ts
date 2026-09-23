import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { getSpiralFraming, CAMERA_DIRECTION } from "./spiralFraming";
import {
  getDailySpiralCoords,
  SPIRAL_BASE_RADIUS,
  SPIRAL_RADIUS_GROWTH,
  SPIRAL_HEIGHT_PER_REV,
} from "./daily/generateDailySpiralPoints";

/**
 * What decides whether you can see your own record. The failure this
 * replaces was silent: the spiral drew perfectly and simply hung off the
 * bottom of the screen, and it got worse the longer the record was kept —
 * so it would have gone wrong first for the people using it most.
 */

const FOV = 50;
const ASPECT = 1440 / 900;

const at = (iso: string) => new Date(`${iso}T00:00:00`);

const frame = (first: string, today: string, aspect = ASPECT) =>
  getSpiralFraming(at(first), at(today), { fovDegrees: FOV, aspect });

/**
 * Projects a day of the record onto the frame, as a fraction of the way
 * across it from the centre. Anything past 1 is off-screen.
 */
const onScreen = (
  framing: ReturnType<typeof getSpiralFraming>,
  first: string,
  dayIndex: number
) => {
  const { x, y, z } = getDailySpiralCoords(
    dayIndex,
    SPIRAL_BASE_RADIUS,
    SPIRAL_RADIUS_GROWTH,
    SPIRAL_HEIGHT_PER_REV
  );

  const target = new Vector3(framing.target.x, framing.target.y, framing.target.z);
  const forward = CAMERA_DIRECTION.clone().negate();
  const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize();
  const up = new Vector3().crossVectors(right, forward).normalize();

  const offset = new Vector3(x, y, z).sub(target);
  const halfHeight = framing.distance * Math.tan(((FOV * Math.PI) / 180) / 2);

  return {
    h: offset.dot(right) / (halfHeight * ASPECT),
    v: offset.dot(up) / halfHeight,
  };
};

const daysBetween = (first: string, today: string) =>
  Math.round((at(today).getTime() - at(first).getTime()) / (1000 * 60 * 60 * 24));

describe("getSpiralFraming — the whole record fits", () => {
  it.each([
    ["a fortnight", "2026-01-01", "2026-01-15"],
    ["three months", "2026-01-01", "2026-04-01"],
    ["nine months", "2026-01-01", "2026-09-22"],
    ["three years", "2023-01-01", "2026-01-01"],
    ["ten years", "2016-01-01", "2026-01-01"],
  ])("keeps %s of record inside the frame", (_label, first, today) => {
    const framing = frame(first, today);
    const total = daysBetween(first, today);

    for (let i = 0; i <= 200; i++) {
      const { h, v } = onScreen(framing, first, (total * i) / 200);
      expect(Math.abs(h), `day ${Math.round((total * i) / 200)} ran off the side`).toBeLessThan(1);
      expect(Math.abs(v), `day ${Math.round((total * i) / 200)} ran off the top or bottom`).toBeLessThan(1);
    }
  });

  it("fills the frame rather than sitting in the middle of it", () => {
    // The cylinder approximation this replaced was correct but ~70% too far
    // back, which is its own kind of broken: a record you cannot read.
    const framing = frame("2026-01-01", "2026-09-22");
    const total = daysBetween("2026-01-01", "2026-09-22");

    let widest = 0;
    for (let i = 0; i <= 200; i++) {
      const { h, v } = onScreen(framing, "2026-01-01", (total * i) / 200);
      widest = Math.max(widest, Math.abs(h), Math.abs(v));
    }

    expect(widest).toBeGreaterThan(0.6);
  });

  it("steps back as the record grows instead of cropping it", () => {
    const short = frame("2026-01-01", "2026-02-01");
    const long = frame("2026-01-01", "2026-09-22");

    expect(long.distance).toBeGreaterThan(short.distance);
  });

  it("steps back further on a narrow window", () => {
    // On a portrait viewport the width is the binding constraint, and a
    // framing that only ever fits the height crops the sides.
    const wide = frame("2026-01-01", "2026-09-22", 16 / 9);
    const narrow = frame("2026-01-01", "2026-09-22", 3 / 4);

    expect(narrow.distance).toBeGreaterThan(wide.distance);
  });
});

describe("getSpiralFraming — where it points", () => {
  it("does not point at the origin once the record has some depth", () => {
    // The origin is where the spiral BEGINS, which after a few months is up
    // near the top edge of the picture — orbiting around it swung the whole
    // record around a point off the side of the frame.
    const framing = frame("2026-01-01", "2026-09-22");

    expect(Math.hypot(framing.target.x, framing.target.y, framing.target.z)).toBeGreaterThan(1);
  });

  it("puts the record's middle in the middle of the frame", () => {
    const framing = frame("2026-01-01", "2026-09-22");
    const total = daysBetween("2026-01-01", "2026-09-22");

    let minH = Infinity, maxH = -Infinity, minV = Infinity, maxV = -Infinity;
    for (let i = 0; i <= 200; i++) {
      const { h, v } = onScreen(framing, "2026-01-01", (total * i) / 200);
      minH = Math.min(minH, h); maxH = Math.max(maxH, h);
      minV = Math.min(minV, v); maxV = Math.max(maxV, v);
    }

    expect(Math.abs(minH + maxH)).toBeLessThan(0.1);
    expect(Math.abs(minV + maxV)).toBeLessThan(0.1);
  });

  it("stands the camera off along the viewing direction", () => {
    const framing = frame("2026-01-01", "2026-09-22");
    const offset = new Vector3(
      framing.position.x - framing.target.x,
      framing.position.y - framing.target.y,
      framing.position.z - framing.target.z
    );

    expect(offset.length()).toBeCloseTo(framing.distance, 5);
    expect(offset.normalize().dot(CAMERA_DIRECTION)).toBeCloseTo(1, 5);
  });
});

describe("getSpiralFraming — degenerate records", () => {
  it("does not put the camera inside the origin portal on day one", () => {
    const framing = frame("2026-01-01", "2026-01-01");

    expect(framing.distance).toBeGreaterThan(4);
    expect(Number.isFinite(framing.distance)).toBe(true);
  });

  it("looks at the origin on day one rather than beside it", () => {
    // The whole record is one point at the origin. Framing a minimum number
    // of TURNS instead of a minimum extent centred the view on the middle
    // of an arc that had not been lived yet, leaving the single entry and
    // the figure standing on it off to one side of the frame.
    const framing = frame("2026-01-01", "2026-01-01");

    expect(Math.hypot(framing.target.x, framing.target.y, framing.target.z)).toBeLessThan(0.5);
  });

  it("frames a record dated in the future as if it were new", () => {
    const framing = frame("2026-09-22", "2026-01-01");

    expect(Number.isFinite(framing.distance)).toBe(true);
    expect(framing.distance).toBeGreaterThan(0);
  });

  it("survives a nonsense aspect ratio", () => {
    for (const aspect of [0, -1, NaN, Infinity]) {
      const framing = getSpiralFraming(at("2026-01-01"), at("2026-09-22"), {
        fovDegrees: FOV,
        aspect,
      });
      expect(Number.isFinite(framing.distance)).toBe(true);
    }
  });

  it("scales with zoom", () => {
    const one = getSpiralFraming(at("2026-01-01"), at("2026-09-22"), { zoom: 1, aspect: ASPECT });
    const two = getSpiralFraming(at("2026-01-01"), at("2026-09-22"), { zoom: 2, aspect: ASPECT });

    expect(two.distance).toBeGreaterThan(one.distance);
  });
});
