/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { JournalEntry } from "@/types/event";

vi.mock("./gemini", () => ({
  SUMMARY_PROMPT_FINGERPRINT: "prompt-v1",
  generateRegionSummary: vi.fn(),
}));

import { generateRegionSummary } from "./gemini";
import {
  fetchRegionSummary,
  getStoredSummary,
  MAX_STORED_SUMMARIES,
  SUMMARY_STORAGE_KEY,
  summaryKey,
} from "./summaryCache";

const generate = vi.mocked(generateRegionSummary);

const entry = (id: string, text = `entry ${id}`): JournalEntry => ({
  id,
  text,
  createdAt: "2026-09-23T00:00:00.000Z",
  anchorDate: "2026-09-12T00:00:00.000Z",
  temporalScope: "point",
});

beforeEach(() => {
  localStorage.clear();
  generate.mockReset();
});

describe("summaryKey", () => {
  it("does not depend on the order the entries arrive in", () => {
    expect(summaryKey("2026-09-mid", [entry("a"), entry("b")])).toBe(
      summaryKey("2026-09-mid", [entry("b"), entry("a")]),
    );
  });

  it("changes when an entry's text, the set of entries, or the period changes", () => {
    const base = summaryKey("2026-09-mid", [entry("a"), entry("b")]);
    expect(summaryKey("2026-09-mid", [entry("a", "rewritten"), entry("b")])).not.toBe(base);
    expect(summaryKey("2026-09-mid", [entry("a")])).not.toBe(base);
    expect(summaryKey("2026-09-late", [entry("a"), entry("b")])).not.toBe(base);
  });
});

describe("fetchRegionSummary", () => {
  it("asks Gemini once, then answers from storage — across reloads too", async () => {
    generate.mockResolvedValue("A quiet week.");
    const entries = [entry("a")];
    const key = summaryKey("2026-09-mid", entries);

    expect(await fetchRegionSummary(key, entries, "k")).toBe("A quiet week.");
    expect(await fetchRegionSummary(key, entries, "k")).toBe("A quiet week.");
    expect(generate).toHaveBeenCalledTimes(1);

    // What a reload sees: only localStorage survives.
    expect(JSON.parse(localStorage.getItem(SUMMARY_STORAGE_KEY)!)[key].text).toBe("A quiet week.");
    expect(getStoredSummary(key)).toBe("A quiet week.");
  });

  it("shares one request between hovers that arrive while it is running", async () => {
    let resolve!: (v: string) => void;
    generate.mockReturnValue(new Promise((r) => (resolve = r)));
    const entries = [entry("a")];
    const key = summaryKey("2026-09-mid", entries);

    const first = fetchRegionSummary(key, entries, "k");
    const second = fetchRegionSummary(key, entries, "k");
    resolve("Shared.");

    expect(await first).toBe("Shared.");
    expect(await second).toBe("Shared.");
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("keeps nothing when Gemini fails, so the next hover tries again", async () => {
    generate.mockResolvedValueOnce(null).mockResolvedValueOnce("Second time lucky.");
    const entries = [entry("a")];
    const key = summaryKey("2026-09-mid", entries);

    expect(await fetchRegionSummary(key, entries, "k")).toBeNull();
    expect(getStoredSummary(key)).toBeNull();
    expect(await fetchRegionSummary(key, entries, "k")).toBe("Second time lucky.");
  });

  it("drops the least recently used summaries past the cap", async () => {
    const now = vi.spyOn(Date, "now");
    const store: Record<string, { text: string; usedAt: number }> = {};
    for (let i = 0; i < MAX_STORED_SUMMARIES; i++) store[`old-${i}`] = { text: `t${i}`, usedAt: i };
    localStorage.setItem(SUMMARY_STORAGE_KEY, JSON.stringify(store));

    // Touch old-0 so it is no longer the stalest.
    now.mockReturnValue(10_000);
    expect(getStoredSummary("old-0")).toBe("t0");

    now.mockReturnValue(20_000);
    generate.mockResolvedValue("Newest.");
    await fetchRegionSummary("new", [entry("a")], "k");

    const kept = JSON.parse(localStorage.getItem(SUMMARY_STORAGE_KEY)!);
    expect(Object.keys(kept)).toHaveLength(MAX_STORED_SUMMARIES);
    expect(kept["new"]).toBeDefined();
    expect(kept["old-0"]).toBeDefined();
    expect(kept["old-1"]).toBeUndefined();
    now.mockRestore();
  });

  it("treats corrupt storage as empty instead of failing the tooltip", async () => {
    localStorage.setItem(SUMMARY_STORAGE_KEY, "not json");
    generate.mockResolvedValue("Recovered.");
    const entries = [entry("a")];
    const key = summaryKey("2026-09-mid", entries);

    expect(getStoredSummary(key)).toBeNull();
    expect(await fetchRegionSummary(key, entries, "k")).toBe("Recovered.");
  });
});
