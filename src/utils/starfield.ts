/**
 * A starfield built from the real stellar population rather than a uniform
 * scatter of white dots.
 *
 * The previous backdrop drew every star the same colour and near enough the
 * same size, which is the clearest tell that a sky was generated rather than
 * photographed: a real one is overwhelmingly dim and red, with a handful of
 * bright blue-white exceptions, and it is not evenly spread — the galactic
 * plane crowds a band across it and a dust lane cuts that band in half.
 *
 * Three things here do the work:
 *   - spectral classes sampled at their true frequencies, converted to
 *     colour through blackbody radiation rather than picked by eye;
 *   - a magnitude distribution skewed hard toward faint, so brightness is
 *     earned by a few stars instead of shared evenly;
 *   - a Milky Way band with a dust lane, so the sky has structure to orbit
 *     past instead of looking identical from every angle.
 */

const TAU = Math.PI * 2;

export interface SpectralClass {
  letter: string;
  /** Share of the population, as a fraction of 1. */
  weight: number;
  tempMin: number;
  tempMax: number;
}

/**
 * Main-sequence frequencies. M dwarfs dominate the galaxy by a wide margin;
 * the blue-white classes everyone pictures when they think "star" are rare
 * enough that a field full of them looks wrong even to someone who has
 * never looked up the numbers.
 */
export const SPECTRAL_CLASSES: SpectralClass[] = [
  { letter: "M", weight: 0.7645, tempMin: 2400, tempMax: 3700 },
  { letter: "K", weight: 0.121, tempMin: 3700, tempMax: 5200 },
  { letter: "G", weight: 0.076, tempMin: 5200, tempMax: 6000 },
  { letter: "F", weight: 0.03, tempMin: 6000, tempMax: 7500 },
  { letter: "A", weight: 0.006, tempMin: 7500, tempMax: 10000 },
  { letter: "B", weight: 0.0025, tempMin: 10000, tempMax: 28000 },
];

/** Picks a class for a uniform sample in [0, 1). */
export const pickSpectralClass = (u: number): SpectralClass => {
  let cumulative = 0;
  for (const spectral of SPECTRAL_CLASSES) {
    cumulative += spectral.weight;
    if (u < cumulative) return spectral;
  }
  return SPECTRAL_CLASSES[SPECTRAL_CLASSES.length - 1];
};

/**
 * Blackbody colour for a temperature in Kelvin, as RGB in 0..1.
 *
 * Standard piecewise approximation of the Planckian locus. Accurate enough
 * between roughly 1000K and 40000K, which covers every class above, and far
 * cheaper than carrying a spectrum table for something the eye reads as
 * "slightly warm" or "slightly cold".
 */
export const blackbodyToRgb = (kelvin: number): [number, number, number] => {
  const t = Math.min(Math.max(kelvin, 1000), 40000) / 100;

  let r: number;
  let g: number;
  let b: number;

  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  }

  if (t >= 66) {
    b = 255;
  } else if (t <= 19) {
    b = 0;
  } else {
    b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  }

  const clamp = (v: number) => Math.min(Math.max(v, 0), 255) / 255;
  return [clamp(r), clamp(g), clamp(b)];
};

export interface StarfieldOptions {
  count?: number;
  /** Stars sit on a shell between these radii, so they parallax slightly. */
  radiusMin?: number;
  radiusMax?: number;
  /** Share of stars pulled into the galactic band. */
  bandFraction?: number;
  /** Angular thickness of that band, in radians. */
  bandSpread?: number;
  /** Half-width of the dark lane cutting through the band, in radians. */
  dustLaneWidth?: number;
  /** Tilt of the band, so it crosses the view rather than sitting level. */
  bandTilt?: number;
  random?: () => number;
}

export interface StarfieldData {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  phases: Float32Array;
  /** Per-star twinkle rate, so the field never pulses in unison. */
  rates: Float32Array;
}

/** How hard brightness is skewed toward faint. Higher means dimmer overall. */
const MAGNITUDE_SKEW = 3.2;
const SIZE_MIN = 0.32;
const SIZE_MAX = 2.4;

/** Box-Muller, used to cluster band stars around the galactic plane. */
const gaussian = (random: () => number): number => {
  const u = Math.max(random(), 1e-9);
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
};

export const generateStarfield = ({
  count = 9000,
  radiusMin = 70,
  radiusMax = 140,
  bandFraction = 0.42,
  bandSpread = 0.17,
  dustLaneWidth = 0.035,
  bandTilt = 0.48,
  random = Math.random,
}: StarfieldOptions = {}): StarfieldData => {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const rates = new Float32Array(count);

  const tiltSin = Math.sin(bandTilt);
  const tiltCos = Math.cos(bandTilt);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const inBand = random() < bandFraction;

    // Uniform-on-sphere for the field at large; a tight gaussian around the
    // equator for band stars. Using acos of a uniform keeps the scattered
    // stars from bunching at the poles, which a naive latitude would do.
    const azimuth = random() * TAU;
    const latitude = inBand
      ? gaussian(random) * bandSpread
      : Math.asin(2 * random() - 1);

    const radius = radiusMin + random() * (radiusMax - radiusMin);
    const cosLat = Math.cos(latitude);

    const x = radius * cosLat * Math.cos(azimuth);
    const yFlat = radius * Math.sin(latitude);
    const z = radius * cosLat * Math.sin(azimuth);

    // Rotate about Z so the band runs diagonally across the sky.
    positions[i3] = x * tiltCos - yFlat * tiltSin;
    positions[i3 + 1] = x * tiltSin + yFlat * tiltCos;
    positions[i3 + 2] = z;

    const spectral = pickSpectralClass(random());
    const temperature = spectral.tempMin + random() * (spectral.tempMax - spectral.tempMin);
    const [r, g, b] = blackbodyToRgb(temperature);

    // Most stars are near the detection limit and only a few are bright.
    // Raising a uniform to a power reproduces that without needing a real
    // magnitude scale.
    let brightness = Math.pow(random(), MAGNITUDE_SKEW);

    // Band stars stand in for the unresolved disc: individually fainter,
    // collectively a glow. Without this the band reads as a stripe of
    // foreground stars rather than as depth.
    if (inBand) {
      brightness *= 0.62;

      // The dust lane. Dark nebulae along the plane block the light behind
      // them, so the densest part of the band is also its darkest line.
      const laneProximity = 1 - Math.min(Math.abs(latitude) / dustLaneWidth, 1);
      brightness *= 1 - 0.8 * laneProximity;
    }

    const intensity = 0.25 + brightness * 0.75;
    colors[i3] = r * intensity;
    colors[i3 + 1] = g * intensity;
    colors[i3 + 2] = b * intensity;

    sizes[i] = SIZE_MIN + brightness * (SIZE_MAX - SIZE_MIN);
    phases[i] = random();
    rates[i] = 0.3 + random() * 1.3;
  }

  return { positions, colors, sizes, phases, rates };
};
