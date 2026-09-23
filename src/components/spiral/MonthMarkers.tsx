import React, { useMemo } from "react";
import { Text, Billboard } from "@react-three/drei";
import { getDailySpiralCoords,
  SPIRAL_BASE_RADIUS,
  SPIRAL_RADIUS_GROWTH,
  SPIRAL_HEIGHT_PER_REV,
} from "@/utils/daily/generateDailySpiralPoints";

interface MonthMarkersProps {
  firstUseDate: Date;
  today: Date;
  zoom: number;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Renders month labels at the start of each monthly revolution on the daily spiral.
 */
export const MonthMarkers: React.FC<MonthMarkersProps> = ({
  firstUseDate,
  today,
  zoom,
}) => {
  const markers = useMemo(() => {
    const result: { key: string; position: [number, number, number]; label: string }[] = [];

    const start = new Date(firstUseDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setHours(0, 0, 0, 0);

    // Find the first day of each month between firstUseDate and today
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    // If firstUseDate is not the 1st, the first label is the next month
    if (cursor.getTime() < start.getTime()) {
      cursor.setMonth(cursor.getMonth() + 1);
    }

    while (cursor.getTime() <= end.getTime()) {
      const dayIndex = Math.max(0, Math.floor((cursor.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      const { x, y, z } = getDailySpiralCoords(
        dayIndex,
        SPIRAL_BASE_RADIUS * zoom,
        SPIRAL_RADIUS_GROWTH * zoom,
        SPIRAL_HEIGHT_PER_REV * zoom
      );

      const monthName = MONTH_NAMES[cursor.getMonth()];
      const year = cursor.getFullYear();
      // Show year on Jan or on the very first label
      const showYear = cursor.getMonth() === 0 || result.length === 0;
      const label = showYear ? `${monthName} ${year}` : monthName;

      // Nudge the label radially outward so it floats just clear of the
      // path instead of sitting on top of the particle clusters.
      const radius = Math.hypot(x, z);
      const push = radius > 0 ? (radius + 0.85 * zoom) / radius : 1;

      result.push({
        key: `${year}-${cursor.getMonth()}`,
        position: [x * push, y, z * push],
        label,
      });

      cursor.setMonth(cursor.getMonth() + 1);
    }

    return result;
  }, [firstUseDate, today, zoom]);

  return (
    <>
      {markers.map((m) => (
        // Billboarded: as a flat mesh the label went edge-on as the camera
        // orbited, which is most of why it read as clutter rather than type.
        <Billboard key={m.key} position={m.position}>
          <Text
            // Cool off-white at partial opacity, so the labels sit behind
            // the clusters in the visual hierarchy instead of competing
            // with them. Wide tracking echoes the landing page's type.
            color="#C4D4F0"
            fontSize={0.23}
            letterSpacing={0.24}
            anchorX="center"
            anchorY="middle"
            fillOpacity={0.6}
            // A hairline of near-black keeps the type legible where it
            // crosses a bright smear, without the cartoon stroke.
            outlineWidth={0.007}
            outlineColor="#00030a"
            outlineOpacity={0.5}
          >
            {m.label.toUpperCase()}
          </Text>
        </Billboard>
      ))}
    </>
  );
};
