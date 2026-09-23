import { Vector3 } from "three";
import {
  getDailySpiralCoords,
  SPIRAL_BASE_RADIUS,
  SPIRAL_RADIUS_GROWTH,
  SPIRAL_HEIGHT_PER_REV,
} from "./daily/generateDailySpiralPoints";

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Where the camera looks from, as a unit vector.
 *
 * About 53 degrees above the horizontal. The spiral descends as it winds,
 * so from a low angle the record hangs below its own beginning and the
 * frame reads lopsided; from directly above it stops being a spiral at all
 * and becomes a set of rings. This is the angle where both the turning and
 * the falling are legible at once.
 */
export const CAMERA_DIRECTION = new Vector3(0.7, 1.3, 0.7).normalize();

/**
 * The least the camera will ever try to fit, in world units.
 *
 * On day one the record is a single point at the origin, and framing that
 * exactly would put the camera inside the origin portal. A floor on the
 * EXTENT is the right way to say so; a floor on the number of turns — which
 * is what this was — frames half a turn of spiral that does not exist yet,
 * and then centres on the middle of that imaginary arc, which puts the one
 * real thing on screen off to the side.
 *
 * The value is the origin portal's radius plus the dust margin: on day one
 * what there is to see is the portal and the first entry's dust around it,
 * and this is exactly enough to hold both.
 */
export const MIN_FRAMED_EXTENT = 2.8;

/** Room left for the dust, which reaches past the curve it decorates. */
export const DUST_MARGIN = 1.4;

/** A little air around the record, so it never touches the frame edge. */
export const FRAME_PADDING = 1.04;

/** How finely the curve is sampled when measuring it. */
const SAMPLES = 240;

export interface SpiralFraming {
  position: { x: number; y: number; z: number };
  /** What the camera looks at — the middle of what there is to see. */
  target: { x: number; y: number; z: number };
  distance: number;
}

interface FramingOptions {
  zoom?: number;
  fovDegrees?: number;
  aspect?: number;
}

/**
 * Frames the camera on the record rather than on the origin.
 *
 * The obvious version of this treats the spiral as a cylinder — as wide as
 * its outermost turn, as deep as its total fall — and frames that. It comes
 * out about 70% too far back, because the spiral is nothing like a
 * cylinder: it is a funnel. Its widest point is also its lowest, so the
 * radius and the depth are the same measurement seen twice and adding them
 * counts the same space twice.
 *
 * Rather than model that, this measures it. The curve is sampled, each
 * point is projected onto the axes the camera will actually see it on, and
 * the framing comes from the box those land in. That box is what the viewer
 * sees, so it is the honest thing to fit — and it stays honest through any
 * change to the spiral's shape, which the analytic version would not.
 *
 * The centre of that box is also where the camera should point, and it is
 * neither the origin nor the middle of the record's depth. The origin is
 * where the spiral BEGINS: at nine months it sits up near the top edge of
 * the picture, so orbiting around it swung everything around a point it
 * could see off the side of the frame.
 */
export const getSpiralFraming = (
  firstUseDate: Date,
  today: Date,
  { zoom = 1, fovDegrees = 50, aspect = 16 / 9 }: FramingOptions = {}
): SpiralFraming => {
  const start = new Date(firstUseDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setHours(0, 0, 0, 0);

  const days = Math.max(0, Math.floor((end.getTime() - start.getTime()) / DAY_MS));

  // The axes the camera sees the world on: right across the frame, up the
  // frame. Built from the view direction and world up, exactly as the
  // renderer will build them.
  const forward = CAMERA_DIRECTION.clone().negate();
  const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize();
  const up = new Vector3().crossVectors(right, forward).normalize();

  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;

  const point = new Vector3();
  for (let i = 0; i <= SAMPLES; i++) {
    const { x, y, z } = getDailySpiralCoords(
      (days * i) / SAMPLES,
      SPIRAL_BASE_RADIUS * zoom,
      SPIRAL_RADIUS_GROWTH * zoom,
      SPIRAL_HEIGHT_PER_REV * zoom
    );
    point.set(x, y, z);

    const u = point.dot(right);
    const v = point.dot(up);
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }

  const margin = DUST_MARGIN * zoom;
  const floor = MIN_FRAMED_EXTENT * zoom;
  const halfWidth = Math.max((maxU - minU) / 2 + margin, floor);
  const halfHeight = Math.max((maxV - minV) / 2 + margin, floor);

  const halfFov = ((fovDegrees * Math.PI) / 180) / 2;
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 16 / 9;

  const distance =
    (Math.max(halfHeight, halfWidth / safeAspect) / Math.tan(halfFov)) * FRAME_PADDING;

  // The world point that lands in the middle of the frame. It sits in the
  // plane through the origin facing the camera, which is as good a choice
  // as any — every point along that ray frames identically.
  const target = right
    .clone()
    .multiplyScalar((minU + maxU) / 2)
    .addScaledVector(up, (minV + maxV) / 2);

  const position = target.clone().addScaledVector(CAMERA_DIRECTION, distance);

  return {
    position: { x: position.x, y: position.y, z: position.z },
    target: { x: target.x, y: target.y, z: target.z },
    distance,
  };
};

