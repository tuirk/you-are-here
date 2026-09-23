import React, { useMemo } from "react";
import { JournalEntry, SpiralConfig } from "@/types/event";
import { EntrySmear } from "./EntrySmear";
import { EntryBurst } from "./EntryBurst";
import { getFutureDimming } from "@/utils/futureDimming";
import { getCrowdingByEntry } from "@/utils/crowding";
import { getOriginEntryId } from "@/utils/originEntry";

/**
 * How much wider the first day of the record scatters than an ordinary one.
 *
 * The beginning used to be marked by a portal drawn at the centre — an
 * object with no connection to anything written, which a full year of dust
 * eventually buried. This marks it with the record instead: the day the
 * spiral opens on is thrown twice as wide as its own intensity would ask
 * for, so the centre is recognisable as a day rather than as an ornament.
 */
const ORIGIN_SPLATTER = 2;

interface EntryVisualizationsProps {
  entries: JournalEntry[];
  config: SpiralConfig;
  /** Local midnight today, owned by the scene so every part agrees on it. */
  today: Date;
}

export const EntryVisualizations: React.FC<EntryVisualizationsProps> = ({
  entries,
  config,
  today,
}) => {
  const firstUseDate = useMemo(() => new Date(config.firstUseDate), [config.firstUseDate]);

  // How hard each entry has to hold back so its week stays legible rather
  // than clamping to white. Computed once for the whole record, because it
  // is a question about the entries around an entry, not about the entry.
  const crowding = useMemo(() => getCrowdingByEntry(entries), [entries]);

  // The day the record opens on, which is drawn wilder than any other.
  const originId = useMemo(() => getOriginEntryId(entries), [entries]);

  return (
    <>
      {entries.map((entry) => {
        const hasEndDate = !!entry.endDate;
        const isSmear = (entry.temporalScope === "smear" || entry.temporalScope === "forward") && hasEndDate;

        // A single moment: one tuft of dust on the curve.
        if (!isSmear) {
          const anchorDate = new Date(entry.anchorDate);
          // A projection starts faint and fills in as today catches up.
          const dim = getFutureDimming(anchorDate, today);
          return (
            <EntryBurst
              key={entry.id}
              entry={entry}
              firstUseDate={firstUseDate}
              zoom={config.zoom}
              dim={dim}
              crowding={crowding.get(entry.id)}
              splatterScale={entry.id === originId ? ORIGIN_SPLATTER : 1}
            />
          );
        }

        // For smear entries — split at today if they cross the boundary
        const anchorDate = new Date(entry.anchorDate);
        const endDate = new Date(entry.endDate!);
        const startsInPast = anchorDate <= today;
        const endsInFuture = endDate > today;
        const crossesToday = startsInPast && endsInFuture;

        // A span is dimmed by where its middle sits, so a stretch reaching
        // further out reads fainter than one about to arrive.
        const spanDim = (from: Date, to: Date) =>
          getFutureDimming(new Date((from.getTime() + to.getTime()) / 2), today);

        const anchorDim = getFutureDimming(anchorDate, today);

        return (
          <React.Fragment key={entry.id}>
            {/* The anchor gets the same tuft a one-off entry would, so the
                start of a stretch is legible without a ring or a sprite. */}
            <EntryBurst
              entry={entry}
              firstUseDate={firstUseDate}
              zoom={config.zoom}
              dim={anchorDim}
              crowding={crowding.get(entry.id)}
              splatterScale={entry.id === originId ? ORIGIN_SPLATTER : 1}
            />

            {crossesToday ? (
              <>
                {/* Past portion: full opacity, anchor → today */}
                <EntrySmear
                  entry={{
                    ...entry,
                    endDate: today.toISOString(),
                  }}
                  firstUseDate={firstUseDate}
                  zoom={config.zoom}
                  diffuse={false}
                  dim={1}
                  splatterScale={entry.id === originId ? ORIGIN_SPLATTER : 1}
                />
                {/* Future portion: diffuse, today → endDate */}
                <EntrySmear
                  entry={{
                    ...entry,
                    anchorDate: today.toISOString(),
                  }}
                  firstUseDate={firstUseDate}
                  zoom={config.zoom}
                  diffuse={true}
                  dim={spanDim(today, endDate)}
                  splatterScale={entry.id === originId ? ORIGIN_SPLATTER : 1}
                />
              </>
            ) : (
              /* Entirely past or entirely future */
              <EntrySmear
                entry={entry}
                firstUseDate={firstUseDate}
                zoom={config.zoom}
                diffuse={!startsInPast}
                dim={startsInPast ? 1 : spanDim(anchorDate, endDate)}
                splatterScale={entry.id === originId ? ORIGIN_SPLATTER : 1}
              />
            )}
          </React.Fragment>
        );
      })}
    </>
  );
};
