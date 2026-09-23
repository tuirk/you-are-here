import type { JournalEntry } from "@/types/event";
import { hashString } from "@/utils/hash";
import { generateRegionSummary, SUMMARY_PROMPT_FINGERPRINT } from "./gemini";

/**
 * Region summaries, kept across visits.
 *
 * Each summary is stored under a hash of everything that produced it: the
 * model and prompt (via SUMMARY_PROMPT_FINGERPRINT), the period, and the id,
 * date, span and text of every entry in it. Nothing is ever invalidated by
 * hand — add an entry, delete one, or edit the prompt and the hash changes,
 * so the old summary is simply never asked for again and ages out.
 */

export const SUMMARY_STORAGE_KEY = "youAreHere_summaries";

/** Enough for years of hovering; a small fraction of localStorage's ~5 MB. */
export const MAX_STORED_SUMMARIES = 200;

interface StoredSummary {
  text: string;
  /** Last time it was shown, for least-recently-used eviction. */
  usedAt: number;
}

type SummaryStore = Record<string, StoredSummary>;

export const summaryKey = (periodKey: string, entries: JournalEntry[]): string => {
  const material = [...entries]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((e) => [e.id, e.anchorDate, e.endDate ?? "", e.text].join("\u0000"))
    .join("\u0001");
  return hashString(`${SUMMARY_PROMPT_FINGERPRINT}\u0002${periodKey}\u0002${material}`);
};

const readStore = (): SummaryStore => {
  try {
    const raw = localStorage.getItem(SUMMARY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    // Corrupt or unavailable storage costs a Gemini call, never the tooltip.
    return {};
  }
};

const writeStore = (store: SummaryStore): void => {
  const keys = Object.keys(store);
  if (keys.length > MAX_STORED_SUMMARIES) {
    keys
      .sort((a, b) => store[a].usedAt - store[b].usedAt)
      .slice(0, keys.length - MAX_STORED_SUMMARIES)
      .forEach((k) => delete store[k]);
  }
  try {
    localStorage.setItem(SUMMARY_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Full or blocked storage: the summary still shows, it just isn't kept.
  }
};

export const getStoredSummary = (key: string): string | null => {
  const store = readStore();
  const hit = store[key];
  if (!hit || typeof hit.text !== "string") return null;
  hit.usedAt = Date.now();
  writeStore(store);
  return hit.text;
};

const storeSummary = (key: string, text: string): void => {
  const store = readStore();
  store[key] = { text, usedAt: Date.now() };
  writeStore(store);
};

/** Requests still on their way, so hovering back and forth never asks twice. */
const inFlight = new Map<string, Promise<string | null>>();

/**
 * The summary for a period's entries: from storage if it has been written
 * before, from the request already running if there is one, otherwise from
 * Gemini — and then kept.
 */
export const fetchRegionSummary = (
  key: string,
  entries: JournalEntry[],
  apiKey: string,
): Promise<string | null> => {
  const stored = getStoredSummary(key);
  if (stored) return Promise.resolve(stored);

  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = generateRegionSummary(entries, apiKey)
    .then((text) => {
      if (text) storeSummary(key, text);
      return text;
    })
    .finally(() => inFlight.delete(key));

  inFlight.set(key, request);
  return request;
};
