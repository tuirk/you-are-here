import { JournalEntry } from "@/types/event";

const DAY_MS = 1000 * 60 * 60 * 24;

/** Warm neutral used when nothing is near enough to colour the present. */
export const DEFAULT_AURA = "#FFC97A";

/** Cool near-black used for the origin before anything has been written. */

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
};

const rgbToHex = (r: number, g: number, b: number): string =>
  "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, "0")).join("");

type Hsl = { h: number; s: number; l: number };

const rgbToHsl = (r: number, g: number, b: number): Hsl => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;

  return { h: h / 6, s, l };
};

const hslToRgb = ({ h, s, l }: Hsl) => {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }

  const hue = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: Math.round(hue(h + 1 / 3) * 255),
    g: Math.round(hue(h) * 255),
    b: Math.round(hue(h - 1 / 3) * 255),
  };
};

const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * How many days separate an entry from today. A smear that spans today
 * counts as zero — you are standing inside that feeling, not near it.
 */
const distanceInDays = (entry: JournalEntry, today: Date): number => {
  const anchor = startOfDay(new Date(entry.anchorDate)).getTime();
  const end = entry.endDate ? startOfDay(new Date(entry.endDate)).getTime() : anchor;
  const now = today.getTime();

  const from = Math.min(anchor, end);
  const to = Math.max(anchor, end);

  if (now >= from && now <= to) return 0;
  return (now < from ? from - now : now - to) / DAY_MS;
};

/**
 * Blends the sentiment colours of the entries surrounding today into a
 * single colour for the present-moment marker.
 *
 * The figure used to glow a fixed amber regardless of what the spiral was
 * saying, which read as decoration bolted onto the scene. Taking its light
 * from the nearby clusters instead makes the marker part of the picture:
 * it carries the mood of where you actually are.
 *
 * Nearer and more intense entries pull harder, with a linear falloff to
 * nothing at `radiusDays`, so the colour shifts gradually as time passes
 * rather than snapping when a single entry drops out of range.
 */
export const getAuraColor = (
  entries: JournalEntry[],
  today: Date,
  radiusDays = 3
): string => {
  const reference = startOfDay(today);

  let r = 0;
  let g = 0;
  let b = 0;
  let saturation = 0;
  let lightness = 0;
  let totalWeight = 0;

  for (const entry of entries) {
    const color = entry.sentiment?.color;
    if (!color) continue;

    const rgb = hexToRgb(color);
    if (!rgb) continue;

    const distance = distanceInDays(entry, reference);
    if (distance > radiusDays) continue;

    const proximity = 1 - distance / radiusDays;
    const intensity = entry.sentiment?.intensity ?? 0.5;
    // Keep a floor under intensity so a calm entry still tints the marker
    // rather than being rounded away entirely. Squaring proximity sharpens
    // the falloff so the nearest feeling leads instead of every entry in
    // range contributing near-equally.
    const weight = proximity * proximity * (0.35 + 0.65 * intensity);
    if (weight <= 0) continue;

    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

    r += rgb.r * weight;
    g += rgb.g * weight;
    b += rgb.b * weight;
    saturation += hsl.s * weight;
    lightness += hsl.l * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return DEFAULT_AURA;

  // Averaging RGB finds the right hue but drains the colour: mixing two
  // opposing hues lands on grey, which is exactly the washed-out look the
  // fixed amber was replaced to avoid. So take the hue from the blend, then
  // restore saturation and lightness to the weighted average of the sources
  // — the marker ends up vivid in the direction the nearby entries point.
  const blended = rgbToHsl(r / totalWeight, g / totalWeight, b / totalWeight);
  const restored = hslToRgb({
    h: blended.h,
    s: saturation / totalWeight,
    l: lightness / totalWeight,
  });

  return rgbToHex(restored.r, restored.g, restored.b);
};
