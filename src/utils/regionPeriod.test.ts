import { describe, it, expect } from "vitest";
import { entriesInPeriod, getRegionPeriod } from "./regionPeriod";
import type { JournalEntry } from "@/types/event";

const entry = (id: string, anchor: string, end?: string): JournalEntry => ({
  id,
  text: id,
  createdAt: new Date(2026, 8, 23).toISOString(),
  anchorDate: new Date(`${anchor}T00:00:00`).toISOString(),
  endDate: end ? new Date(`${end}T00:00:00`).toISOString() : undefined,
  temporalScope: end ? "smear" : "point",
});

describe("getRegionPeriod", () => {
  it("splits a month into the thirds the tooltip names", () => {
    expect(getRegionPeriod(new Date(2026, 8, 1)).key).toBe("2026-09-early");
    expect(getRegionPeriod(new Date(2026, 8, 10, 23, 59)).key).toBe("2026-09-early");
    expect(getRegionPeriod(new Date(2026, 8, 11)).key).toBe("2026-09-mid");
    expect(getRegionPeriod(new Date(2026, 8, 20)).key).toBe("2026-09-mid");
    expect(getRegionPeriod(new Date(2026, 8, 21)).key).toBe("2026-09-late");
    expect(getRegionPeriod(new Date(2026, 8, 30)).key).toBe("2026-09-late");
  });

  it("labels the period the way the tooltip always has", () => {
    expect(getRegionPeriod(new Date(2026, 8, 15)).label).toBe("Around mid Sep 2026");
  });

  it("runs the last third to the end of the month, however long it is", () => {
    const feb = getRegionPeriod(new Date(2026, 1, 25));
    expect(feb.start).toEqual(new Date(2026, 1, 21));
    expect(feb.end).toEqual(new Date(2026, 2, 1));

    const dec = getRegionPeriod(new Date(2026, 11, 31));
    expect(dec.end).toEqual(new Date(2027, 0, 1));
  });

  it("gives every day in a period the same key", () => {
    const keys = new Set([11, 13, 17, 20].map((d) => getRegionPeriod(new Date(2026, 8, d)).key));
    expect(keys.size).toBe(1);
  });
});

describe("entriesInPeriod", () => {
  const midSep = getRegionPeriod(new Date(2026, 8, 15));

  it("takes entries anchored inside the period and leaves the rest", () => {
    const got = entriesInPeriod(
      [entry("in", "2026-09-12"), entry("before", "2026-09-10"), entry("after", "2026-09-21")],
      midSep,
    );
    expect(got.map((e) => e.id)).toEqual(["in"]);
  });

  it("includes a feeling that stretches through the period from before it", () => {
    const got = entriesInPeriod([entry("since-august", "2026-08-30", "2026-09-23")], midSep);
    expect(got).toHaveLength(1);
  });

  it("leaves out a stretch that ends before the period starts", () => {
    const got = entriesInPeriod([entry("over", "2026-08-30", "2026-09-10")], midSep);
    expect(got).toHaveLength(0);
  });
});
