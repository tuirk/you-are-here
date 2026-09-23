import React, { useState, useCallback, useRef } from "react";
import { Text } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { getDailySpiralCoords,
  SPIRAL_BASE_RADIUS,
  SPIRAL_RADIUS_GROWTH,
  SPIRAL_HEIGHT_PER_REV,
} from "@/utils/daily/generateDailySpiralPoints";

export interface HoverInfo {
  date: Date;
  screenX: number;
  screenY: number;
}

interface TildePlacementProps {
  firstUseDate: Date;
  today: Date;
  zoom: number;
  onPlaced: (date: Date) => void;
  onHover: (info: HoverInfo | null) => void;
}

export const TildePlacement: React.FC<TildePlacementProps> = ({
  firstUseDate,
  today,
  zoom,
  onPlaced,
  onHover,
}) => {
  const [tildePos, setTildePos] = useState<THREE.Vector3 | null>(null);
  const [tildeDate, setTildeDate] = useState<Date | null>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalDays = React.useMemo(() => {
    const start = new Date(firstUseDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setHours(0, 0, 0, 0);
    return Math.max(1, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  }, [firstUseDate, today]);

  const tubeGeometry = React.useMemo(() => {
    const curvePoints: THREE.Vector3[] = [];
    const steps = Math.max(10, totalDays * 2);
    for (let i = 0; i <= steps; i++) {
      const dayIndex = (i / steps) * totalDays;
      const { x, y, z } = getDailySpiralCoords(dayIndex, SPIRAL_BASE_RADIUS * zoom, SPIRAL_RADIUS_GROWTH * zoom, SPIRAL_HEIGHT_PER_REV * zoom);
      curvePoints.push(new THREE.Vector3(x, y, z));
    }
    const curve = new THREE.CatmullRomCurve3(curvePoints);
    return new THREE.TubeGeometry(curve, steps, 0.6, 8, false);
  }, [totalDays, zoom]);

  // Find nearest date from a 3D point
  const findNearestDate = useCallback((point: THREE.Vector3): Date => {
    const start = new Date(firstUseDate);
    start.setHours(0, 0, 0, 0);
    let bestDist = Infinity;
    let bestDay = 0;
    // Sample every 2 days for speed on hover, every day on click
    const step = 1;
    for (let d = 0; d <= totalDays; d += step) {
      const { x, y, z } = getDailySpiralCoords(d, SPIRAL_BASE_RADIUS * zoom, SPIRAL_RADIUS_GROWTH * zoom, SPIRAL_HEIGHT_PER_REV * zoom);
      const dist = point.distanceTo(new THREE.Vector3(x, y, z));
      if (dist < bestDist) {
        bestDist = dist;
        bestDay = d;
      }
    }
    const date = new Date(start);
    date.setDate(date.getDate() + bestDay);
    return date;
  }, [firstUseDate, totalDays, zoom]);

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    if (!e.point) return;
    e.stopPropagation();
    const date = findNearestDate(e.point);
    const { x, y, z } = getDailySpiralCoords(
      Math.floor((date.getTime() - new Date(firstUseDate).getTime()) / (1000 * 60 * 60 * 24)),
      SPIRAL_BASE_RADIUS * zoom, SPIRAL_RADIUS_GROWTH * zoom, SPIRAL_HEIGHT_PER_REV * zoom
    );
    setTildePos(new THREE.Vector3(x, y, z));
    setTildeDate(date);
    onPlaced(date);
  }, [findNearestDate, firstUseDate, zoom, onPlaced]);

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!e.point) return;
    // Debounce hover
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => {
      const date = findNearestDate(e.point);
      // Get screen position from the pointer event
      const screenX = e.clientX ?? e.nativeEvent?.clientX ?? 0;
      const screenY = e.clientY ?? e.nativeEvent?.clientY ?? 0;
      onHover({ date, screenX, screenY });
    }, 150);
  }, [findNearestDate, onHover]);

  const handlePointerLeave = useCallback(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    onHover(null);
  }, [onHover]);

  const formatDate = (d: Date) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `~ ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  };

  React.useEffect(() => {
    if (!tildePos) return;
    const timer = setTimeout(() => {
      setTildePos(null);
      setTildeDate(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [tildePos]);

  return (
    <>
      <mesh
        geometry={tubeGeometry}
        onClick={handleClick}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>

      {tildePos && tildeDate && (
        <group position={tildePos}>
          <Text
            position={[0, 0.25, 0]}
            color="#FFD080"
            fontSize={0.4}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.04}
            outlineColor="#000000"
          >
            ~
          </Text>
          <Text
            position={[0, 0.08, 0]}
            color="#aaaaaa"
            fontSize={0.12}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#000000"
          >
            {formatDate(tildeDate)}
          </Text>
        </group>
      )}
    </>
  );
};
