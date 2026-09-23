import { JournalEntry } from "@/types/event";
import { mapSentimentToColor } from "@/utils/colorMapping";
import { v4 as uuidv4 } from "uuid";

/**
 * Reads the journal's plain-text seed format.
 *
 * One entry per line, six pipe-separated fields:
 *
 *   2026-01-04 | normal | hope | until:none | written:same | first run, 2k...
 *   2026-03-10 | loud   | sadness,love | until:2026-04-28 | written:2026-04-28 | ...
 *
 * Blank lines and `#` headings are ignored, so each month file can carry a
 * title. Everything after the fifth pipe is the entry text, pipes and all.
 *
 * The format exists so the demo record can be WRITTEN rather than coded. A
 * spiral is only as alive as the number of days on it: the previous seed was
 * fifteen hand-built objects across five months, which left most of the
 * curve dark and made the whole thing read as a few beads on a wire. Prose
 * in a .md file is cheap to add a line to; a TypeScript object literal with
 * a hand-picked hex colour is not.
 */

export type Loudness = "quiet" | "normal" | "loud";

/**
 * How loud a day was, as a 0-1 intensity.
 *
 * The seed files record loudness rather than a number because that is what
 * a person can actually judge about their own day. Intensity then drives
 * three things downstream — particle count, mote opacity and how far
 * mapSentimentToColor pushes the colour toward grey — so these three values
 * are the difference between a whispered Tuesday and a day that knocked the
 * wind out of you.
 *
 * `quiet` sits at 0.4 rather than lower on purpose: below 0.5
 * mapSentimentToColor lerps toward a 180-grey, and at 0.25 a quiet day's
 * colour was more grey than feeling. 0.4 keeps it recognisably itself while
 * still reading as muted next to a loud one.
 */
export const LOUDNESS_INTENSITY: Record<Loudness, number> = {
  quiet: 0.4,
  normal: 0.62,
  loud: 0.88,
};

const LOUDNESS = new Set<string>(["quiet", "normal", "loud"]);

/**
 * The categories colorMapping knows how to colour. A line naming anything
 * else is kept, but the unknown category is dropped and reported — silently
 * mapping it to grey would hide the typo behind a plausible-looking cluster.
 */
const KNOWN_CATEGORIES = new Set([
  "joy",
  "sadness",
  "anger",
  "anxiety",
  "love",
  "hope",
  "mixed",
  "neutral",
]);

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Midnight local time, NOT UTC.
 *
 * `new Date("2026-01-04")` parses as UTC midnight, which is the previous
 * evening anywhere west of Greenwich — so an entry would land on the wrong
 * day of the spiral for roughly half the world. Every other date in the app
 * comes from setHours(0,0,0,0) on a local date, and these have to agree or
 * the today marker sits a day away from the entry written today.
 */
export const parseLocalDate = (value: string): Date | null => {
  if (!DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  // Rejects 2026-02-30 and friends, which Date would roll forward instead.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
};

export interface SeedParseResult {
  entries: JournalEntry[];
  /** Human-readable "file:line — what was wrong" for every line skipped. */
  issues: string[];
}

interface ParseOptions {
  /** Local midnight today. Decides which spans are memory and which are projection. */
  today?: Date;
}

const startOfToday = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Parses one month file into entries.
 *
 * A bad line is skipped and reported rather than thrown. These files are
 * meant to be hand-edited, and a stray pipe in an entry written at midnight
 * should cost that one day, not blank the whole spiral on load.
 */
export const parseSeedMarkdown = (
  markdown: string,
  source = "seed",
  { today = startOfToday() }: ParseOptions = {}
): SeedParseResult => {
  const entries: JournalEntry[] = [];
  const issues: string[] = [];

  markdown.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const at = `${source}:${index + 1}`;
    const fields = trimmed.split(" | ");

    if (fields.length < 6) {
      issues.push(`${at} — expected 6 pipe-separated fields, found ${fields.length}`);
      return;
    }

    const [rawDate, rawLoudness, rawCategories, rawUntil, rawWritten] = fields;
    // Everything past the fifth pipe belongs to the entry, pipes included.
    const text = fields.slice(5).join(" | ").trim();

    const anchor = parseLocalDate(rawDate);
    if (!anchor) {
      issues.push(`${at} — "${rawDate}" is not a YYYY-MM-DD date`);
      return;
    }

    if (!text) {
      issues.push(`${at} — no entry text`);
      return;
    }

    if (!LOUDNESS.has(rawLoudness)) {
      issues.push(`${at} — "${rawLoudness}" is not quiet, normal or loud`);
      return;
    }
    const intensity = LOUDNESS_INTENSITY[rawLoudness as Loudness];

    const categories = rawCategories
      .split(",")
      .map((c) => c.trim())
      .filter((c) => {
        if (!c) return false;
        if (!KNOWN_CATEGORIES.has(c)) {
          issues.push(`${at} — unknown feeling "${c}", dropped`);
          return false;
        }
        return true;
      });

    if (categories.length === 0) {
      issues.push(`${at} — no recognisable feeling in "${rawCategories}"`);
      return;
    }

    if (!rawUntil.startsWith("until:")) {
      issues.push(`${at} — "${rawUntil}" should be until:none or until:YYYY-MM-DD`);
      return;
    }
    const untilValue = rawUntil.slice("until:".length);
    let endDate: Date | null = null;
    if (untilValue !== "none") {
      endDate = parseLocalDate(untilValue);
      if (!endDate) {
        issues.push(`${at} — "${untilValue}" is not a YYYY-MM-DD date`);
        return;
      }
      if (endDate.getTime() <= anchor.getTime()) {
        // A span that ends before it starts would be drawn backwards along
        // the curve. Keep the day, drop the span.
        issues.push(`${at} — until:${untilValue} is not after ${rawDate}, treated as a single day`);
        endDate = null;
      }
    }

    if (!rawWritten.startsWith("written:")) {
      issues.push(`${at} — "${rawWritten}" should be written:same or written:YYYY-MM-DD`);
      return;
    }
    const writtenValue = rawWritten.slice("written:".length);
    let createdAt = anchor;
    if (writtenValue !== "same") {
      const written = parseLocalDate(writtenValue);
      if (!written) {
        issues.push(`${at} — "${writtenValue}" is not a YYYY-MM-DD date`);
        return;
      }
      if (written.getTime() < anchor.getTime()) {
        // You cannot write something down before it happened. Rather than
        // invent a rule, keep the day it belongs to and report the line.
        issues.push(`${at} — written:${writtenValue} is before ${rawDate}, ignored`);
      } else {
        createdAt = written;
      }
    }

    entries.push({
      id: uuidv4(),
      text,
      createdAt: createdAt.toISOString(),
      anchorDate: anchor.toISOString(),
      ...(endDate ? { endDate: endDate.toISOString() } : {}),
      sentiment: {
        color: mapSentimentToColor(categories, intensity),
        intensity,
        categories,
      },
      // A stretch that has not finished yet is a projection, not a memory —
      // EntryVisualizations draws the part past today as a ghost.
      temporalScope: !endDate
        ? "point"
        : endDate.getTime() > today.getTime()
          ? "forward"
          : "smear",
    });
  });

  return { entries, issues };
};
