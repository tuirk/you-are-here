import React, { useRef, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { JournalEntry, SpiralConfig } from "@/types/event";
import { MonthMarkers } from "./MonthMarkers";
import { EntryVisualizations } from "./EventVisualizations";
import { TodayMarker } from "./TodayMarker";
import { TildePlacement } from "./TildePlacement";
import { NebulaBackdrop } from "./NebulaBackdrop";
import { Starfield } from "./Starfield";
import { getAuraColor } from "@/utils/auraColor";
import { getSpiralFraming } from "@/utils/spiralFraming";
import {
  SPIRAL_BASE_RADIUS,
  SPIRAL_RADIUS_GROWTH,
  SPIRAL_HEIGHT_PER_REV,
} from "@/utils/daily/generateDailySpiralPoints";

interface SpiralSceneProps {
  entries: JournalEntry[];
  config: SpiralConfig;
  onTildePlaced: (date: Date) => void;
  onHover: (info: import("./TildePlacement").HoverInfo | null) => void;
  onTodayClick?: () => void;
}

const startOfToday = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const SpiralScene: React.FC<SpiralSceneProps> = ({
  entries,
  config,
  onTildePlaced,
  onHover,
  onTodayClick,
}) => {
  const { camera, size } = useThree();
  const controlsRef = useRef<React.ElementRef<typeof OrbitControls>>(null);

  const firstUseDate = useMemo(() => new Date(config.firstUseDate), [config.firstUseDate]);


  // "Today" follows the clock: checked every frame (one Date read) and
  // replaced only when the day actually changes. A tab left open across
  // midnight moves the figure, and every entry re-decides what is past and
  // what is still to come, the moment the date turns over rather than up to
  // a minute later — and not just in the parts of the scene that happened to
  // be listening.
  const [today, setToday] = useState(startOfToday);
  const todayTime = useRef(today.getTime());
  useFrame(() => {
    const now = startOfToday().getTime();
    if (now !== todayTime.current) {
      todayTime.current = now;
      setToday(new Date(now));
    }
  });

  // The present-moment figure glows with the mood of the entries around it
  // rather than a fixed amber, so it belongs to the picture it stands in.
  const auraColor = useMemo(() => getAuraColor(entries, today), [entries, today]);

  /**
   * Where to stand to see the whole record. See utils/spiralFraming — the
   * short of it is that the middle of the spiral is not the origin, it is
   * half the record's depth below it, and it sinks further every month.
   *
   * Recomputed as the record and the viewport change, but only APPLIED to
   * the camera on mount and on zoom: the aspect ratio is one of its inputs,
   * and resizing the window should not yank the view back out of wherever
   * the reader had orbited to.
   */
  const framing = useMemo(
    () =>
      getSpiralFraming(firstUseDate, today, {
        zoom: config.zoom,
        fovDegrees: (camera as THREE.PerspectiveCamera).fov ?? 50,
        aspect: size.width / Math.max(1, size.height),
      }),
    [firstUseDate, today, config.zoom, camera, size.width, size.height]
  );

  const framingRef = useRef(framing);
  framingRef.current = framing;

  useEffect(() => {
    if (!camera) return;
    const { position } = framingRef.current;
    // No lookAt here — OrbitControls owns the target below.
    camera.position.set(position.x, position.y, position.z);
  }, [config.zoom, camera]);

  return (
    <>
      <OrbitControls
        ref={controlsRef}
        // The middle of the record, not the origin. The spiral starts at
        // the origin and falls away from it, so orbiting around 0,0,0 swung
        // the whole picture around a point sitting off its top edge.
        target={[framing.target.x, framing.target.y, framing.target.z]}
        enablePan={true}
        enableZoom={true}
        minDistance={3}
        // Sized off the framing rather than fixed, so a long record can
        // still be pulled back far enough to see all of.
        maxDistance={framing.distance * 2.5}
        // A barely-perceptible drift so an untouched spiral still feels alive.
        // Roughly one revolution per 20 minutes — slow enough not to pull
        // the eye while you are reading an entry.
        // Damping makes manual orbiting glide instead of snapping.
        autoRotate
        autoRotateSpeed={0.045}
        enableDamping
        dampingFactor={0.06}
      />

      <color attach="background" args={["#010206"]} />
      <NebulaBackdrop />
      <Starfield />

      <ambientLight intensity={0.2} />
      <directionalLight position={[10, 10, 5]} intensity={0.4} />

      <MonthMarkers
        firstUseDate={firstUseDate}
        today={today}
        zoom={config.zoom}
      />


      <TodayMarker
        firstUseDate={firstUseDate}
        today={today}
        baseRadius={SPIRAL_BASE_RADIUS * config.zoom}
        radiusGrowth={SPIRAL_RADIUS_GROWTH * config.zoom}
        heightPerRev={SPIRAL_HEIGHT_PER_REV * config.zoom}
        onClick={onTodayClick}
        auraColor={auraColor}
      />

      <TildePlacement
        firstUseDate={firstUseDate}
        today={today}
        zoom={config.zoom}
        onPlaced={onTildePlaced}
        onHover={onHover}
      />

      <EntryVisualizations
        entries={entries}
        config={config}
        today={today}
      />
    </>
  );
};
