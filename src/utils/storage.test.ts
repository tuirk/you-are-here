/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  getFirstUseDate,
  setFirstUseDate,
  saveEntries,
  getEntries,
  saveEntry,
  updateEntry,
  deleteEntry,
  saveConfig,
  getConfig,
  hasSeededDemo,
  markDemoSeeded,
} from "./storage";
import type { JournalEntry } from "@/types/event";

/**
 * localStorage is the only place a journal exists — there is no server.
 * A parsing bug here does not throw, it just returns fewer entries, and the
 * user silently loses part of their history off the spiral.
 */

const entry = (overrides: Partial<JournalEntry> = {}): JournalEntry =>
  ({
    id: "e1",
    text: "a quiet day",
    createdAt: "2026-06-01T00:00:00.000Z",
    anchorDate: "2026-06-01T00:00:00.000Z",
    sentiment: { color: "#F5A623", intensity: 0.6, categories: ["joy"] },
    temporalScope: "point",
    ...overrides,
  }) as JournalEntry;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("first use date", () => {
  it("creates and persists a midnight-normalised date on first read", () => {
    const first = getFirstUseDate();
    expect(first.getHours()).toBe(0);
    expect(first.getMinutes()).toBe(0);
    expect(first.getSeconds()).toBe(0);
    expect(first.getMilliseconds()).toBe(0);
  });

  it("returns the same date on subsequent reads", () => {
    const first = getFirstUseDate();
    expect(getFirstUseDate().toISOString()).toBe(first.toISOString());
  });

  it("normalises an explicitly set date to midnight", () => {
    setFirstUseDate(new Date("2026-03-14T17:42:09.500"));
    const stored = getFirstUseDate();
    expect(stored.getFullYear()).toBe(2026);
    expect(stored.getMonth()).toBe(2);
    expect(stored.getDate()).toBe(14);
    expect(stored.getHours()).toBe(0);
    expect(stored.getMilliseconds()).toBe(0);
  });
});

describe("entries round-trip", () => {
  it("returns an empty list when nothing was ever saved", () => {
    expect(getEntries()).toEqual([]);
  });

  it("preserves an entry exactly through save and load", () => {
    const e = entry();
    saveEntries([e]);
    expect(getEntries()).toEqual([e]);
  });

  it("appends with saveEntry without dropping what is already there", () => {
    saveEntry(entry({ id: "a" }));
    saveEntry(entry({ id: "b" }));
    expect(getEntries().map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("replaces only the matching entry on update", () => {
    saveEntries([entry({ id: "a", text: "before" }), entry({ id: "b", text: "keep" })]);
    updateEntry(entry({ id: "a", text: "after" }));

    const entries = getEntries();
    expect(entries.find((e) => e.id === "a")?.text).toBe("after");
    expect(entries.find((e) => e.id === "b")?.text).toBe("keep");
  });

  it("leaves everything alone when updating an id that is not there", () => {
    saveEntries([entry({ id: "a" })]);
    updateEntry(entry({ id: "ghost", text: "nope" }));
    expect(getEntries()).toHaveLength(1);
    expect(getEntries()[0].id).toBe("a");
  });

  it("removes only the requested entry on delete", () => {
    saveEntries([entry({ id: "a" }), entry({ id: "b" }), entry({ id: "c" })]);
    deleteEntry("b");
    expect(getEntries().map((e) => e.id)).toEqual(["a", "c"]);
  });

  it("keeps an entry whose sentiment has not been analysed yet", () => {
    // Entries are written before Gemini responds, so an un-analysed entry
    // must survive the round-trip or it disappears from the spiral.
    const pending = entry({ id: "pending", sentiment: undefined });
    saveEntries([pending]);
    expect(getEntries().map((e) => e.id)).toEqual(["pending"]);
  });

  it("keeps an entry whose text is an empty string", () => {
    // the filter checks `text !== undefined`, so "" must be kept
    saveEntries([entry({ id: "blank", text: "" })]);
    expect(getEntries().map((e) => e.id)).toEqual(["blank"]);
  });
});

describe("entries resilience", () => {
  it("drops malformed records but keeps the good ones", () => {
    localStorage.setItem(
      "youAreHere_entries",
      JSON.stringify([
        entry({ id: "good" }),
        null,
        { id: "no-anchor", text: "x" },
        { anchorDate: "2026-01-01", text: "no id" },
        { id: "no-text", anchorDate: "2026-01-01" },
      ])
    );
    expect(getEntries().map((e) => e.id)).toEqual(["good"]);
  });

  it("recovers from corrupt JSON instead of throwing", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem("youAreHere_entries", "{not json at all");

    expect(() => getEntries()).not.toThrow();
    expect(getEntries()).toEqual([]);
  });

  it("clears the corrupt key so the next write starts clean", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem("youAreHere_entries", "{not json at all");
    getEntries();
    expect(localStorage.getItem("youAreHere_entries")).toBeNull();
  });
});

describe("config", () => {
  it("defaults zoom to 1 before anything is stored", () => {
    expect(getConfig().zoom).toBe(1);
  });

  it("merges a partial update over the existing config", () => {
    saveConfig({ zoom: 2.5 });
    const config = getConfig();
    expect(config.zoom).toBe(2.5);
    expect(config.currentYear).toBe(new Date().getFullYear());
  });

  it("always reports the authoritative firstUseDate, not a stale stored copy", () => {
    setFirstUseDate(new Date("2026-01-01T00:00:00"));
    saveConfig({ zoom: 2 });
    // overwrite the stored copy with something wrong
    const raw = JSON.parse(localStorage.getItem("youAreHere_config")!);
    raw.firstUseDate = "1999-01-01T00:00:00.000Z";
    localStorage.setItem("youAreHere_config", JSON.stringify(raw));

    expect(new Date(getConfig().firstUseDate).getFullYear()).toBe(2026);
  });

  it("falls back to defaults when the stored config is corrupt", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem("youAreHere_config", "not json");
    expect(getConfig().zoom).toBe(1);
  });
});

describe("the demo-seeded flag", () => {
  it("reports nothing seeded on a spiral nobody has opened", () => {
    expect(hasSeededDemo()).toBe(false);
  });

  it("remembers once the demo has been laid down", () => {
    markDemoSeeded();
    expect(hasSeededDemo()).toBe(true);
  });

  it("keeps saying so after every entry is deleted", () => {
    // This is the whole point of the flag. Without it an emptied record is
    // indistinguishable from a new one, and the demo gets put back on top
    // of somebody who just cleared it on purpose.
    markDemoSeeded();
    saveEntries([]);

    expect(getEntries()).toEqual([]);
    expect(hasSeededDemo()).toBe(true);
  });
});
