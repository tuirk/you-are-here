import React from "react";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { generateDailySpiralPoints } from "@/utils/daily/generateDailySpiralPoints";

interface SpiralLineProps {
  firstUseDate: Date;
  today: Date;
  zoom: number;
}

export const SpiralLine: React.FC<SpiralLineProps> = ({
  firstUseDate,
  today,
  zoom,
}) => {
  const spiralPoints = generateDailySpiralPoints(
    firstUseDate,
    today,
    4,           // stepsPerDay
    2 * zoom,    // baseRadius
    0.8 * zoom,  // radiusGrowth
    1.2 * zoom   // heightPerRev
  );

  const positions = spiralPoints.map((p) => p.position);
  const totalPoints = spiralPoints.length;

  // Gradient: cold and faint at the beginning, warming toward today.
  // The curve is eased rather than linear so the recent weeks read as
  // "now" without the older months disappearing entirely.
  const colors = spiralPoints.map((_, i) => {
    const t = totalPoints > 1 ? i / (totalPoints - 1) : 1;
    const eased = t * t;
    const dimColor = new THREE.Color(0x2a3a5c);
    const brightColor = new THREE.Color(0xcfe4ff);
    return dimColor.clone().lerp(brightColor, eased);
  });

  if (positions.length < 2) return null;

  return (
    <group>
      {/* Wide, faint pass. Bloom picks this up and turns the thread into a
          soft trail of light rather than a hairline. */}
      <Line
        points={positions}
        color="white"
        vertexColors={colors}
        lineWidth={5}
        transparent
        opacity={0.1}
        depthWrite={false}
      />
      {/* Crisp core pass that keeps the path legible against the clusters. */}
      <Line
        points={positions}
        color="white"
        vertexColors={colors}
        lineWidth={1.4}
        transparent
        opacity={0.55}
        depthWrite={false}
      />
    </group>
  );
};
