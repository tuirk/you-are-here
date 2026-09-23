import { describe, it, expect } from "vitest";
import { getAuraColor, DEFAULT_AURA } from "./auraColor";
import type { JournalEntry } from "@/types/event";

/**
 * The present-moment figure takes its glow from this. If the blend breaks it
 * does not crash — the marker just quietly goes back to looking like a fixed
 * amber decoration, disconnected from what the spiral is actually saying.
 */

const TODAY = new Date("2026-06-15T00:00:00");

const at = (offsetDays: number) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
};

const entry = (overrides: Partial<JournalEntry> = {}): JournalEntry =>
  ({
    id: "e",
    text: "",
    createdAt: at(0),
    anchorDate: at(0),
    sentiment: { color: "#FF0000", intensity: 0.8, categories: ["anger"] },
    temporalScope: "point",
    ...overrides,
  }) as JournalEntry;

describe("getAuraColor — falling back", () => {
  it("returns the default when there are no entries at all", () => {
    expect(getAuraColor([], TODAY)).toBe(DEFAULT_AURA);
  });

  it("returns the default when nothing has been analysed yet", () => {
    expect(getAuraColor([entry({ sentiment: undefined })], TODAY)).toBe(DEFAULT_AURA);
  });

  it("returns the default when every entry is outside the radius", () => {
    // The window is deliberately tight — the marker shows the mood of the
    // last couple of days, not of the last few weeks.
    const far = [entry({ anchorDate: at(-8) }), entry({ anchorDate: at(20) })];
    expect(getAuraColor(far, TODAY)).toBe(DEFAULT_AURA);
  });

  it("ignores an entry whose colour is malformed", () => {
    expect(getAuraColor([entry({ sentiment: { color: "nonsense", intensity: 1, categories: [] } })], TODAY)).toBe(
      DEFAULT_AURA
    );
  });
});

describe("getAuraColor — blending", () => {
  it("takes a single nearby entry's colour directly", () => {
    expect(getAuraColor([entry({ anchorDate: at(0) })], TODAY)).toBe("#ff0000");
  });

  it("lands between two equidistant colours", () => {
    const blend = getAuraColor(
      [
        entry({ id: "a", anchorDate: at(-1), sentiment: { color: "#FF0000", intensity: 0.5, categories: [] } }),
        entry({ id: "b", anchorDate: at(1), sentiment: { color: "#0000FF", intensity: 0.5, categories: [] } }),
      ],
      TODAY
    );

    const r = parseInt(blend.slice(1, 3), 16);
    const b = parseInt(blend.slice(5, 7), 16);
    expect(r).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(0);
    expect(Math.abs(r - b)).toBeLessThan(10);
  });

  it("lets the nearer entry dominate", () => {
    const blend = getAuraColor(
      [
        entry({ id: "near", anchorDate: at(0), sentiment: { color: "#FF0000", intensity: 0.5, categories: [] } }),
        entry({ id: "far", anchorDate: at(2), sentiment: { color: "#0000FF", intensity: 0.5, categories: [] } }),
      ],
      TODAY
    );

    const r = parseInt(blend.slice(1, 3), 16);
    const b = parseInt(blend.slice(5, 7), 16);
    expect(r).toBeGreaterThan(b);
  });

  it("lets the more intense entry pull harder at equal distance", () => {
    const blend = getAuraColor(
      [
        entry({ id: "loud", anchorDate: at(-1), sentiment: { color: "#FF0000", intensity: 1, categories: [] } }),
        entry({ id: "quiet", anchorDate: at(1), sentiment: { color: "#0000FF", intensity: 0.05, categories: [] } }),
      ],
      TODAY
    );

    expect(parseInt(blend.slice(1, 3), 16)).toBeGreaterThan(parseInt(blend.slice(5, 7), 16));
  });

  it("treats a smear spanning today as being at zero distance", () => {
    // Standing inside a feeling should colour the present as strongly as an
    // entry written today, even though its anchor is weeks back.
    const spanning = entry({
      anchorDate: at(-40),
      endDate: at(40),
      temporalScope: "smear",
      sentiment: { color: "#00FF00", intensity: 1, categories: [] },
    });
    expect(getAuraColor([spanning], TODAY)).toBe("#00ff00");
  });

  it("still ignores a smear that ended well before the radius", () => {
    const old = entry({
      anchorDate: at(-120),
      endDate: at(-60),
      temporalScope: "smear",
    });
    expect(getAuraColor([old], TODAY)).toBe(DEFAULT_AURA);
  });

  it("is order-independent", () => {
    const a = entry({ id: "a", anchorDate: at(-1), sentiment: { color: "#FF0000", intensity: 0.7, categories: [] } });
    const b = entry({ id: "b", anchorDate: at(2), sentiment: { color: "#00FF00", intensity: 0.4, categories: [] } });
    expect(getAuraColor([a, b], TODAY)).toBe(getAuraColor([b, a], TODAY));
  });

  it("always returns a valid hex colour, in range and out", () => {
    // Case-insensitive on purpose: a blended result is generated lowercase,
    // while out-of-range falls back to the DEFAULT_AURA constant as written.
    for (let offset = -30; offset <= 30; offset += 3) {
      const result = getAuraColor([entry({ anchorDate: at(offset) })], TODAY);
      expect(result).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("ignores the time of day when measuring distance", () => {
    const morning = getAuraColor([entry({ anchorDate: "2026-06-15T09:30:00" })], TODAY);
    const midnight = getAuraColor([entry({ anchorDate: "2026-06-15T00:00:00" })], TODAY);
    expect(morning).toBe(midnight);
  });
});
