/**
 * Maps sentiment categories to colors per the PRD:
 *   joy/contentment → warm yellows, oranges
 *   sadness/grief → deep blues
 *   anger/frustration → reds
 *   anxiety/fear → cool cyans, teals
 *   love/connection → warm pinks, magentas
 *   hope/anticipation → greens
 *   mixed/ambivalent → blended purples
 *   neutral/calm → soft whites, grays
 */

export const CATEGORY_COLORS: Record<string, string> = {
  joy: "#F5A623",      // warm orange-yellow
  sadness: "#2E5BBA",  // deep blue
  anger: "#D94040",    // red
  anxiety: "#3ABFBF",  // teal-cyan
  love: "#E05AA0",     // warm pink-magenta
  hope: "#4CAF50",     // green
  mixed: "#9B6BB0",    // bruised purple
  neutral: "#B0B0B0",  // soft gray
};

/**
 * Public legend — the human-readable label for each category color,
 * in the order we want to show them in the UI.
 */
export const SENTIMENT_LEGEND: { key: string; label: string; color: string }[] = [
  { key: "joy", label: "joy · contentment", color: CATEGORY_COLORS.joy },
  { key: "love", label: "love · connection", color: CATEGORY_COLORS.love },
  { key: "hope", label: "hope · anticipation", color: CATEGORY_COLORS.hope },
  { key: "sadness", label: "sadness · grief", color: CATEGORY_COLORS.sadness },
  { key: "anxiety", label: "anxiety · fear", color: CATEGORY_COLORS.anxiety },
  { key: "anger", label: "anger · frustration", color: CATEGORY_COLORS.anger },
  { key: "mixed", label: "mixed · ambivalent", color: CATEGORY_COLORS.mixed },
  { key: "neutral", label: "neutral · calm", color: CATEGORY_COLORS.neutral },
];

/**
 * Given an array of sentiment categories and an intensity,
 * blend their colors into a single hex color.
 */
export const mapSentimentToColor = (
  categories: string[],
  intensity: number
): string => {
  if (categories.length === 0) return CATEGORY_COLORS.neutral;

  // Average the RGB values of all categories
  let r = 0, g = 0, b = 0;
  let count = 0;

  for (const cat of categories) {
    const hex = CATEGORY_COLORS[cat] || CATEGORY_COLORS.neutral;
    const parsed = hexToRgb(hex);
    if (parsed) {
      r += parsed.r;
      g += parsed.g;
      b += parsed.b;
      count++;
    }
  }

  if (count === 0) return CATEGORY_COLORS.neutral;

  r = Math.round(r / count);
  g = Math.round(g / count);
  b = Math.round(b / count);

  // Apply intensity: lerp toward white for low intensity, saturate for high
  // At intensity 0.5 = base color, <0.5 = desaturated, >0.5 = more vivid
  if (intensity < 0.5) {
    const t = intensity / 0.5; // 0→1
    r = Math.round(r * t + 180 * (1 - t));
    g = Math.round(g * t + 180 * (1 - t));
    b = Math.round(b * t + 180 * (1 - t));
  } else {
    const t = (intensity - 0.5) / 0.5; // 0→1
    // Push toward more saturated version
    const max = Math.max(r, g, b);
    r = Math.round(r + (r === max ? 1 : -1) * t * 20);
    g = Math.round(g + (g === max ? 1 : -1) * t * 20);
    b = Math.round(b + (b === max ? 1 : -1) * t * 20);
  }

  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));

  return rgbToHex(r, g, b);
};

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

const rgbToHex = (r: number, g: number, b: number): string => {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
};
