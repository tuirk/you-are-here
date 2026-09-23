# Demo content

A fictional year of journal entries, from January to September 2026: 161 entries, one file per month. It's the record in the screenshots and the demo videos, and it loads on your first visit so the spiral has something on it. Everyone in it is made up.

Clear it whenever you like, and it won't come back.

## The format

One entry per line, six fields separated by pipes:

```
2026-03-10 | loud | sadness,anxiety | until:none | written:same | nell rang at twenty to three...
```

| Field | What it means |
|---|---|
| Date | The day the entry is pinned to |
| Loudness | `quiet`, `normal` or `loud`: how strongly the day comes through |
| Feelings | One or more of `joy`, `sadness`, `anger`, `anxiety`, `love`, `hope`, `mixed`, `neutral`, comma-separated |
| `until:` | `none` for a single day, or the date the feeling lasts until. Past today, it's drawn faint as something still to come |
| `written:` | `same`, or the date it was actually written if that was later |
| Text | Everything after the fifth pipe |

Blank lines and `#` headings are ignored. The full rules are in [src/utils/seedMarkdown.ts](../src/utils/seedMarkdown.ts), and `npm test` checks every line, so a typo shows up as a failing test instead of a day quietly missing from the spiral.

While running `npm run dev`, you can load the demo again from the browser console with `loadSpiralDemo()`.
