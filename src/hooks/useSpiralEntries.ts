import { useState, useEffect, useCallback, useRef } from "react";
import { JournalEntry, SpiralConfig } from "@/types/event";
import { saveEntry, getEntries, updateEntry, saveEntries, getConfig, deleteEntry, setFirstUseDate, hasSeededDemo, markDemoSeeded, ENTRIES_STORAGE_KEY, FIRST_USE_DATE_KEY } from "@/utils/storage";
import { useToast } from "@/hooks/use-toast";
import { analyzeEntry, ANALYSIS_PROMPT_FINGERPRINT, GEMINI_MODEL } from "@/services/gemini";
import { fetchRegionSummary, getStoredSummary, summaryKey } from "@/services/summaryCache";
import { entriesInPeriod, getRegionPeriod } from "@/utils/regionPeriod";
import { mapSentimentToColor } from "@/utils/colorMapping";
import { generateSeedData } from "@/utils/seedData";
import { HoverInfo } from "@/components/spiral/TildePlacement";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

/** Storage keys whose change in another tab means the record changed. */
const RECORD_KEYS = new Set([ENTRIES_STORAGE_KEY, FIRST_USE_DATE_KEY]);

/**
 * Find the earliest anchorDate across all entries.
 */
const findEarliestDate = (entries: JournalEntry[]): Date => {
  return entries.reduce((min, e) => {
    const d = new Date(e.anchorDate);
    return d < min ? d : min;
  }, new Date());
};

/**
 * Seed demo entries + set firstUseDate to earliest entry.
 * Returns the seeded entries.
 */
const seedAndConfigure = (entries: JournalEntry[]): void => {
  const earliest = findEarliestDate(entries);
  // IMPORTANT: set firstUseDate BEFORE calling getConfig(),
  // because getConfig() reads firstUseDate internally.
  setFirstUseDate(earliest);
  saveEntries(entries);
  markDemoSeeded();
};

export const useSpiralEntries = () => {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [config, setConfig] = useState<SpiralConfig>({
    startYear: currentYear,
    currentYear,
    firstUseDate: new Date().toISOString(),
    zoom: 1,
    centerX: window.innerWidth / 2,
    centerY: window.innerHeight / 2,
  });

  // Nothing is drawn until storage has been read, because an empty record
  // and a record that has not loaded yet look identical from here — and one
  // of them now shows a "start your spiral" screen.
  const [ready, setReady] = useState(false);

  const [anchorDate, setAnchorDate] = useState<Date | null>(null);
  const [showEntryPopup, setShowEntryPopup] = useState(false);
  const [showEntryLog, setShowEntryLog] = useState(false);

  const loadSeedData = useCallback(() => {
    const seed = generateSeedData();
    seedAndConfigure(seed);
    setEntries(seed);
    setConfig(getConfig()); // now reads the correct firstUseDate
    toast({ title: "Demo loaded", description: `${seed.length} entries added to the spiral` });
  }, [toast]);

  useEffect(() => {
    // Clear legacy data formats
    localStorage.removeItem("youAreHere_events");

    let savedEntries = getEntries();

    // Seed on the FIRST visit only. An empty record after that is a
    // deliberate one — somebody cleared it — and putting the demo back on
    // top of that would be the app arguing with them.
    if (savedEntries.length === 0 && !hasSeededDemo()) {
      const seed = generateSeedData();
      seedAndConfigure(seed);
      savedEntries = seed;
    }

    setEntries(savedEntries);
    // getConfig reads firstUseDate from storage — which is now correct
    setConfig(getConfig());
    setReady(true);
  }, []);

  // Another tab wrote the record. Without this, two open tabs drift apart
  // and whichever saves last silently erases what the other added.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && !RECORD_KEYS.has(e.key)) return;
      setEntries(getEntries());
      setConfig(getConfig());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const handleTildePlaced = useCallback((date: Date) => {
    setAnchorDate(date);
    setShowEntryPopup(true);
  }, []);

  /** Resolves true once the entry has been analysed and stored. */
  const runSentimentAnalysis = useCallback(async (entry: JournalEntry): Promise<boolean> => {
    if (!GEMINI_API_KEY) return false;

    const result = await analyzeEntry(entry.text, entry.anchorDate, GEMINI_API_KEY);
    if (!result) return false;

    const color = mapSentimentToColor(result.categories, result.intensity);

    const updated: JournalEntry = {
      ...entry,
      sentiment: {
        color,
        intensity: result.intensity,
        categories: result.categories,
      },
      temporalScope: result.temporalScope,
      endDate: result.endDate,
      analysis: {
        model: GEMINI_MODEL,
        promptFingerprint: ANALYSIS_PROMPT_FINGERPRINT,
        analyzedAt: new Date().toISOString(),
      },
    };

    updateEntry(updated);
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    return true;
  }, []);

  // An entry whose analysis failed — offline, rate-limited, a VPN the API
  // refuses — used to stay grey for good. Once per visit, give each one
  // another try, one at a time, and stop at the first failure rather than
  // hammering an API that is still unreachable.
  const retriedUnanalysed = useRef(false);
  useEffect(() => {
    if (!ready || retriedUnanalysed.current || !GEMINI_API_KEY) return;
    retriedUnanalysed.current = true;

    const pending = getEntries().filter((e) => !e.sentiment);
    if (pending.length === 0) return;

    (async () => {
      for (const entry of pending) {
        if (!(await runSentimentAnalysis(entry))) break;
      }
    })();
  }, [ready, runSentimentAnalysis]);

  const handleSaveEntry = useCallback((entry: JournalEntry) => {
    // Asked of storage rather than of state, so this stays correct without
    // putting `entries` in the dependency list and rebuilding the callback
    // on every keystroke of the record.
    const startsTheRecord = getEntries().length === 0;

    saveEntry(entry);

    // The first entry on an empty spiral is where the spiral now begins.
    // Without this the record keeps the start date of whatever was cleared
    // away, and a fresh first entry lands months along a curve made
    // entirely of empty days.
    if (startsTheRecord) {
      setFirstUseDate(new Date(entry.anchorDate));
      setConfig(getConfig());
    }

    setEntries((prev) => [...prev, entry]);
    toast({
      title: "Saved",
      description: "Your entry has been added to the spiral",
    });
    runSentimentAnalysis(entry);
  }, [toast, runSentimentAnalysis]);

  const handleDeleteEntry = useCallback((entryId: string) => {
    deleteEntry(entryId);
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
    toast({
      title: "Deleted",
      description: "Entry removed from your spiral",
    });
  }, [toast]);

  const handleDeleteMultiple = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    const remaining = getEntries().filter((e) => !idSet.has(e.id));
    saveEntries(remaining);
    setEntries(remaining);
    toast({
      title: "Deleted",
      description: `${ids.length} entries removed from your spiral`,
    });
  }, [toast]);

  // --- Hover summary ---
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    y: number;
    dateLabel: string;
    summary: string | null;
    loading: boolean;
    entryCount: number;
  } | null>(null);

  // The period the tooltip is currently showing. A summary that arrives
  // after the pointer has moved on belongs to somewhere else, and used to
  // land in the new tooltip under the wrong date.
  const hoveredSummaryKey = useRef<string | null>(null);

  const handleHover = useCallback((info: HoverInfo | null) => {
    if (!info) {
      hoveredSummaryKey.current = null;
      setHoverInfo(null);
      return;
    }

    const period = getRegionPeriod(info.date);
    const inPeriod = entriesInPeriod(entries, period);

    if (inPeriod.length === 0) {
      hoveredSummaryKey.current = null;
      setHoverInfo(null);
      return;
    }

    const key = summaryKey(period.key, inPeriod);
    hoveredSummaryKey.current = key;
    const base = { x: info.screenX, y: info.screenY, dateLabel: period.label, entryCount: inPeriod.length };

    const stored = getStoredSummary(key);
    if (stored) {
      setHoverInfo({ ...base, summary: stored, loading: false });
      return;
    }

    if (!GEMINI_API_KEY) {
      setHoverInfo({ ...base, summary: null, loading: false });
      return;
    }

    setHoverInfo({ ...base, summary: null, loading: true });
    fetchRegionSummary(key, inPeriod, GEMINI_API_KEY).then((summary) => {
      if (hoveredSummaryKey.current !== key) return;
      setHoverInfo((prev) => (prev ? { ...prev, summary, loading: false } : null));
    });
  }, [entries]);

  return {
    entries,
    ready,
    config,
    anchorDate,
    showEntryPopup,
    setShowEntryPopup,
    showEntryLog,
    setShowEntryLog,
    handleTildePlaced,
    handleSaveEntry,
    handleDeleteEntry,
    handleDeleteMultiple,
    handleHover,
    hoverInfo,
    loadSeedData,
    currentYear,
  };
};
