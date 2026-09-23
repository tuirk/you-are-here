import { JournalEntry } from "@/types/event";
import { parseLocalDate } from "@/utils/seedMarkdown";
import { hashString } from "@/utils/hash";

export const GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

interface SentimentResult {
  categories: string[];
  intensity: number;
  temporalScope: "point" | "smear" | "forward";
  endDate?: string; // ISO date string — when the feeling ends
}

const buildSentimentPrompt = (anchorDate: string, todayDate: string) => `Sentiment analysis for a journal app. Anchor date: ${anchorDate}. Today: ${todayDate}.

Return JSON with these EXACT fields:
- "categories": 1-3 from ONLY these: joy, sadness, anger, anxiety, love, hope, mixed, neutral
- "intensity": 0.0-1.0 emotional strength
- "temporalScope": "point" (single day), "smear" (spans time), or "forward" (future anticipation)
- "endDate": ISO date string (only for smear/forward)

Temporal rules — the anchor date is where the user placed it, never change it:
- "since that day" / "since then" / "been feeling" → smear, endDate = ${todayDate}
- "for X weeks/months" → smear, endDate = ${todayDate}
- "until X" → smear, endDate = when X happened
- "next month" / "upcoming" → forward, endDate = anchor + estimated days
- No temporal language → point, no endDate

Sentiment rules:
- "it's fine but I can't sleep" = anxiety not joy
- Mixed emotions valid (joy + sadness)
- Intensity = emotional weight of writing, not just named emotions`;

/**
 * The calendar day a local date falls on, as YYYY-MM-DD.
 *
 * Not toISOString(): every date in the app is local midnight, and in UTC that
 * is still the previous day anywhere east of Greenwich, so Gemini was told
 * the anchor and "today" were a day earlier than the user meant.
 */
export const toLocalDateString = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const analyzeEntry = async (
  text: string,
  anchorDate: string,
  apiKey: string
): Promise<SentimentResult | null> => {
  const todayStr = toLocalDateString(new Date());
  const anchorStr = toLocalDateString(new Date(anchorDate));

  try {
    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: buildSentimentPrompt(anchorStr, todayStr) },
              { text: `Journal entry:\n"${text}"` },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 512,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      console.error("Gemini API error:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const textPart = parts.find((p: { text?: string }) => p.text)?.text;
    if (!textPart) return null;

    const cleaned = textPart.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    if (!parsed.categories || typeof parsed.intensity !== "number") return null;

    return {
      categories: parsed.categories,
      intensity: Math.max(0, Math.min(1, parsed.intensity)),
      temporalScope: parsed.temporalScope || "point",
      // Gemini answers in plain YYYY-MM-DD, which Date reads as UTC midnight:
      // the previous evening west of Greenwich. Read it as a local day.
      endDate: parsed.endDate
        ? parseLocalDate(String(parsed.endDate).slice(0, 10))?.toISOString()
        : undefined,
    };
  } catch (e) {
    console.error("Gemini analysis failed:", e);
    return null;
  }
};

// --- Region summary generation ---

const SUMMARY_PROMPT = `You are a reflective journal companion. Given a set of journal entries from around the same time period, write a brief 1-2 sentence summary of that period.

Tone: warm, observational, reflective — like a thoughtful friend looking back. Not clinical or formal.

Example: "A heavy week — you kept returning to the conversation with your mother. Some brightness around Wednesday when coffee with a friend broke through."

Return ONLY the summary text, no quotes, no explanation.`;

/**
 * Fingerprints of the prompts as written. Anything cached or stored from a
 * Gemini answer carries one, so editing a prompt retires the old answers on
 * its own — there is no version number to remember to bump.
 */
export const SUMMARY_PROMPT_FINGERPRINT = hashString(`${GEMINI_MODEL}\n${SUMMARY_PROMPT}`);
export const ANALYSIS_PROMPT_FINGERPRINT = hashString(
  `${GEMINI_MODEL}\n${buildSentimentPrompt("{anchor}", "{today}")}`,
);

export const generateRegionSummary = async (
  entries: JournalEntry[],
  apiKey: string
): Promise<string | null> => {
  if (entries.length === 0) return null;

  const entriesText = entries
    .map((e) => {
      const d = new Date(e.anchorDate);
      return `[${d.toLocaleDateString()}] ${e.text}`;
    })
    .join("\n\n");

  try {
    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: SUMMARY_PROMPT },
              { text: `Journal entries:\n${entriesText}` },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 200,
        },
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch {
    return null;
  }
};
