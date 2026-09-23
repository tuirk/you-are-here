import { JournalEntry } from "@/types/event";
import { parseSeedMarkdown } from "@/utils/seedMarkdown";

/**
 * The demo record: a written year, not a coded one.
 *
 * Every month lives in its own file in demo-content/ at the repo root, as
 * plain text, and the parser in seedMarkdown turns it into entries at build
 * time. See that file for the line format.
 *
 * The previous version of this module was fifteen hand-built objects with
 * hand-picked hex colours spread across five months. That is roughly one
 * entry every ten days, and the spiral is made of dust that reaches about
 * two days to either side of the day it belongs to — so seven days in ten
 * had nothing on them at all and the record read as a handful of lights
 * strung across a lot of dark. No amount of brightness tuning fixes that;
 * the curve was mostly empty, and it looked it.
 */
// The folder's own README explains the record; it is not a month.
const files = import.meta.glob(["/demo-content/*.md", "!/demo-content/README.md"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const generateSeedData = (): JournalEntry[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const entries: JournalEntry[] = [];
  const issues: string[] = [];

  // Sorted so the record reads in order even though glob order is not
  // guaranteed — findEarliestDate does not care, but the entry log does.
  for (const path of Object.keys(files).sort()) {
    const result = parseSeedMarkdown(files[path], path.split("/").pop() ?? path, { today });
    entries.push(...result.entries);
    issues.push(...result.issues);
  }

  // These files are meant to be edited by hand. A line the parser could not
  // read is dropped rather than thrown, so a typo costs that one day — but
  // it says so, because a silently missing day is worse than a loud one.
  if (issues.length > 0) {
    console.warn(`[seed] skipped ${issues.length} line(s):\n${issues.join("\n")}`);
  }

  return entries.sort((a, b) => a.anchorDate.localeCompare(b.anchorDate));
};
