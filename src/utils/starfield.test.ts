import { describe, it, expect } from "vitest";
import {
  generateStarfield,
  blackbodyToRgb,
  pickSpectralClass,
  SPECTRAL_CLASSES,
} from "./starfield";

/** Deterministic RNG so distribution assertions cannot flake. */
const seeded = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe("SPECTRAL_CLASSES", () => {
  it("describes a whole population", () => {
    const total = SPECTRAL_CLASSES.reduce((sum, s) => sum + s.weight, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it("is dominated by the cool classes, as the real sky is", () => {
    const cool = SPECTRAL_CLASSES.filter((s) => s.letter === "M" || s.letter === "K")
      .reduce((sum, s) => sum + s.weight, 0);
    expect(cool).toBeGreaterThan(0.8);
  });
});

describe("pickSpectralClass", () => {
  it("returns the commonest class for a low sample", () => {
    expect(pickSpectralClass(0).letter).toBe("M");
    expect(pickSpectralClass(0.5).letter).toBe("M");
  });

  it("reaches the rare hot classes only at the very top", () => {
    expect(pickSpectralClass(0.999).letter).toBe("B");
  });

  it("never falls off the end", () => {
    expect(pickSpectralClass(1).letter).toBeTruthy();
    expect(pickSpectralClass(0.9999999).letter).toBeTruthy();
  });
});

describe("blackbodyToRgb", () => {
  it("makes cool stars red and hot stars blue", () => {
    const cool = blackbodyToRgb(2400);
    const hot = blackbodyToRgb(28000);

    expect(cool[0]).toBeGreaterThan(cool[2]);
    expect(hot[2]).toBeGreaterThan(hot[0]);
  });

  it("brightens the blue channel monotonically with temperature", () => {
    let previous = -1;
    for (const kelvin of [2000, 3000, 4000, 5000, 6000, 8000, 12000, 20000]) {
      const blue = blackbodyToRgb(kelvin)[2];
      expect(blue).toBeGreaterThanOrEqual(previous);
      previous = blue;
    }
  });

  it("keeps every channel inside 0..1, however extreme the input", () => {
    for (const kelvin of [-5000, 0, 500, 1000, 40000, 999999]) {
      for (const channel of blackbodyToRgb(kelvin)) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
        expect(Number.isFinite(channel)).toBe(true);
      }
    }
  });
});

describe("generateStarfield", () => {
  it("fills every buffer to the requested count", () => {
    const stars = generateStarfield({ count: 500, random: seeded(1) });

    expect(stars.positions.length).toBe(1500);
    expect(stars.colors.length).toBe(1500);
    expect(stars.sizes.length).toBe(500);
    expect(stars.phases.length).toBe(500);
    expect(stars.rates.length).toBe(500);
  });

  it("keeps every star on the shell", () => {
    const stars = generateStarfield({
      count: 400,
      radiusMin: 70,
      radiusMax: 140,
      random: seeded(2),
    });

    for (let i = 0; i < 400; i++) {
      const i3 = i * 3;
      const radius = Math.hypot(
        stars.positions[i3],
        stars.positions[i3 + 1],
        stars.positions[i3 + 2]
      );
      expect(radius).toBeGreaterThanOrEqual(69.9);
      expect(radius).toBeLessThanOrEqual(140.1);
    }
  });

  it("gives every star a positive, finite size", () => {
    const stars = generateStarfield({ count: 600, random: seeded(3) });

    for (const size of stars.sizes) {
      expect(size).toBeGreaterThan(0);
      expect(Number.isFinite(size)).toBe(true);
    }
  });

  it("keeps colour channels displayable", () => {
    const stars = generateStarfield({ count: 600, random: seeded(4) });

    for (const channel of stars.colors) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(1);
    }
  });

  it("produces a mostly warm sky rather than a white one", () => {
    // The whole point of sampling spectral classes: a real field is
    // overwhelmingly red and orange. A uniform white scatter was the
    // clearest tell that the old backdrop was generated.
    const stars = generateStarfield({ count: 2000, random: seeded(5) });

    let warmer = 0;
    for (let i = 0; i < 2000; i++) {
      const i3 = i * 3;
      if (stars.colors[i3] > stars.colors[i3 + 2]) warmer++;
    }

    expect(warmer / 2000).toBeGreaterThan(0.85);
  });

  it("skews brightness hard toward faint", () => {
    const stars = generateStarfield({ count: 2000, random: seeded(6) });

    const sorted = Array.from(stars.sizes).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const brightest = sorted[sorted.length - 1];

    // Most stars sit near the floor while a few carry real size — the
    // magnitude distribution, not an even spread.
    expect(median).toBeLessThan(brightest / 2);
  });

  it("gathers band stars around the galactic plane", () => {
    const flat = (bandFraction: number) => {
      const stars = generateStarfield({
        count: 1500,
        bandFraction,
        bandTilt: 0,
        random: seeded(7),
      });

      let total = 0;
      for (let i = 0; i < 1500; i++) {
        const i3 = i * 3;
        const radius = Math.hypot(
          stars.positions[i3],
          stars.positions[i3 + 1],
          stars.positions[i3 + 2]
        );
        total += Math.abs(stars.positions[i3 + 1]) / radius;
      }
      return total / 1500;
    };

    // With no band the sky is uniform, so the mean distance from the plane
    // is high; pulling every star into the band collapses it.
    expect(flat(1)).toBeLessThan(flat(0) / 2);
  });

  it("cuts a darker lane through the middle of the band", () => {
    const stars = generateStarfield({
      count: 4000,
      bandFraction: 1,
      bandTilt: 0,
      dustLaneWidth: 0.05,
      random: seeded(8),
    });

    let laneTotal = 0;
    let laneCount = 0;
    let edgeTotal = 0;
    let edgeCount = 0;

    for (let i = 0; i < 4000; i++) {
      const i3 = i * 3;
      const radius = Math.hypot(
        stars.positions[i3],
        stars.positions[i3 + 1],
        stars.positions[i3 + 2]
      );
      const latitude = Math.asin(stars.positions[i3 + 1] / radius);

      if (Math.abs(latitude) < 0.012) {
        laneTotal += stars.sizes[i];
        laneCount++;
      } else if (Math.abs(latitude) > 0.1) {
        edgeTotal += stars.sizes[i];
        edgeCount++;
      }
    }

    expect(laneCount).toBeGreaterThan(20);
    expect(edgeCount).toBeGreaterThan(20);
    expect(laneTotal / laneCount).toBeLessThan(edgeTotal / edgeCount);
  });

  it("gives each star its own twinkle rate and phase", () => {
    const stars = generateStarfield({ count: 300, random: seeded(9) });

    expect(new Set(Array.from(stars.phases)).size).toBeGreaterThan(250);
    expect(new Set(Array.from(stars.rates)).size).toBeGreaterThan(250);
    for (const rate of stars.rates) expect(rate).toBeGreaterThan(0);
  });
});
