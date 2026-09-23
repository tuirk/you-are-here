
import { useMemo } from "react";
import * as THREE from "three";
import { Vector3 } from "three";
import { getColorVariation } from "./DustParticle";

/**
 * Shape of the particle size distribution. SIZE_SKEW > 1 pushes most motes
 * toward SIZE_MIN_FACTOR while leaving a long tail up to SIZE_MAX_FACTOR.
 */
/**
 * A cheap bell curve: three summed uniforms, shifted and scaled to give
 * mean 0 and a standard deviation of 0.35.
 *
 * Dust does not fill a box evenly. Sampling each axis from a flat range
 * puts as many motes at the outer edge of a cluster as along its centre,
 * which is what made clusters read as rectangular slabs of points with
 * hard boundaries. A bell puts a dense spine along the curve and thins
 * outward, so the cluster has a core and an atmosphere.
 *
 * Unlike a true Gaussian this is bounded at +/-1.05, so widening a cluster
 * can never fling a stray mote far away from it.
 */
const bell = () => (Math.random() + Math.random() + Math.random() - 1.5) * 0.7;

/**
 * How much of the cluster is drawn flat rather than from the bell.
 *
 * Brightness and blown-out cores are otherwise the same dial: every scalar
 * — count, alpha, sprite size — lifts the spine and the body together, so
 * raising it to make the body visible clamps the core first. The one thing
 * that separates them is the SHAPE of the profile.
 *
 * A pure bell puts about 68% of its motes inside one sigma, which is why
 * the body reads as dim while the middle is already at the clamp. Drawing
 * a share of the offsets from a flat range instead moves light outward
 * from a spine that had none to spare into the band around it, without
 * raising the peak. Raise this for more body, lower it for more contrast.
 *
 * Bounded to the bell's 2-sigma reach so the mixture never widens the
 * cluster, only redistributes it.
 */
const FLAT_SHARE = 0.35;

/**
 * The same mixture, but flatter, used for the two axes ACROSS the curve.
 *
 * Along the curve a spine is what you want: the entry belongs to a day, and
 * the dust should be densest on it. Across the curve there is no such
 * meaning — nothing is truer at the centre of the band than at its edge, and
 * a bell there just builds a bright filament down the middle of the ribbon
 * and leaves the girth around it looking like haze.
 *
 * Filling the cross-section instead gives the band an actual body, and it
 * lowers the peak while doing it: the same motes spread over the width
 * rather than piling onto the centre line.
 *
 * It cannot go much past this. At 0.6 the band carried nearly uniform
 * density right out to its own edge, and since both turns of the spiral
 * throw dust into the gap between them, the gap filled in from both sides
 * and the whole record read as one fuzzy disc — the turns were still there,
 * with nothing dark left between them to see them by. A softer edge costs
 * nothing at the centre and gives the gap back.
 */
const ACROSS_FLAT_SHARE = 0.45;

const flat = () => (Math.random() - 0.5) * 1.4;

const offset = () => (Math.random() < FLAT_SHARE ? flat() : bell());

const acrossOffset = () => (Math.random() < ACROSS_FLAT_SHARE ? flat() : bell());

/**
 * A stable 0-1 number from an entry's id.
 *
 * Every layer of one cluster has to agree about what shape that cluster is,
 * or the core and its halo end up differently squashed and the entry reads
 * as two overlapping things. Drawing from Math.random per layer cannot do
 * that; hashing the id can, and it also survives a remount, so a cluster
 * does not reshuffle itself every time React rebuilds it.
 */
export const getShapeSeed = (id: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1_000_003) / 1_000_003;
};

/** mulberry32 — a small deterministic PRNG, so one seed gives many draws. */
const makeRng = (seed: number) => {
  let state = Math.floor(seed * 4294967296) || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * How violently a cluster is allowed to scatter, given how loud its day was.
 *
 * This is what the splatter MEANS. A quiet Tuesday should sit as a small
 * contained knot; a day that knocked the wind out of you should be thrown
 * wide and land unevenly. Without this the irregularity is just noise laid
 * over the record — pretty, and saying nothing — and the dial the picture
 * already has for how much a day carried goes unused.
 *
 * Everything below scales by it: how far this cluster's girth may stray
 * from the average, how hard it may be squashed, and how deeply it knots
 * along its own length. So intensity sets the SPREAD, not just the size,
 * and a page of quiet days reads as an even thread with loud ones bursting
 * off it.
 *
 * The floor is not zero, because a perfectly smooth cluster looks machined.
 */
const SPLATTER_FLOOR = 0.3;
const SPLATTER_RANGE = 1.0;

/**
 * How far a cluster's girth may stray from the average, at full splatter.
 *
 * Until this existed every entry was drawn at exactly the same width, which
 * is what made the record read as an extruded tube rather than as dust:
 * widening it only ever produced a fatter tube, because uniformity, not
 * size, was what looked wrong.
 *
 * It is centred on 1 so the AVERAGE cluster is as wide as it was before any
 * of this — the spread does the work, and the band gets its fatness from
 * its bulges rather than from every part of it growing.
 */
const CLUSTER_GIRTH_SWING = 0.4;

/** However much scatter is asked for, a cluster stays a cluster. */
const CLUSTER_GIRTH_FLOOR = 0.25;
const CLUSTER_GIRTH_CEILING = 2.2;

/**
 * How far a cluster may be squashed along one of its two across-axes.
 *
 * A circular cross-section is the other half of looking extruded. One axis
 * is stretched by this and the other squeezed by its reciprocal, so the
 * cluster becomes a blade or a fan without gaining or losing bulk, and a
 * per-cluster roll turns that shape to a random angle — otherwise every
 * blade in the record would lie the same way up.
 */
const CLUSTER_ASPECT = 1.4;

/**
 * How hard the band bulges and pinches along its own length, and how often.
 *
 * Constant width along the curve is what reads as extrusion even after the
 * clusters differ from each other, because a long stretch of feeling is one
 * cluster and would otherwise be a perfectly even pipe. This knots it.
 *
 * The motes are NOT redistributed to match, so a pinch would be denser and
 * therefore brighter — bright stripes at regular intervals, which is worse
 * than the even pipe. Their opacity is scaled by the same factor to cancel
 * it exactly: projected density goes as 1/width, so alpha goes as width.
 */
const KNOT_DEPTH = 0.35;
/** Below 1, or the pinch passes through zero and the band turns inside out. */
const KNOT_DEPTH_MAX = 0.8;
const KNOT_MIN_CYCLES = 1.5;
const KNOT_MAX_CYCLES = 5;

const SIZE_SKEW = 3;
const SIZE_MIN_FACTOR = 0.35;
const SIZE_MAX_FACTOR = 2.6;

interface GenerateParticlesProps {
  color: string;
  intensity: number; // 0-1
  points: Vector3[];
  particleCount: number;
  isBackgroundLayer?: boolean;
  isTertiaryLayer?: boolean;
  isRoughDate?: boolean;
  isMinimalDuration?: boolean;
  /**
   * 0-1, stable per entry — see getShapeSeed. Decides this cluster's girth,
   * how it is squashed and how it knots, so no two entries are the same
   * shape and every layer of one entry agrees about which shape it is.
   */
  shapeSeed?: number;
  /**
   * Multiplies how far this cluster is allowed to scatter, on top of what
   * its intensity already asks for. 1 for an ordinary day; the first day of
   * the record is drawn at twice this, so the beginning is marked by the
   * record itself rather than by an ornament placed at the centre.
   */
  splatterScale?: number;
}

interface BandLayer {
  isBackgroundLayer?: boolean;
  isTertiaryLayer?: boolean;
  isRoughDate?: boolean;
}

/**
 * How far the band of dust reaches, per layer, in the curve's own frame.
 *
 * `along` and `across` answer two unrelated questions, and the whole reason
 * the band used to be either too tight or blown out is that one number was
 * answering both.
 *
 * ALONG is measured against the arc a single day occupies — 0.29 world
 * units. It decides whether an entry stays its own mark or bleeds into the
 * days either side of it, and under additive blending bleeding means
 * summing: two entries in the same week put their cores on the same pixels
 * and clamp to white. At 0.42 the bell's two-sigma reach is ~0.35, close to
 * one day, so a Tuesday and a Thursday sit beside each other.
 *
 * ACROSS is measured against the gap between turns — 3.88 units — and is
 * free to be several times larger, because the dust it throws sideways
 * lands where no other day is. This is the girth: it is what makes the
 * record read as a rope of dust rather than a wire. It is more than twice
 * what the old single number allowed, and the spiral was opened up to pay
 * for it — the two numbers are spent against each other, so neither can be
 * read without the other.
 *
 * Widening ACROSS also lowers the peak, since the motes spread over more
 * screen area, so the two complaints — too tight, and too white — have the
 * same answer. What it cannot do is exceed half the turn gap; past that the
 * ribbon touches its own next turn and the spiral reads as a disc. See
 * SPIRAL_RADIUS_GROWTH.
 */
export interface BandSpread {
  /** Reach along the curve. Sized against a day's arc. */
  along: number;
  /** Reach across it — the girth. Sized against the gap between turns. */
  across: number;
}

export const getBandSpread = ({
  isBackgroundLayer,
  isTertiaryLayer,
  isRoughDate,
}: BandLayer): BandSpread => {
  const along = isBackgroundLayer ? 0.62 : isTertiaryLayer ? 0.50 : 0.42;
  const across = isBackgroundLayer ? 1.47 : isTertiaryLayer ? 1.28 : 1.10;

  // A rough date is a claim about a week rather than a day, so it reaches
  // further ALONG the curve. Its girth is unchanged: the uncertainty is
  // about when the thing happened, not about how far off the curve it sits.
  return isRoughDate ? { along: along * 2.2, across } : { along, across };
};

/**
 * What the caller's count is trimmed by, for the current geometry.
 *
 * This was briefly derived from the band's volume, (spread/reference)^2.1,
 * on the reasoning that a wider band needs proportionally more dust to hold
 * its density. That is true of volumetric density and false of what a
 * screen shows. Under additive blending brightness follows *projected*
 * density: a ball of dust needs count proportional to width squared, but a
 * tube along a curve only needs it proportional to width. The formula also
 * knew nothing about the arc a day occupies, which shrank by 2.6x at the
 * same time. Together that put roughly five times more dust on the curve
 * than the geometry could carry, and every core clamped to white.
 *
 * A constant is the honest form: the counts the callers pass are already
 * tuned per entry type, and this adjusts them for the geometry they land on.
 *
 * It sat at 0.75 while the band was an isotropic ball ~0.55 across. Taking
 * the offsets in the curve's frame widened the cross-section and narrowed
 * the reach along the curve, spreading the same motes over more screen
 * area — enough that the band went wispy — so it is raised to compensate.
 *
 * It tracks the girth, and has to. A tube's projected area grows roughly
 * linearly with how far it reaches across the curve, so widening the band
 * without adding dust does not make a fatter rope, it makes a fainter one
 * of the same apparent width. Moving the two together by the same factor
 * leaves density — and therefore peak brightness — exactly where it was,
 * which is why widening the band is not a brightness change.
 *
 * It is also the one place where brightness and frame rate are the same
 * number, so it is the first thing to look at if a long record drags.
 */
export const BAND_DENSITY_SCALE = 1.0;

export const getBandDensityScale = (_layer: BandLayer): number => BAND_DENSITY_SCALE;

export const useGenerateParticles = ({
  color,
  intensity,
  points,
  particleCount,
  isBackgroundLayer = false,
  isTertiaryLayer = false,
  isRoughDate = false,
  isMinimalDuration = false,
  shapeSeed = 0.5,
  splatterScale = 1
}: GenerateParticlesProps) => {
  return useMemo(() => {
    const pathLength = points.length;

    // Scale 0-1 intensity to old 1-10 range for calculations
    const scaledIntensity = intensity * 10;

    const layer = { isBackgroundLayer, isTertiaryLayer, isRoughDate };
    const spreadFactor = getBandSpread(layer);

    // Density follows the volume the band has to fill. See
    // getBandDensityScale — without this, widening the tube thins it.
    const count =
      particleCount <= 0
        ? 0
        : Math.max(1, Math.round(particleCount * getBandDensityScale(layer)));

    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const opacities = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    // Per-particle phase, so twinkle and drift are independent per mote
    // rather than the whole layer moving as one rigid shell.
    const phases = new Float32Array(count);

    const baseSizeFactor = 0.9 + scaledIntensity * 0.15;
    const baseColor = new THREE.Color(color);

    const baseSize = isBackgroundLayer
      ? 0.45 * baseSizeFactor
      : isTertiaryLayer
        ? 0.40 * baseSizeFactor
        : 0.35 * baseSizeFactor;

    const sizeVariation = isBackgroundLayer ? 0.3 : isTertiaryLayer ? 0.25 : 0.2;

    const baseOpacity = isRoughDate
      ? isBackgroundLayer ? 0.06 : isTertiaryLayer ? 0.07 : 0.08
      : isBackgroundLayer ? 0.06 : isTertiaryLayer ? 0.09 : 0.12;

    const intensityOpacityBoost = (isBackgroundLayer ? 0.04 : isTertiaryLayer ? 0.05 : 0.08) * (scaledIntensity / 10);
    const intensitySpreadScale = 0.8 + scaledIntensity * (isBackgroundLayer ? 0.05 : 0.04);

    // This cluster's own shape, drawn once from its seed. Everything here
    // is what stops the record reading as one extruded tube.
    const shape = makeRng(shapeSeed);

    // How loud this day was, as how far it is allowed to scatter — times
    // whatever the caller asks for on top.
    const splatter =
      (SPLATTER_FLOOR + SPLATTER_RANGE * Math.min(Math.max(intensity, 0), 1)) *
      Math.max(splatterScale, 0);

    // Clamped, because every one of these is a multiplier and a caller may
    // ask for more scatter than the shape can survive: an unclamped girth
    // reaches zero and leaves the cluster a needle, and an unclamped knot
    // passes 1 and turns the band inside out at its pinch.
    const clusterGirth = Math.min(
      Math.max(1 + (shape() * 2 - 1) * CLUSTER_GIRTH_SWING * splatter, CLUSTER_GIRTH_FLOOR),
      CLUSTER_GIRTH_CEILING
    );
    // One across-axis stretched, the other squeezed by the reciprocal, so
    // the cluster is squashed without changing how much of it there is.
    const aspect = Math.pow(CLUSTER_ASPECT, (shape() * 2 - 1) * splatter);
    // ...then turned to its own angle, or every cluster lies the same way.
    const roll = shape() * Math.PI * 2;
    const rollCos = Math.cos(roll);
    const rollSin = Math.sin(roll);
    const knotCycles = KNOT_MIN_CYCLES + shape() * (KNOT_MAX_CYCLES - KNOT_MIN_CYCLES);
    const knotPhase = shape() * Math.PI * 2;
    const knotDepth = Math.min(KNOT_DEPTH * splatter, KNOT_DEPTH_MAX);

    /**
     * A denser cluster is not a brighter one.
     *
     * A cluster that rolled narrow packs the same motes into less screen
     * area, so it would come out brighter purely by chance — which reads as
     * the record making a claim it is not making. Cancelling it completely
     * would be wrong too: a tight knot of dust IS brighter than a loose
     * puff, and flattening that removes the very variety this is for.
     *
     * Surface brightness goes as alpha/width, so an exponent of 1 holds it
     * flat and 0 leaves it fully to chance. At 0.5 the narrowest clusters
     * came out about 37% hot and the white blew back out of exactly the
     * loud entries the splatter had just widened the range for. At 0.85
     * that is down to ~10% — still visibly denser, no longer clamping.
     */
    const girthCompensation = Math.pow(clusterGirth, 0.85);

    // Reused across the whole loop rather than allocated per mote: a busy
    // record generates a few hundred thousand of these.
    const tangent = new THREE.Vector3();
    const across1 = new THREE.Vector3();
    const across2 = new THREE.Vector3();

    /**
     * Builds an orthonormal frame at a point on the path: the direction the
     * curve is heading, and the two perpendicular to it.
     *
     * The tangent comes from the neighbours rather than the point itself,
     * so it stays right at the ends of a segment. Where the curve gives
     * nothing to work with — a one-day entry whose path collapses to a
     * single point — it falls back to a fixed frame, because the
     * alternative is a zero-length cross product and a buffer full of NaN,
     * which THREE drops silently along with the entire cluster.
     */
    const alongAxis = (index: number) => {
      const previous = points[Math.max(0, index - 1)];
      const next = points[Math.min(pathLength - 1, index + 1)];

      tangent.subVectors(next, previous);
      if (tangent.lengthSq() < 1e-12) tangent.set(1, 0, 0);
      tangent.normalize();

      // World up, so the two across-axes line up with how the spiral is
      // actually read: one sideways across the ribbon, one up through it.
      across1.set(-tangent.z, 0, tangent.x);
      // Degenerate only where the curve runs straight up or down, which
      // this spiral never does — but a vertical tangent would otherwise
      // zero this out.
      if (across1.lengthSq() < 1e-12) across1.set(1, 0, 0);
      across1.normalize();

      across2.crossVectors(tangent, across1);
      if (across2.lengthSq() < 1e-12) across2.set(0, 1, 0);
      across2.normalize();
    };

    for (let i = 0; i < count; i++) {
      let pathIndex: number;

      if (isMinimalDuration) {
        pathIndex = Math.floor(Math.random() * Math.min(30, pathLength - 1));
      } else {
        const rand = Math.random();
        if (rand < 0.1) {
          pathIndex = Math.floor(Math.random() * Math.min(30, pathLength * 0.2));
        } else if (rand > 0.9) {
          pathIndex = Math.floor(Math.max(pathLength * 0.8, pathLength - 30) + Math.random() * Math.min(30, pathLength * 0.2));
        } else {
          pathIndex = Math.floor(Math.random() * (pathLength - 1));
        }
      }

      const point = points[pathIndex];

      // The offsets are taken in the curve's own frame, not in world axes.
      //
      // Scattering a cluster along x, y and z makes a ball, and a ball has
      // exactly one width. Any width wide enough to give the ribbon girth
      // also reached several days along the curve, so entries inside a week
      // landed on each other and summed to white — which is why the band
      // was stuck at a size that was simultaneously too tight to look like
      // anything and too wide to stay clean. Split into a tangent and the
      // two directions perpendicular to it, the two stop competing.
      alongAxis(pathIndex);

      // Where along the band this mote sits, and therefore how fat the band
      // is here. A long stretch of feeling is one cluster, and without this
      // it is a pipe of perfectly even bore.
      const along01 = pathLength > 1 ? pathIndex / (pathLength - 1) : 0;
      const knot =
        1 + knotDepth * Math.sin(along01 * knotCycles * Math.PI * 2 + knotPhase);

      const girth = spreadFactor.across * intensitySpreadScale * clusterGirth * knot;

      // Reach along the curve is deliberately NOT varied. It is measured in
      // days, and a cluster that wandered there would start claiming time
      // it does not have.
      const along = offset() * spreadFactor.along * intensitySpreadScale;

      const spreadU = acrossOffset() * girth * aspect;
      const spreadV = (acrossOffset() * girth) / aspect;
      const acrossU = spreadU * rollCos - spreadV * rollSin;
      const acrossV = spreadU * rollSin + spreadV * rollCos;

      const i3 = i * 3;
      positions[i3] = point.x + tangent.x * along + across1.x * acrossU + across2.x * acrossV;
      positions[i3 + 1] = point.y + tangent.y * along + across1.y * acrossU + across2.y * acrossV;
      positions[i3 + 2] = point.z + tangent.z * along + across1.z * acrossU + across2.z * acrossV;

      // Real dust spans orders of magnitude: a haze of specks with the
      // occasional bright mote. The old jitter kept every particle within
      // about 10% of the same size, which is the strongest tell that a
      // cluster was generated rather than observed. Raising a uniform
      // random to a power skews the distribution hard toward small while
      // still producing rare large ones. The mean is close to the previous
      // value, and ParticleLayer normalises by it anyway, so the overall
      // scale of a cluster is unchanged - only its internal variety.
      const shaped = Math.pow(Math.random(), SIZE_SKEW);
      sizes[i] = baseSize * (SIZE_MIN_FACTOR + shaped * (SIZE_MAX_FACTOR - SIZE_MIN_FACTOR)) *
                 (1 - sizeVariation / 2 + Math.random() * sizeVariation);
      phases[i] = Math.random();

      const pathProgress = pathIndex / pathLength;
      const progressFactor = 4 * (pathProgress * (1 - pathProgress));
      // `knot` cancels the brightness the bulging would otherwise create:
      // projected density goes as 1/width, so alpha goes as width, and the
      // band changes thickness at even surface brightness instead of
      // striping itself bright and dark.
      opacities[i] = (baseOpacity + intensityOpacityBoost) *
                   (0.7 + progressFactor * 0.3) *
                   (0.8 + Math.random() * 0.4) *
                   knot * girthCompensation;

      const variedColor = getColorVariation(baseColor, isBackgroundLayer ? 0.1 : 0.05);
      colors[i3] = variedColor.r;
      colors[i3 + 1] = variedColor.g;
      colors[i3 + 2] = variedColor.b;
    }

    return { positions, sizes, opacities, colors, phases };
  }, [color, intensity, points, particleCount, isBackgroundLayer, isTertiaryLayer, isRoughDate, isMinimalDuration, shapeSeed, splatterScale]);
};
