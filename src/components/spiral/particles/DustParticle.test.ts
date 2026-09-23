import { describe, it, expect, vi, afterEach } from "vitest";
import * as THREE from "three";
import { getColorVariation } from "./DustParticle";

/**
 * Every particle in a cluster gets a slightly different shade so the cluster
 * reads as dust rather than a flat blob. The variation must stay subtle: it
 * may shift saturation and lightness, but never the hue, or a "joy" cluster
 * would drift away from its category colour.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

const hslOf = (color: THREE.Color) => {
  const out = { h: 0, s: 0, l: 0 };
  color.getHSL(out);
  return out;
};

describe("getColorVariation", () => {
  it("does not mutate the colour it was handed", () => {
    const base = new THREE.Color("#F5A623");
    const before = base.getHex();

    getColorVariation(base, 0.05);

    expect(base.getHex()).toBe(before);
  });

  it("returns a different Color instance", () => {
    const base = new THREE.Color("#F5A623");
    expect(getColorVariation(base, 0.05)).not.toBe(base);
  });

  it("preserves hue exactly, which is what carries the sentiment", () => {
    const base = new THREE.Color("#F5A623");
    const baseHue = hslOf(base).h;

    for (let i = 0; i < 200; i++) {
      expect(hslOf(getColorVariation(base, 0.1)).h).toBeCloseTo(baseHue, 5);
    }
  });

  it("leaves the colour untouched when the random draw is neutral", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const base = new THREE.Color("#F5A623");
    const varied = getColorVariation(base, 0.05);

    expect(varied.r).toBeCloseTo(base.r, 5);
    expect(varied.g).toBeCloseTo(base.g, 5);
    expect(varied.b).toBeCloseTo(base.b, 5);
  });

  it("keeps lightness inside the visible band", () => {
    for (const hex of ["#F5A623", "#2E5BBA", "#000000", "#FFFFFF"]) {
      const base = new THREE.Color(hex);
      for (let i = 0; i < 100; i++) {
        const { l } = hslOf(getColorVariation(base, 0.5));
        expect(l).toBeGreaterThanOrEqual(0.2 - 1e-6);
        expect(l).toBeLessThanOrEqual(0.9 + 1e-6);
      }
    }
  });

  it("lifts pure black to the minimum lightness so particles stay visible", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const { l } = hslOf(getColorVariation(new THREE.Color("#000000"), 0.05));
    expect(l).toBeCloseTo(0.2, 5);
  });

  it("keeps saturation within range", () => {
    const base = new THREE.Color("#F5A623");
    for (let i = 0; i < 100; i++) {
      const { s } = hslOf(getColorVariation(base, 0.9));
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  it("varies more when given a larger strength", () => {
    const base = new THREE.Color("#7F7F7F");
    const spread = (strength: number) => {
      const values = Array.from({ length: 300 }, () => hslOf(getColorVariation(base, strength)).l);
      return Math.max(...values) - Math.min(...values);
    };
    expect(spread(0.4)).toBeGreaterThan(spread(0.02));
  });

  it("always yields channels THREE can render", () => {
    const base = new THREE.Color("#E05AA0");
    for (let i = 0; i < 200; i++) {
      const c = getColorVariation(base, 0.3);
      for (const channel of [c.r, c.g, c.b]) {
        expect(Number.isFinite(channel)).toBe(true);
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
  });
});
