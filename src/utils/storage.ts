import { JournalEntry, SpiralConfig } from "@/types/event";

export const ENTRIES_STORAGE_KEY = "youAreHere_entries";
const CONFIG_STORAGE_KEY = "youAreHere_config";
export const FIRST_USE_DATE_KEY = "youAreHere_firstUseDate";
const DEMO_SEEDED_KEY = "youAreHere_demoSeeded";

// --- Demo record ---

/**
 * Whether the demo record has ever been laid down on this spiral.
 *
 * Without this, "no entries" means two completely different things — a
 * spiral nobody has opened yet, and a spiral somebody has just cleared —
 * and the app cannot tell them apart. It used to treat both as the first,
 * so deleting every entry silently put the demo back, and there was no way
 * to reach an empty spiral at all.
 */
export const hasSeededDemo = (): boolean =>
  localStorage.getItem(DEMO_SEEDED_KEY) === "true";

export const markDemoSeeded = (): void => {
  localStorage.setItem(DEMO_SEEDED_KEY, "true");
};

// --- First use date ---

export const getFirstUseDate = (): Date => {
  const stored = localStorage.getItem(FIRST_USE_DATE_KEY);
  if (stored) return new Date(stored);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  localStorage.setItem(FIRST_USE_DATE_KEY, today.toISOString());
  return today;
};

export const setFirstUseDate = (date: Date): void => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  localStorage.setItem(FIRST_USE_DATE_KEY, d.toISOString());
};

// --- Journal entries ---

export const saveEntries = (entries: JournalEntry[]): void => {
  localStorage.setItem(ENTRIES_STORAGE_KEY, JSON.stringify(entries));
};

export const getEntries = (): JournalEntry[] => {
  const stored = localStorage.getItem(ENTRIES_STORAGE_KEY);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored);
    return parsed.filter(
      (e: Partial<JournalEntry> | null) =>
        e && e.id && e.anchorDate && e.text !== undefined
    ) as JournalEntry[];
  } catch (e) {
    console.error("Failed to parse stored entries:", e);
    localStorage.removeItem(ENTRIES_STORAGE_KEY);
    return [];
  }
};

export const saveEntry = (entry: JournalEntry): void => {
  const entries = getEntries();
  entries.push(entry);
  saveEntries(entries);
};

export const updateEntry = (updated: JournalEntry): void => {
  const entries = getEntries().map((e) =>
    e.id === updated.id ? updated : e
  );
  saveEntries(entries);
};

export const deleteEntry = (entryId: string): void => {
  const entries = getEntries().filter((e) => e.id !== entryId);
  saveEntries(entries);
};

// --- Config ---

export const saveConfig = (config: Partial<SpiralConfig>): void => {
  const existingConfig = getConfig();
  const updatedConfig = { ...existingConfig, ...config };
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(updatedConfig));
};

export const getConfig = (): SpiralConfig => {
  const currentYear = new Date().getFullYear();
  const firstUseDate = getFirstUseDate();
  const defaultConfig: SpiralConfig = {
    startYear: firstUseDate.getFullYear(),
    currentYear,
    firstUseDate: firstUseDate.toISOString(),
    zoom: 1,
    centerX: window.innerWidth / 2,
    centerY: window.innerHeight / 2,
  };

  const storedConfig = localStorage.getItem(CONFIG_STORAGE_KEY);
  if (!storedConfig) return defaultConfig;

  try {
    const parsedConfig = JSON.parse(storedConfig);
    return {
      ...defaultConfig,
      ...parsedConfig,
      firstUseDate: firstUseDate.toISOString(),
    };
  } catch (e) {
    console.error("Failed to parse stored config:", e);
    return defaultConfig;
  }
};
