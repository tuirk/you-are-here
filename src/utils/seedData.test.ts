import { describe, it, expect, vi } from "vitest";
import { generateSeedData } from "./seedData";
import { CATEGORY_COLORS } from "./colorMapping";

/**
 * The seed files are the demo record everyone sees on their first visit, and
 * they are prose — which means a stray pipe or a mistyped feeling can slip in
 * with an ordinary edit. parseSeedMarkdown is built to survive that quietly,
 * so nothing would fail; the day would just go missing from the spiral.
 *
 * This suite is what notices. It reads the real files.
 */

const entries = generateSeedData();

describe("the seed record", () => {
  it("parses every line of every month file", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    generateSeedData();

    expect(warn).not.toHaveBeenCalled();
  });

  it("fills the spiral rather than dotting it", () => {
    // The dust of an entry reaches about two days either side of its day.
    // Below roughly one entry every three days the curve reads as beads on
    // a wire, which is the state this record was written to fix.
    const days = new Set(entries.map((e) => e.anchorDate.slice(0, 10)));
    const first = new Date(entries[0].anchorDate);
    const last = new Date(entries[entries.length - 1].anchorDate);
    const span = (last.getTime() - first.getTime()) / 86_400_000;

    expect(entries.length).toBeGreaterThan(100);
    expect(days.size / span).toBeGreaterThan(0.33);
  });

  it("is in order, oldest first", () => {
    const dates = entries.map((e) => e.anchorDate);

    expect([...dates].sort()).toEqual(dates);
  });

  it("gives every entry something to draw", () => {
    for (const entry of entries) {
      expect(entry.id, entry.text.slice(0, 40)).toBeTruthy();
      expect(entry.text.length).toBeGreaterThan(0);
      expect(entry.sentiment?.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(entry.sentiment?.intensity).toBeGreaterThan(0);
      expect(entry.sentiment?.categories.length).toBeGreaterThan(0);
    }
  });

  it("only uses feelings the legend can explain", () => {
    const known = new Set(Object.keys(CATEGORY_COLORS));
    const used = new Set(entries.flatMap((e) => e.sentiment?.categories ?? []));

    expect([...used].filter((c) => !known.has(c))).toEqual([]);
  });

  it("never ends a span before it starts", () => {
    for (const entry of entries.filter((e) => e.endDate)) {
      expect(new Date(entry.endDate!).getTime()).toBeGreaterThan(
        new Date(entry.anchorDate).getTime()
      );
    }
  });

  it("never writes an entry before the day it is about", () => {
    for (const entry of entries) {
      expect(new Date(entry.createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(entry.anchorDate).getTime()
      );
    }
  });

  it("carries both spans and single days", () => {
    const spans = entries.filter((e) => e.endDate);

    expect(spans.length).toBeGreaterThan(10);
    expect(entries.length - spans.length).toBeGreaterThan(50);
  });
});
