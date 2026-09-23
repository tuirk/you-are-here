import { Vector3 } from "three";
import {
  getDailySpiralCoords,
  SPIRAL_BASE_RADIUS,
  SPIRAL_RADIUS_GROWTH,
  SPIRAL_HEIGHT_PER_REV,
} from "./generateDailySpiralPoints";

/**
 * Generates points for visualizing durations on the daily spiral.
 */
export const calculateDailySegment = (
  startDate: Date,
  endDate: Date,
  firstUseDate: Date,
  segmentPoints: number = 100,
  baseRadius: number = SPIRAL_BASE_RADIUS,
  radiusGrowth: number = SPIRAL_RADIUS_GROWTH,
  heightPerRev: number = SPIRAL_HEIGHT_PER_REV
): Vector3[] => {
  const start = new Date(firstUseDate);
  start.setHours(0, 0, 0, 0);

  const sd = new Date(startDate);
  sd.setHours(0, 0, 0, 0);
  const ed = new Date(endDate);
  ed.setHours(0, 0, 0, 0);

  const startDayIndex = Math.max(0, (sd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const endDayIndex = Math.max(startDayIndex, (ed.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  const actualPoints = Math.min(500, segmentPoints);
  const points: Vector3[] = [];

  for (let i = 0; i <= actualPoints; i++) {
    const progress = i / actualPoints;
    const dayIndex = startDayIndex + progress * (endDayIndex - startDayIndex);
    const { x, y, z } = getDailySpiralCoords(dayIndex, baseRadius, radiusGrowth, heightPerRev);
    points.push(new Vector3(x, y, z));
  }

  return points;
};
