import { describe, it, expect } from "vitest";
import {
  getCrowdingRelief,
  getCrowdingByEntry,
  CROWDING_HEADROOM,
  CROWDING_FLOOR,
} from "./crowding";
import type { JournalEntry } from "@/types/event";

/**
 * What stops a busy record from drawing as a white smudge. Additive
 * blending sums everything that lands on a pixel, so without this the
 * picture gets worse the more of it there is — which is exactly backwards
 * for a journal.
 */

const day = (iso: string) => new Date(`${iso}T00:00:00`).toISOString();

const entry = (id: string, anchor: string): JournalEntry =>
  ({
    id,
    text: "",
    createdAt: day(anchor),
    anchorDate: day(anchor),
    sentiment: { color: "#ffffff", intensity: 0.5, categories: ["neutral"] },
    temporalScope: "point",
  }) as JournalEntry;

describe("getCrowdingRelief", () => {
  it("leaves a day with its patch to itself completely alone", () => {
    expect(getCrowdingRelief(1)).toBe(1);
  });

  it("leaves an ordinary well-kept week alone", () => {
    // The relief is for pile-ups, not for writing regularly. If this starts
    // biting at everyday density it will read as the spiral dimming when
    // you use it more, which is the opposite of what it is for.
    expect(getCrowdingRelief(CROWDING_HEADROOM)).toBe(1);
  });

  it("holds a crowded patch back", () => {
    expect(getCrowdingRelief(CROWDING_HEADROOM * 4)).toBeLessThan(1);
  });

  it("still lets a busy stretch outshine a quiet one", () => {
    // Dividing by the count outright would flatten every patch to the same
    // brightness and throw the signal away. Under a square root the total
    // keeps rising with the count — just slowly enough to stay legible.
    const quiet = CROWDING_HEADROOM;
    const busy = CROWDING_HEADROOM * 4;

    expect(busy * getCrowdingRelief(busy)).toBeGreaterThan(quiet * getCrowdingRelief(quiet));
  });

  it("never dims an entry out of existence", () => {
    expect(getCrowdingRelief(10_000)).toBe(CROWDING_FLOOR);
  });

  it("treats a nonsense count as uncrowded rather than producing NaN", () => {
    // A NaN here reaches Math.floor in the callers and sizes a buffer with
    // it, which makes the cluster vanish silently.
    for (const bad of [NaN, Infinity, -1, 0]) {
      expect(Number.isFinite(getCrowdingRelief(bad))).toBe(true);
    }
  });
});

describe("getCrowdingByEntry", () => {
  it("gives a lone entry full strength", () => {
    const relief = getCrowdingByEntry([entry("a", "2026-06-01")]);

    expect(relief.get("a")).toBe(1);
  });

  it("holds back every entry in a pile-up, not just the later ones", () => {
    // They all land on the same pixels, so they all have to give way —
    // dimming only the newcomers would make the order entries were written
    // in visible on the spiral.
    const stacked = Array.from({ length: CROWDING_HEADROOM * 3 }, (_, i) =>
      entry(`e${i}`, "2026-06-10")
    );
    const relief = getCrowdingByEntry(stacked);

    const values = [...relief.values()];
    expect(values.every((v) => v < 1)).toBe(true);
    expect(new Set(values).size).toBe(1);
  });

  it("counts the days either side, not just the same day", () => {
    const near = [
      entry("a", "2026-06-10"),
      ...Array.from({ length: CROWDING_HEADROOM * 2 }, (_, i) => entry(`n${i}`, "2026-06-11")),
    ];

    expect(getCrowdingByEntry(near).get("a")).toBeLessThan(1);
  });

  it("leaves an entry alone when the crowd is a fortnight away", () => {
    const far = [
      entry("a", "2026-06-10"),
      ...Array.from({ length: CROWDING_HEADROOM * 3 }, (_, i) => entry(`f${i}`, "2026-06-24")),
    ];

    expect(getCrowdingByEntry(far).get("a")).toBe(1);
  });

  it("gives an answer for every entry it was handed", () => {
    const entries = [entry("a", "2026-06-01"), entry("b", "2026-07-01")];
    const relief = getCrowdingByEntry(entries);

    for (const e of entries) {
      expect(relief.get(e.id)).toBeGreaterThan(0);
      expect(Number.isFinite(relief.get(e.id))).toBe(true);
    }
  });

  it("survives an unparseable date rather than poisoning the buffers", () => {
    const broken = { ...entry("bad", "2026-06-01"), anchorDate: "not a date" };
    const relief = getCrowdingByEntry([broken as JournalEntry]);

    expect(relief.get("bad")).toBe(1);
  });

  it("handles an empty record", () => {
    expect(getCrowdingByEntry([]).size).toBe(0);
  });
});
