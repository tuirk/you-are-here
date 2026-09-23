import { describe, it, expect } from "vitest";
import { getOriginEntryId } from "./originEntry";
import type { JournalEntry } from "@/types/event";

/**
 * Picks the one day drawn twice as wide as any other. Getting it wrong
 * marks the wrong day as the beginning of the record, which is a quiet
 * enough failure that nothing would catch it but this.
 */

const entry = (id: string, anchor: string, written = anchor): JournalEntry =>
  ({
    id,
    text: "",
    createdAt: new Date(`${written}T00:00:00`).toISOString(),
    anchorDate: new Date(`${anchor}T00:00:00`).toISOString(),
    sentiment: { color: "#ffffff", intensity: 0.5, categories: ["neutral"] },
    temporalScope: "point",
  }) as JournalEntry;

describe("getOriginEntryId", () => {
  it("finds the earliest entry whatever order they arrive in", () => {
    const entries = [
      entry("late", "2026-09-01"),
      entry("first", "2026-01-01"),
      entry("mid", "2026-05-01"),
    ];

    expect(getOriginEntryId(entries)).toBe("first");
  });

  it("goes by the day an entry is about, not the day it was written", () => {
    // A record can open with something written months later about a day
    // long past — and that day is still where the spiral starts.
    const entries = [
      entry("written-first", "2026-06-01", "2026-06-01"),
      entry("about-earlier", "2026-02-01", "2026-08-01"),
    ];

    expect(getOriginEntryId(entries)).toBe("about-earlier");
  });

  it("settles on one entry when two share the first day", () => {
    // Flickering between them on re-render would reshuffle the cluster at
    // the centre of the record every time React rebuilt it.
    const entries = [entry("a", "2026-01-01"), entry("b", "2026-01-01")];

    expect(getOriginEntryId(entries)).toBe("a");
    expect(getOriginEntryId([...entries])).toBe("a");
  });

  it("skips an entry whose date cannot be read", () => {
    const broken = { ...entry("broken", "2026-01-01"), anchorDate: "not a date" };
    const entries = [broken as JournalEntry, entry("real", "2026-03-01")];

    expect(getOriginEntryId(entries)).toBe("real");
  });

  it("has no answer for an empty record", () => {
    expect(getOriginEntryId([])).toBeNull();
  });
});
