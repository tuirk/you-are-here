export interface Sentiment {
  color: string;           // hex color derived by AI
  intensity: number;       // 0-1 emotional strength
  categories: string[];    // e.g. ["joy", "anxiety"]
}

export interface JournalEntry {
  id: string;
  text: string;                              // raw user input
  createdAt: string;                         // ISO string — when they wrote it
  anchorDate: string;                        // ISO string — where on the spiral
  endDate?: string;                          // ISO string — if AI detects time range
  sentiment?: Sentiment;                     // AI-derived, null until analyzed
  temporalScope: "point" | "smear" | "forward";
  analysis?: EntryAnalysis;                  // what produced `sentiment`, if Gemini did
}

/**
 * Which model and prompt analysed an entry. Nothing re-analyses on a
 * mismatch today; recording it keeps that possible if the prompt changes.
 */
export interface EntryAnalysis {
  model: string;
  promptFingerprint: string;
  analyzedAt: string;                        // ISO string
}

export interface SpiralConfig {
  startYear: number;
  currentYear: number;
  firstUseDate: string;
  zoom: number;
  centerX: number;
  centerY: number;
}
