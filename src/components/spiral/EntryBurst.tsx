import React, { useMemo } from "react";
import { JournalEntry } from "@/types/event";
import { calculateDailySegment } from "@/utils/daily/dailyDurationSegments";
import {
  SPIRAL_BASE_RADIUS,
  SPIRAL_RADIUS_GROWTH,
  SPIRAL_HEIGHT_PER_REV,
} from "@/utils/daily/generateDailySpiralPoints";
import { getProjectionDensity } from "@/utils/futureDimming";
import { ParticleLayer } from "./particles/ParticleLayer";
import { useGenerateParticles, getShapeSeed } from "./particles/ParticleGenerator";

const DAY_MS = 1000 * 60 * 60 * 24;

interface EntryBurstProps {
  entry: JournalEntry;
  firstUseDate: Date;
  zoom: number;
  /** Solidity from utils/futureDimming — 1 for lived, lower for projections. */
  dim?: number;
  /**
   * Relief from utils/crowding — 1 when this day has its patch of sky to
   * itself, lower where entries are stacked on each other.
   */
  crowding?: number;
  /** 2 for the day the record opens — see utils/originEntry. */
  splatterScale?: number;
}

/**
 * A single-moment entry, drawn as a compact knot of the same dust that makes
 * up the smears.
 *
 * It used to be an opaque sphere, an additive halo sprite and a geometric
 * ring — three different rendering languages for one dot, none of them the
 * language everything around it was speaking. Next to a smear made of
 * thousands of motes it read as a glass bead dropped onto a cloud.
 *
 * Here the moment gets a single day of arc to scatter along, so it lands as
 * a dense tuft rather than a perfect sphere, and the additive overlap in the
 * middle supplies the bright core on its own without a sprite faking one.
 */
export const EntryBurst: React.FC<EntryBurstProps> = ({
  entry,
  firstUseDate,
  zoom,
  dim = 1,
  crowding = 1,
  splatterScale = 1,
}) => {
  const color = entry.sentiment?.color || "#aaaaaa";
  const intensity = entry.sentiment?.intensity ?? 0.5;

  const anchorDate = useMemo(() => new Date(entry.anchorDate), [entry.anchorDate]);

  // One day of the spiral, so the tuft follows the curve instead of being a
  // ball bolted onto it.
  const points = useMemo(
    () =>
      calculateDailySegment(
        anchorDate,
        new Date(anchorDate.getTime() + DAY_MS),
        firstUseDate,
        90,
        SPIRAL_BASE_RADIUS * zoom,
        SPIRAL_RADIUS_GROWTH * zoom,
        SPIRAL_HEIGHT_PER_REV * zoom
      ),
    [anchorDate, firstUseDate, zoom]
  );

  /**
   * The relief is split evenly between how many motes are drawn and how
   * bright each one is, because brightness under additive blending is the
   * product of the two — so a square root on each side multiplies back to
   * exactly the relief asked for. Taking it all out of opacity would leave
   * a crowded week costing just as much to draw as before; taking it all
   * out of the count would thin the dust until the stacking showed as
   * grain. Half each buys back both.
   */
  const crowdingSplit = Math.sqrt(crowding);

  // This entry's own shape. Both layers take the same one, so the halo is
  // the halo of THIS knot rather than of a differently-squashed one.
  const shapeSeed = useMemo(() => getShapeSeed(entry.id), [entry.id]);

  // Thinned by how far off this entry is. Opacity alone cannot make an
  // additively-blended cluster read as faint — see getProjectionDensity.
  const particleCount = Math.max(
    1,
    Math.floor((150 + intensity * 260) * getProjectionDensity(dim) * crowdingSplit)
  );
  const haloCount = Math.floor(particleCount * 0.7);

  const core = useGenerateParticles({
    color,
    intensity,
    points,
    particleCount,
    isMinimalDuration: true,
    shapeSeed,
    splatterScale,
  });

  const halo = useGenerateParticles({
    color,
    intensity,
    points,
    particleCount: haloCount,
    isBackgroundLayer: true,
    isMinimalDuration: true,
    shapeSeed,
    splatterScale,
  });

  return (
    <group>
      <ParticleLayer
        positions={core.positions}
        sizes={core.sizes}
        colors={core.colors}
        phases={core.phases}
        opacities={core.opacities}
        size={0.13}
        opacity={0.95 * dim * crowdingSplit}
        rotationSpeed={0.002}
        pulseSpeed={0.22}
        pulseAmplitude={0.012}
      />

      <ParticleLayer
        positions={halo.positions}
        sizes={halo.sizes}
        colors={halo.colors}
        phases={halo.phases}
        opacities={halo.opacities}
        size={0.20}
        opacity={0.6 * dim * crowdingSplit}
        isGlow
        rotationSpeed={-0.0014}
        pulseSpeed={0.16}
        pulsePhase={1.4}
        pulseAmplitude={0.018}
      />
    </group>
  );
};
