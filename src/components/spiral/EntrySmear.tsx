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

interface EntrySmearProps {
  entry: JournalEntry;
  firstUseDate: Date;
  zoom: number;
  diffuse?: boolean;
  /**
   * How solid this stretch should read, from utils/futureDimming. 1 for
   * anything lived; below 1 for a projection that has not arrived yet.
   */
  dim?: number;
  /** 2 for the day the record opens — see utils/originEntry. */
  splatterScale?: number;
}

/**
 * Renders a rich 3-layer particle dust trail along the spiral for entries that span time.
 * Diffuse mode (forward projections) also thins the particle count.
 */
export const EntrySmear: React.FC<EntrySmearProps> = ({
  entry,
  firstUseDate,
  zoom,
  diffuse = false,
  dim = 1,
  splatterScale = 1,
}) => {
  const color = entry.sentiment?.color || "#aaaaaa";
  const intensity = entry.sentiment?.intensity ?? 0.5;

  const anchorDate = new Date(entry.anchorDate);
  const endDate = new Date(entry.endDate || entry.anchorDate);

  const spanLengthInDays = Math.max(1, Math.floor(
    (endDate.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24)
  ));

  const points = calculateDailySegment(
    anchorDate,
    endDate,
    firstUseDate,
    200 + Math.min(300, spanLengthInDays),
    SPIRAL_BASE_RADIUS * zoom,
    SPIRAL_RADIUS_GROWTH * zoom,
    SPIRAL_HEIGHT_PER_REV * zoom
  );

  const particleCount = useMemo(() => {
    const intensityFactor = 1.5 + (intensity * 10) * 0.4;
    const lengthFactor = Math.min(1.2, Math.log10(spanLengthInDays) / 3 + 0.6);
    const base = Math.floor(200 * intensityFactor * lengthFactor);
    // Future/diffuse portions get fewer particles — sparser, ghostlier
    const sparse = diffuse ? Math.floor(base * 0.5) : base;
    // Thinned again by how far off the stretch sits. Opacity alone cannot
    // make an additively-blended cluster read as faint, because overlapping
    // motes accumulate to white whatever their alpha.
    return Math.max(1, Math.floor(sparse * getProjectionDensity(dim)));
  }, [intensity, spanLengthInDays, diffuse, dim]);

  // One shape for all three layers of this stretch. A smear that crosses
  // today is drawn as two components sharing an entry id, so they also
  // share a shape and the stretch stays continuous across the boundary.
  const shapeSeed = useMemo(() => getShapeSeed(entry.id), [entry.id]);

  const backgroundCount = Math.floor(particleCount * 0.8);
  const tertiaryCount = Math.floor(particleCount * 0.5);

  const primaryParticles = useGenerateParticles({
    color, intensity, points, particleCount,
    isRoughDate: false, isMinimalDuration: false, shapeSeed, splatterScale,
  });

  const backgroundParticles = useGenerateParticles({
    color, intensity, points, particleCount: backgroundCount,
    isBackgroundLayer: true, isRoughDate: false, isMinimalDuration: false, shapeSeed, splatterScale,
  });

  const tertiaryParticles = useGenerateParticles({
    color, intensity, points, particleCount: tertiaryCount,
    isTertiaryLayer: true, isRoughDate: false, isMinimalDuration: false, shapeSeed, splatterScale,
  });

  const animationSpeed = 0.003 * (0.7 + intensity * 0.5);
  const animationAmplitude = 0.01 * (0.7 + intensity * 0.5);

  // Projections fade with distance rather than snapping to one "future"
  // value, so a stretch brightens gradually as today catches up to it.
  const opacityMult = dim;

  return (
    <group>
      <ParticleLayer
        positions={primaryParticles.positions}
        sizes={primaryParticles.sizes}
        colors={primaryParticles.colors}
        phases={primaryParticles.phases}
        opacities={primaryParticles.opacities}
        size={0.15}
        opacity={0.9 * opacityMult}
        rotationSpeed={animationSpeed}
        pulseSpeed={0.2}
        pulseAmplitude={animationAmplitude}
      />

      <ParticleLayer
        positions={backgroundParticles.positions}
        sizes={backgroundParticles.sizes}
        colors={backgroundParticles.colors}
        phases={backgroundParticles.phases}
        opacities={backgroundParticles.opacities}
        size={0.20}
        opacity={0.7 * opacityMult}
        isGlow={true}
        rotationSpeed={animationSpeed * 0.7}
        pulseSpeed={0.15}
        pulsePhase={1}
        pulseAmplitude={animationAmplitude * 1.2}
      />

      <ParticleLayer
        positions={tertiaryParticles.positions}
        sizes={tertiaryParticles.sizes}
        colors={tertiaryParticles.colors}
        phases={tertiaryParticles.phases}
        opacities={tertiaryParticles.opacities}
        size={0.18}
        opacity={0.8 * opacityMult}
        rotationSpeed={-animationSpeed * 0.4}
        pulseSpeed={0.1}
        pulsePhase={2}
        pulseAmplitude={animationAmplitude * 1.5}
      />
    </group>
  );
};
