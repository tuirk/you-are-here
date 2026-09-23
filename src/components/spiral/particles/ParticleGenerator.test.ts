/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { Vector3 } from "three";
import {
  useGenerateParticles,
  getBandSpread,
  getBandDensityScale,
} from "./ParticleGenerator";
import {
  DAYS_PER_MONTH,
  SPIRAL_RADIUS_GROWTH,
  SPIRAL_HEIGHT_PER_REV,
} from "@/utils/daily/generateDailySpiralPoints";

/**
 * These are the load-bearing tests for the visualization.
 *
 * Every emotional cluster on the spiral is a Float32Array of positions,
 * sizes, opacities and colours produced here. A single NaN in the position
 * buffer makes THREE silently drop the entire cluster — the particles just
 * vanish, with no error in the console. That failure mode is the reason
 * this file exists.
 */

const path = (n: number) =>
  Array.from({ length: n }, (_, i) => new Vector3(i * 0.1, -i * 0.05, i * 0.2));

const generate = (overrides: Partial<Parameters<typeof useGenerateParticles>[0]> = {}) =>
  renderHook(() =>
    useGenerateParticles({
      color: "#F5A623",
      intensity: 0.5,
      points: path(120),
      particleCount: 200,
      ...overrides,
    })
  ).result.current;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useGenerateParticles — buffer shape", () => {
  it("keeps every buffer in step, at the band's scaled count", () => {
    // The caller's count is a density quoted against a reference band
    // width, not a literal number of motes — see getBandDensityScale. What
    // has to hold is that all five buffers agree, since a mismatch makes
    // THREE drop the cluster silently.
    const requested = 350;
    const scaled = Math.round(requested * getBandDensityScale({}));
    const { positions, sizes, opacities, colors, phases } = generate({
      particleCount: requested,
    });

    expect(positions).toBeInstanceOf(Float32Array);
    expect(sizes).toHaveLength(scaled);
    expect(opacities).toHaveLength(scaled);
    expect(phases).toHaveLength(scaled);
    expect(positions).toHaveLength(scaled * 3);
    expect(colors).toHaveLength(scaled * 3);
  });

  it("trims the caller's count to what the geometry can carry", () => {
    // This was briefly (spread/reference)^2.1, about 5x, sized against the
    // band's volume. Additive brightness follows projected density rather
    // than volume, so that put roughly five times more dust on the curve
    // than it could hold and clamped every core to white.
    for (const layer of [
      {},
      { isBackgroundLayer: true },
      { isTertiaryLayer: true },
      { isRoughDate: true },
      { isRoughDate: true, isBackgroundLayer: true },
    ]) {
      const scale = getBandDensityScale(layer);
      expect(Number.isFinite(scale)).toBe(true);
      expect(scale).toBeGreaterThan(0);
      expect(scale).toBeLessThanOrEqual(1);
      expect(getBandSpread(layer).along).toBeGreaterThan(0);
      expect(getBandSpread(layer).across).toBeGreaterThan(0);
    }
  });

  it("keeps a cluster inside a couple of days of arc, along the curve", () => {
    // The constraint the white cores came from. Reach along the curve is
    // what decides whether two entries in the same week land on each other
    // and sum past the clamp, so it is measured in days, not world units.
    // PI * SPIRAL_RADIUS_GROWTH / DAYS_PER_MONTH, the settled arc a day
    // occupies once the mapping stops accelerating.
    const ARC_PER_DAY = (Math.PI * SPIRAL_RADIUS_GROWTH) / DAYS_PER_MONTH;
    for (const layer of [{}, { isBackgroundLayer: true }, { isTertiaryLayer: true }]) {
      // Bell 2-sigma reach, at the widest intensity scaling.
      const reach = 0.7 * getBandSpread(layer).along * 1.3;
      expect(reach / ARC_PER_DAY).toBeLessThan(2.5);
    }
  });

  it("gives the band real girth across the curve", () => {
    // The other half of the same split. Across the curve there is nothing
    // to collide with, so this is free to be several times the reach along
    // it — and it has to be, or the record draws as a wire.
    for (const layer of [{}, { isBackgroundLayer: true }, { isTertiaryLayer: true }]) {
      const { along, across } = getBandSpread(layer);
      expect(across / along).toBeGreaterThan(2);
    }
  });

  it("never lets the girth reach the next turn of the spiral", () => {
    // Both turns throw dust into the gap between them, so each may use at
    // most half of it — and less, or no dark is left to read the turns
    // apart. Past this the spiral stops being a spiral and becomes a disc,
    // with the overlap summing to white.
    const turnGap = Math.hypot(SPIRAL_RADIUS_GROWTH, SPIRAL_HEIGHT_PER_REV);
    for (const layer of [{}, { isBackgroundLayer: true }, { isTertiaryLayer: true }]) {
      // Bell 2-sigma reach, at the widest intensity scaling.
      const reach = 0.7 * getBandSpread(layer).across * 1.3;
      expect(reach).toBeLessThan(turnGap / 2);
    }
  });

  it("produces empty buffers rather than throwing on a zero count", () => {
    const { positions, sizes } = generate({ particleCount: 0 });
    expect(positions).toHaveLength(0);
    expect(sizes).toHaveLength(0);
  });
});

describe("useGenerateParticles — no silent cluster loss", () => {
  it("never writes NaN or Infinity into any buffer", () => {
    const { positions, sizes, opacities, colors } = generate({ particleCount: 500 });

    for (const [name, buffer] of Object.entries({ positions, sizes, opacities, colors })) {
      for (let i = 0; i < buffer.length; i++) {
        if (!Number.isFinite(buffer[i])) {
          throw new Error(`${name}[${i}] is ${buffer[i]} — the cluster would vanish`);
        }
      }
    }
  });

  it("stays finite across the whole intensity range", () => {
    for (const intensity of [0, 0.25, 0.5, 0.75, 1]) {
      const { positions, opacities } = generate({ intensity, particleCount: 100 });
      expect(positions.every(Number.isFinite)).toBe(true);
      expect(opacities.every(Number.isFinite)).toBe(true);
    }
  });

  it("stays finite for every layer and date-precision combination", () => {
    const flags = [true, false];
    for (const isBackgroundLayer of flags) {
      for (const isTertiaryLayer of flags) {
        for (const isRoughDate of flags) {
          for (const isMinimalDuration of flags) {
            const { positions, sizes, opacities, colors } = generate({
              particleCount: 60,
              isBackgroundLayer,
              isTertiaryLayer,
              isRoughDate,
              isMinimalDuration,
            });
            const label = `bg=${isBackgroundLayer} tert=${isTertiaryLayer} rough=${isRoughDate} min=${isMinimalDuration}`;
            expect(positions.every(Number.isFinite), label).toBe(true);
            expect(sizes.every(Number.isFinite), label).toBe(true);
            expect(opacities.every(Number.isFinite), label).toBe(true);
            expect(colors.every(Number.isFinite), label).toBe(true);
          }
        }
      }
    }
  });

  it("survives a single-point path without producing NaN", () => {
    // A same-day entry collapses the path to almost nothing; indexing must
    // still land on a real point rather than running off the end.
    for (const length of [1, 2, 3]) {
      const { positions } = generate({ points: path(length), particleCount: 50 });
      expect(positions.every(Number.isFinite)).toBe(true);
    }
  });
});

describe("useGenerateParticles — visible output", () => {
  it("gives every particle a positive size", () => {
    const { sizes } = generate({ particleCount: 300 });
    expect(Math.min(...sizes)).toBeGreaterThan(0);
  });

  it("gives every particle a usable opacity", () => {
    const { opacities } = generate({ particleCount: 300 });
    for (const o of opacities) {
      expect(o).toBeGreaterThan(0);
      expect(o).toBeLessThanOrEqual(1);
    }
  });

  it("keeps colour channels inside the 0-1 range THREE expects", () => {
    const { colors } = generate({ particleCount: 300 });
    for (const c of colors) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });

  it("tints particles with the colour it was given, not some default", () => {
    const warm = generate({ color: "#F5A623", particleCount: 200 });
    const cold = generate({ color: "#2E5BBA", particleCount: 200 });

    const meanRed = (b: Float32Array) => {
      let sum = 0;
      for (let i = 0; i < b.length; i += 3) sum += b[i];
      return sum / (b.length / 3);
    };
    const meanBlue = (b: Float32Array) => {
      let sum = 0;
      for (let i = 2; i < b.length; i += 3) sum += b[i];
      return sum / (b.length / 3);
    };

    expect(meanRed(warm.colors)).toBeGreaterThan(meanRed(cold.colors));
    expect(meanBlue(cold.colors)).toBeGreaterThan(meanBlue(warm.colors));
  });

  it("draws larger particles for the background layer than the foreground", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const background = generate({ isBackgroundLayer: true, particleCount: 10 });
    const tertiary = generate({ isTertiaryLayer: true, particleCount: 10 });
    const foreground = generate({ particleCount: 10 });

    expect(background.sizes[0]).toBeGreaterThan(tertiary.sizes[0]);
    expect(tertiary.sizes[0]).toBeGreaterThan(foreground.sizes[0]);
  });
});

describe("useGenerateParticles — placement", () => {
  it("places particles on the path when the random offset is zero", () => {
    // Math.random() === 0.5 makes every (random - 0.5) offset exactly zero,
    // so each particle lands precisely on its chosen path point.
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const points = path(120);
    const { positions } = generate({ points, particleCount: 20 });
    const expected = points[Math.floor(0.5 * (points.length - 1))];

    for (let i = 0; i < positions.length; i += 3) {
      expect(positions[i]).toBeCloseTo(expected.x, 5);
      expect(positions[i + 1]).toBeCloseTo(expected.y, 5);
      expect(positions[i + 2]).toBeCloseTo(expected.z, 5);
    }
  });

  it("scatters particles around the path rather than stacking them", () => {
    const { positions } = generate({ particleCount: 400 });
    const xs = new Set<number>();
    for (let i = 0; i < positions.length; i += 3) xs.add(positions[i]);
    expect(xs.size).toBeGreaterThan(50);
  });

  it("keeps every particle within reach of the path it decorates", () => {
    const points = path(120);
    const { positions } = generate({ points, particleCount: 400, isRoughDate: true });

    const xsOfPath = points.map((p) => p.x);
    const min = Math.min(...xsOfPath);
    const max = Math.max(...xsOfPath);
    // generous bound: the widest spread config cannot fling particles far
    // from the path without the cluster reading as noise
    for (let i = 0; i < positions.length; i += 3) {
      expect(positions[i]).toBeGreaterThan(min - 3);
      expect(positions[i]).toBeLessThan(max + 3);
    }
  });
});

describe("useGenerateParticles — the band follows the curve", () => {
  /**
   * A path running straight along one axis, and barely anywhere at all.
   *
   * The spacing is deliberately tiny. Particles are scattered across the
   * whole path, so on a path of any real length the spread along it is
   * dominated by the path itself rather than by the offsets — which is what
   * these tests are trying to read. Shrinking the path to a thousandth of
   * an offset leaves the offsets as the only thing moving, while still
   * giving the tangent a direction to be computed from.
   */
  const straight = (axis: 0 | 1 | 2, n = 120) =>
    Array.from({ length: n }, (_, i) => {
      const v = new Vector3(0, 0, 0);
      v.setComponent(axis, i * 0.001);
      return v;
    });

  const spreadOf = (positions: Float32Array, axis: 0 | 1 | 2) => {
    const count = positions.length / 3;
    let mean = 0;
    for (let i = 0; i < count; i++) mean += positions[i * 3 + axis];
    mean /= count;
    let variance = 0;
    for (let i = 0; i < count; i++) {
      const d = positions[i * 3 + axis] - mean;
      variance += d * d;
    }
    return Math.sqrt(variance / count);
  };

  it("scatters a cluster far wider across the curve than along it", () => {
    // The whole point of the local frame. In world axes this was one number
    // and the two could not differ.
    const { positions } = generate({ points: straight(0), particleCount: 3000 });

    expect(spreadOf(positions, 2) / spreadOf(positions, 0)).toBeGreaterThan(2);
  });

  it("gives the band the same girth sideways as vertically", () => {
    // A ribbon, not a blade: the two directions perpendicular to the curve
    // are treated alike, so the tube reads the same from any angle.
    const { positions } = generate({ points: straight(0), particleCount: 3000 });
    const ratio = spreadOf(positions, 1) / spreadOf(positions, 2);

    expect(ratio).toBeGreaterThan(0.8);
    expect(ratio).toBeLessThan(1.25);
  });

  it("turns the band with the curve rather than holding it to world axes", () => {
    // The same cluster on a path running along +z. If the offsets were
    // still taken in world axes, both would come out identical — here the
    // tight axis has to move with the curve.
    const { positions } = generate({ points: straight(2), particleCount: 3000 });

    expect(spreadOf(positions, 0) / spreadOf(positions, 2)).toBeGreaterThan(2);
  });
});

describe("useGenerateParticles — splatter", () => {
  const straightPath = (n = 120) =>
    Array.from({ length: n }, (_, i) => new Vector3(i * 0.001, 0, 0));

  const acrossSpread = (positions: Float32Array) => {
    const count = positions.length / 3;
    let mean = 0;
    for (let i = 0; i < count; i++) mean += positions[i * 3 + 2];
    mean /= count;
    let variance = 0;
    for (let i = 0; i < count; i++) {
      const d = positions[i * 3 + 2] - mean;
      variance += d * d;
    }
    return Math.sqrt(variance / count);
  };

  /** Averaged over many clusters, since any one of them rolls its own shape. */
  const meanAcross = (overrides = {}) => {
    let total = 0;
    const seeds = 24;
    for (let i = 0; i < seeds; i++) {
      const { positions } = generate({
        points: straightPath(),
        particleCount: 900,
        shapeSeed: i / seeds,
        ...overrides,
      });
      total += acrossSpread(positions);
    }
    return total / seeds;
  };

  it("throws a loud day wider than a quiet one", () => {
    // The splatter is the record saying how much a day carried. If it does
    // not track intensity it is decoration.
    expect(meanAcross({ intensity: 0.9 })).toBeGreaterThan(meanAcross({ intensity: 0.2 }));
  });

  it("gives clusters genuinely different shapes", () => {
    // The failure this replaces was a band of exactly constant width, which
    // read as an extruded tube however wide it was made.
    const widths = Array.from({ length: 12 }, (_, i) =>
      acrossSpread(generate({ points: straightPath(), particleCount: 900, shapeSeed: i / 12 }).positions)
    );

    expect(Math.max(...widths) / Math.min(...widths)).toBeGreaterThan(1.4);
  });

  it("scatters the first day of the record wider than an ordinary one", () => {
    expect(meanAcross({ splatterScale: 2 })).toBeGreaterThan(meanAcross({ splatterScale: 1 }));
  });

  it("keeps a cluster finite and bounded however much scatter is asked for", () => {
    // splatterScale multiplies several factors that themselves multiply, so
    // an extreme value must clamp rather than collapse the cluster to a
    // needle or invert the band at its pinch.
    for (const splatterScale of [0, 2, 12, 500]) {
      const { positions, opacities } = generate({
        particleCount: 400,
        intensity: 1,
        splatterScale,
      });
      expect(positions.every(Number.isFinite), `scale ${splatterScale}`).toBe(true);
      for (const o of opacities) {
        expect(o, `scale ${splatterScale}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("useGenerateParticles — cross-section of the dust band", () => {
  it("packs a dense spine along the curve and thins toward the edges", () => {
    // A uniform box put as many motes at a cluster's outer edge as along
    // its centre, so every cluster read as a rectangular slab with a hard
    // boundary. With a bell cross-section the thirds are nowhere near
    // equal: a flat distribution would put ~33% in each.
    const { positions } = generate({
      particleCount: 1500,
      points: [new Vector3(0, 0, 0)],
    });

    const count = positions.length / 3;
    const offsets: number[] = [];
    for (let i = 0; i < count; i++) offsets.push(Math.abs(positions[i * 3]));

    const max = Math.max(...offsets);
    const inner = offsets.filter((x) => x < max / 3).length / count;
    const outer = offsets.filter((x) => x > (2 * max) / 3).length / count;

    expect(inner).toBeGreaterThan(0.5);
    expect(outer).toBeLessThan(0.15);
  });

  it("never throws a mote far outside its cluster", () => {
    // The bell is bounded, unlike a true Gaussian — widening the band can
    // thin it, but cannot strand a particle away from the curve.
    const { positions } = generate({
      particleCount: 800,
      points: [new Vector3(0, 0, 0)],
      intensity: 1,
    });

    for (let i = 0; i < positions.length; i++) {
      expect(Math.abs(positions[i])).toBeLessThan(4);
    }
  });
});

describe("useGenerateParticles — dust-like size distribution", () => {
  it("emits one phase per particle, each in the 0-1 range", () => {
    const { phases, sizes } = generate({ particleCount: 300 });
    expect(phases).toHaveLength(sizes.length);
    for (const p of phases) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
      expect(Number.isFinite(p)).toBe(true);
    }
  });

  it("gives particles genuinely different sizes, not a near-uniform batch", () => {
    // The old jitter kept everything within about 10% of one size, which is
    // what made a cluster read as generated rather than observed.
    const { sizes } = generate({ particleCount: 2000 });
    const min = Math.min(...sizes);
    const max = Math.max(...sizes);
    expect(max / min).toBeGreaterThan(3);
  });

  it("skews heavily toward small motes with a long tail of large ones", () => {
    const { sizes } = generate({ particleCount: 3000 });
    const sorted = [...sizes].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const mean = sizes.reduce((t, s) => t + s, 0) / sizes.length;
    // A right-skewed distribution puts the median below the mean.
    expect(median).toBeLessThan(mean);
  });

  it("keeps every size positive and finite however skewed", () => {
    const { sizes } = generate({ particleCount: 1500 });
    for (const s of sizes) {
      expect(Number.isFinite(s)).toBe(true);
      expect(s).toBeGreaterThan(0);
    }
  });

  it("still scales the whole distribution by layer", () => {
    // Background motes should remain larger on average than foreground ones
    // even though each layer now spans a wide range internally.
    const mean = (b: Float32Array) => b.reduce((t, s) => t + s, 0) / b.length;
    const background = generate({ particleCount: 3000, isBackgroundLayer: true });
    const foreground = generate({ particleCount: 3000 });
    expect(mean(background.sizes)).toBeGreaterThan(mean(foreground.sizes));
  });
});
