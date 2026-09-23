import { describe, it, expect } from "vitest";
import { parseSeedMarkdown, parseLocalDate, LOUDNESS_INTENSITY } from "./seedMarkdown";

/**
 * The seed files are prose, edited by hand. This suite is the contract that
 * says what a line means and, just as importantly, what happens to a line
 * that is wrong — because the answer has to be "that day is skipped and
 * named", never "the spiral comes up empty".
 */

const TODAY = new Date(2026, 5, 15); // 2026-06-15, local midnight

const line = (parts: Partial<{
  date: string;
  loud: string;
  emo: string;
  until: string;
  written: string;
  text: string;
}> = {}) => {
  const {
    date = "2026-06-01",
    loud = "normal",
    emo = "joy",
    until = "until:none",
    written = "written:same",
    text = "a day happened",
  } = parts;
  return `${date} | ${loud} | ${emo} | ${until} | ${written} | ${text}`;
};

const parse = (markdown: string) => parseSeedMarkdown(markdown, "test.md", { today: TODAY });

describe("parseSeedMarkdown — reading a line", () => {
  it("turns one line into one entry", () => {
    const { entries, issues } = parse(line({ text: "ran 3k without walking" }));

    expect(issues).toEqual([]);
    expect(entries).toHaveLength(1);
    expect(entries[0].text).toBe("ran 3k without walking");
    expect(entries[0].temporalScope).toBe("point");
    expect(entries[0].endDate).toBeUndefined();
    expect(entries[0].id).toBeTruthy();
  });

  it("anchors the entry at local midnight, not UTC", () => {
    // UTC parsing would put this on 2026-05-31 for anyone west of Greenwich,
    // which is the wrong day of the spiral.
    const { entries } = parse(line({ date: "2026-06-01" }));
    const anchor = new Date(entries[0].anchorDate);

    expect(anchor.getFullYear()).toBe(2026);
    expect(anchor.getMonth()).toBe(5);
    expect(anchor.getDate()).toBe(1);
    expect(anchor.getHours()).toBe(0);
  });

  it("ignores headings and blank lines", () => {
    const { entries, issues } = parse(`# 2026-06 — the sea\n\n${line()}\n\n`);

    expect(issues).toEqual([]);
    expect(entries).toHaveLength(1);
  });

  it("keeps pipes that belong to the entry text", () => {
    const { entries, issues } = parse(line({ text: "he said | and then nothing" }));

    expect(issues).toEqual([]);
    expect(entries[0].text).toBe("he said | and then nothing");
  });
});

describe("parseSeedMarkdown — loudness and feeling", () => {
  it("maps loudness to intensity", () => {
    const { entries } = parse(
      [line({ loud: "quiet" }), line({ loud: "normal" }), line({ loud: "loud" })].join("\n")
    );

    expect(entries.map((e) => e.sentiment?.intensity)).toEqual([
      LOUDNESS_INTENSITY.quiet,
      LOUDNESS_INTENSITY.normal,
      LOUDNESS_INTENSITY.loud,
    ]);
  });

  it("keeps a quiet day recognisably its own colour", () => {
    // Below 0.5 mapSentimentToColor lerps toward a 180-grey. A quiet day
    // should read as muted, not as fog.
    const { entries } = parse(line({ loud: "quiet", emo: "anxiety" }));
    const color = entries[0].sentiment!.color;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));

    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeGreaterThan(40);
  });

  it("carries every named feeling through to the sentiment", () => {
    const { entries } = parse(line({ emo: "love,sadness" }));

    expect(entries[0].sentiment?.categories).toEqual(["love", "sadness"]);
  });

  it("drops a feeling it cannot colour, and says so", () => {
    const { entries, issues } = parse(line({ emo: "joy,elation" }));

    expect(entries[0].sentiment?.categories).toEqual(["joy"]);
    expect(issues.join()).toMatch(/unknown feeling "elation"/);
  });

  it("skips a line whose feelings are all unknown", () => {
    const { entries, issues } = parse(line({ emo: "ennui" }));

    expect(entries).toEqual([]);
    expect(issues.join()).toMatch(/no recognisable feeling/);
  });
});

describe("parseSeedMarkdown — spans", () => {
  it("reads until: as a span that ended, when it is behind today", () => {
    const { entries } = parse(line({ date: "2026-06-01", until: "until:2026-06-10" }));

    expect(entries[0].temporalScope).toBe("smear");
    expect(new Date(entries[0].endDate!).getDate()).toBe(10);
  });

  it("reads a span reaching past today as a projection", () => {
    const { entries } = parse(line({ date: "2026-06-01", until: "until:2026-07-20" }));

    expect(entries[0].temporalScope).toBe("forward");
  });

  it("treats a span ending on its own start day as a single day", () => {
    const { entries, issues } = parse(line({ date: "2026-06-01", until: "until:2026-06-01" }));

    expect(entries[0].temporalScope).toBe("point");
    expect(entries[0].endDate).toBeUndefined();
    expect(issues.join()).toMatch(/treated as a single day/);
  });

  it("refuses to draw a span backwards", () => {
    const { entries, issues } = parse(line({ date: "2026-06-10", until: "until:2026-06-01" }));

    expect(entries[0].temporalScope).toBe("point");
    expect(entries[0].endDate).toBeUndefined();
    expect(issues.join()).toMatch(/not after/);
  });
});

describe("parseSeedMarkdown — when it was written", () => {
  it("writes a same-day entry at the day it belongs to", () => {
    const { entries } = parse(line({ date: "2026-06-01", written: "written:same" }));

    expect(entries[0].createdAt).toBe(entries[0].anchorDate);
  });

  it("keeps a late entry on its own day but records when it was written", () => {
    const { entries } = parse(line({ date: "2026-03-10", written: "written:2026-04-28" }));

    expect(new Date(entries[0].anchorDate).getMonth()).toBe(2);
    expect(new Date(entries[0].createdAt).getMonth()).toBe(3);
  });

  it("ignores a written date that precedes the day itself", () => {
    const { entries, issues } = parse(line({ date: "2026-06-10", written: "written:2026-06-01" }));

    expect(entries[0].createdAt).toBe(entries[0].anchorDate);
    expect(issues.join()).toMatch(/is before/);
  });
});

describe("parseSeedMarkdown — a bad line costs one day, not the spiral", () => {
  it("keeps the good lines around a broken one", () => {
    const { entries, issues } = parse(
      [line({ text: "before" }), "2026-06-02 | normal | joy | broken", line({ text: "after" })].join("\n")
    );

    expect(entries.map((e) => e.text)).toEqual(["before", "after"]);
    expect(issues).toHaveLength(1);
  });

  it("names the file and line of anything it skipped", () => {
    const { issues } = parse(`# heading\n${line({ date: "2026-06-32" })}`);

    expect(issues[0]).toMatch(/^test\.md:2 —/);
  });

  it.each([
    ["a date that is not a date", line({ date: "june the first" })],
    ["a day that does not exist", line({ date: "2026-02-30" })],
    ["a loudness it does not know", line({ loud: "deafening" })],
    ["a malformed until", line({ until: "2026-06-10" })],
    ["a malformed written", line({ written: "later" })],
    ["no text at all", "2026-06-01 | normal | joy | until:none | written:same | "],
  ])("skips %s", (_label, bad) => {
    const { entries, issues } = parse(bad);

    expect(entries).toEqual([]);
    expect(issues).toHaveLength(1);
  });
});

describe("parseLocalDate", () => {
  it("rejects a day that rolled over", () => {
    expect(parseLocalDate("2026-02-30")).toBeNull();
  });

  it("accepts a real leap day", () => {
    expect(parseLocalDate("2024-02-29")?.getDate()).toBe(29);
  });
});
