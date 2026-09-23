import { describe, it, expect } from "vitest";
import { CATEGORY_COLORS, SENTIMENT_LEGEND, mapSentimentToColor } from "./colorMapping";

/**
 * Sentiment colour is the emotional meaning of the visualization — a
 * particle cluster's colour is the only thing telling the reader whether a
 * period was joyful or bleak. These tests pin the palette and the blending
 * rules so a refactor cannot quietly recolour someone's history.
 */

describe("CATEGORY_COLORS", () => {
  it("defines every category the Gemini prompt is allowed to return", () => {
    // These eight are hard-coded in the prompt in services/gemini.ts.
    expect(Object.keys(CATEGORY_COLORS).sort()).toEqual(
      ["anger", "anxiety", "hope", "joy", "love", "mixed", "neutral", "sadness"].sort()
    );
  });

  it("holds the documented palette", () => {
    expect(CATEGORY_COLORS.joy).toBe("#F5A623");
    expect(CATEGORY_COLORS.sadness).toBe("#2E5BBA");
    expect(CATEGORY_COLORS.anger).toBe("#D94040");
    expect(CATEGORY_COLORS.anxiety).toBe("#3ABFBF");
    expect(CATEGORY_COLORS.love).toBe("#E05AA0");
    expect(CATEGORY_COLORS.hope).toBe("#4CAF50");
    expect(CATEGORY_COLORS.mixed).toBe("#9B6BB0");
    expect(CATEGORY_COLORS.neutral).toBe("#B0B0B0");
  });

  it("uses valid 6-digit hex throughout", () => {
    for (const hex of Object.values(CATEGORY_COLORS)) {
      expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe("SENTIMENT_LEGEND", () => {
  it("shows every category exactly once", () => {
    const keys = SENTIMENT_LEGEND.map((l) => l.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.sort()).toEqual(Object.keys(CATEGORY_COLORS).sort());
  });

  it("never drifts from the palette it documents", () => {
    for (const { key, color } of SENTIMENT_LEGEND) {
      expect(color).toBe(CATEGORY_COLORS[key]);
    }
  });
});

describe("mapSentimentToColor", () => {
  it("falls back to neutral when no category is given", () => {
    expect(mapSentimentToColor([], 0.5)).toBe(CATEGORY_COLORS.neutral);
  });

  it("returns a category's own colour at mid intensity", () => {
    // intensity 0.5 is the neutral point: no desaturation, no boost
    expect(mapSentimentToColor(["joy"], 0.5)).toBe("#f5a623");
    expect(mapSentimentToColor(["sadness"], 0.5)).toBe("#2e5bba");
  });

  it("treats an unrecognised category as neutral rather than crashing", () => {
    expect(mapSentimentToColor(["ecstatic"], 0.5)).toBe("#b0b0b0");
  });

  it("washes fully toward grey at zero intensity", () => {
    // every channel lerps to 180 (#b4)
    expect(mapSentimentToColor(["joy"], 0)).toBe("#b4b4b4");
    expect(mapSentimentToColor(["anger"], 0)).toBe("#b4b4b4");
  });

  it("blends multiple categories into something between them", () => {
    const blend = mapSentimentToColor(["joy", "sadness"], 0.5);
    expect(blend).not.toBe(mapSentimentToColor(["joy"], 0.5));
    expect(blend).not.toBe(mapSentimentToColor(["sadness"], 0.5));

    const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
    for (let i = 0; i < 3; i++) {
      const low = Math.min(channel("#F5A623", i), channel("#2E5BBA", i));
      const high = Math.max(channel("#F5A623", i), channel("#2E5BBA", i));
      expect(channel(blend, i)).toBeGreaterThanOrEqual(low);
      expect(channel(blend, i)).toBeLessThanOrEqual(high);
    }
  });

  it("is order-independent when blending", () => {
    expect(mapSentimentToColor(["joy", "sadness"], 0.7)).toBe(
      mapSentimentToColor(["sadness", "joy"], 0.7)
    );
  });

  it("always returns valid hex across the whole intensity range", () => {
    for (const category of Object.keys(CATEGORY_COLORS)) {
      for (let intensity = 0; intensity <= 1.0001; intensity += 0.1) {
        expect(mapSentimentToColor([category], intensity)).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it("keeps channels in range even at maximum intensity", () => {
    for (const category of Object.keys(CATEGORY_COLORS)) {
      const hex = mapSentimentToColor([category], 1);
      for (let i = 0; i < 3; i++) {
        const value = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(255);
      }
    }
  });
});
