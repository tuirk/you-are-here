import React, { useRef, useMemo } from "react";
import { useFrame, useLoader, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { SVGLoader } from "three-stdlib";
import { getDailySpiralCoords,
  SPIRAL_BASE_RADIUS,
  SPIRAL_RADIUS_GROWTH,
  SPIRAL_HEIGHT_PER_REV,
} from "@/utils/daily/generateDailySpiralPoints";
import { DEFAULT_AURA } from "@/utils/auraColor";

interface TodayMarkerProps {
  firstUseDate: Date;
  today: Date;
  baseRadius?: number;
  radiusGrowth?: number;
  heightPerRev?: number;
  onClick?: () => void;
  /** Blended colour of the entries around today — see utils/auraColor. */
  auraColor?: string;
}

const FIGURE_SIZE = 1.6; // world units, longest dimension

/**
 * Matches ParticleLayer's uDrift exactly, so the figure is displaced by the
 * same distance as the dust immediately around it rather than by an amount
 * scaled to its own size.
 */
const FIGURE_DRIFT = 0.05;

/** Offset so he does not wander in lockstep with any particular mote. */
const FIGURE_DRIFT_PHASE = 2.3;

export const TodayMarker: React.FC<TodayMarkerProps> = ({
  firstUseDate,
  today,
  baseRadius = SPIRAL_BASE_RADIUS,
  radiusGrowth = SPIRAL_RADIUS_GROWTH,
  heightPerRev = SPIRAL_HEIGHT_PER_REV,
  onClick,
  auraColor = DEFAULT_AURA,
}) => {
  const billboardRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Mesh>(null);

  // Soft radial falloff the figure sits inside, so the silhouette dissolves
  // into light at its edges instead of ending on a hard outline.
  const haloTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;

    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.Texture();

    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,255,255,0.8)");
    gradient.addColorStop(0.3, "rgba(255,255,255,0.26)");
    gradient.addColorStop(0.65, "rgba(255,255,255,0.07)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);

  const position = useMemo(() => {
    const start = new Date(firstUseDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setHours(0, 0, 0, 0);
    const dayIndex = Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const { x, y, z } = getDailySpiralCoords(dayIndex, baseRadius, radiusGrowth, heightPerRev);
    return new THREE.Vector3(x, y, z);
  }, [firstUseDate, today, baseRadius, radiusGrowth, heightPerRev]);

  const svgData = useLoader(SVGLoader, "/floating-person.svg");

  const extrudeSettings = useMemo(() => ({
    depth: 40,
    bevelEnabled: true,
    bevelThickness: 8,
    bevelSize: 5,
    bevelSegments: 3,
  }), []);

  // Build geometries once and compute the actual bounding box of the path
  // content (NOT the SVG viewBox), so we can recenter the figure precisely
  // on today's spiral coordinate regardless of where the artwork sits inside
  // its 600x600 viewBox.
  const { geometries, centerOffset, scale } = useMemo(() => {
    const geos: THREE.ExtrudeGeometry[] = [];
    const merged = new THREE.Box3();
    let first = true;

    svgData.paths.forEach((path) => {
      const pathShapes = SVGLoader.createShapes(path);
      pathShapes.forEach((shape) => {
        const g = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        g.computeBoundingBox();
        if (g.boundingBox) {
          if (first) {
            merged.copy(g.boundingBox);
            first = false;
          } else {
            merged.union(g.boundingBox);
          }
        }
        geos.push(g);
      });
    });

    if (first) {
      // No paths — fall back to safe defaults
      return {
        geometries: geos,
        centerOffset: new THREE.Vector3(0, 0, 0),
        scale: 0.003,
      };
    }

    const size = new THREE.Vector3();
    merged.getSize(size);
    const longest = Math.max(size.x, size.y, 1);
    const s = FIGURE_SIZE / longest;

    const center = new THREE.Vector3();
    merged.getCenter(center);

    return {
      geometries: geos,
      centerOffset: center,
      scale: s,
    };
  }, [svgData, extrudeSettings]);

  // Make the figure always face the camera so the silhouette reads cleanly
  // from any orbit angle — no more "edge-on disappearing" man.
  useFrame((state) => {
    if (billboardRef.current) {
      billboardRef.current.quaternion.copy(state.camera.quaternion);
    }
    if (innerRef.current) {
      const t = state.clock.getElapsedTime();

      // The same construction the dust uses in ParticleLayer's vertex
      // shader: three sinusoids at near-identical slow frequencies, which
      // beat against each other and never quite repeat.
      //
      // He was previously bobbing on a single sine at 0.6 — roughly three
      // times the speed of everything around him, on one axis, perfectly
      // periodic. That made him the one object in the scene with a period
      // the eye could lock onto, so he read as sitting in the dust rather
      // than being carried by it. Same frequencies, same amplitude, and he
      // belongs to the medium.
      innerRef.current.position.x = Math.sin(t * 0.21 + FIGURE_DRIFT_PHASE) * FIGURE_DRIFT;
      innerRef.current.position.y = Math.cos(t * 0.17 + FIGURE_DRIFT_PHASE) * FIGURE_DRIFT;
      innerRef.current.position.z = Math.sin(t * 0.19 + FIGURE_DRIFT_PHASE) * FIGURE_DRIFT;
      innerRef.current.rotation.z = Math.sin(t * 0.19 + FIGURE_DRIFT_PHASE) * 0.05;
    }
    if (haloRef.current) {
      // Slower and out of phase with the figure's drift, so the glow feels
      // like breath around it rather than a shape stuck to it.
      const t = state.clock.getElapsedTime();
      const breath = 1 + Math.sin(t * 0.13 + 1.1) * 0.07;
      haloRef.current.scale.set(breath, breath, 1);
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!onClick) return;
    e.stopPropagation?.();
    onClick();
  };

  return (
    <group position={position}>
      <group ref={billboardRef}>
        {/* Behind the figure, breathing slightly out of step with it. */}
        <mesh ref={haloRef} position={[0, 0, -0.08]} raycast={() => null}>
          <planeGeometry args={[FIGURE_SIZE * 2.7, FIGURE_SIZE * 2.7]} />
          <meshBasicMaterial
            map={haloTexture}
            color={auraColor}
            transparent
            opacity={0.55}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
            fog={false}
          />
        </mesh>

        <group ref={innerRef}>
          {/* y is flipped because SVG y-down → world y-up.
              The translation undoes the SVG's internal offset so the
              figure's true centroid sits at (0,0,0) — i.e. exactly on
              today's spiral coordinate. */}
          <group
            scale={[scale, -scale, scale]}
            position={[
              -centerOffset.x * scale,
              centerOffset.y * scale,
              -centerOffset.z * scale,
            ]}
          >
            {geometries.map((geo, i) => (
              <mesh key={i} geometry={geo} renderOrder={10}>
                <meshBasicMaterial
                  // Additive and semi-transparent, so the figure reads as
                  // a presence made of light rather than a solid cut-out:
                  // stars and clusters behind it show through, and
                  // overlapping limbs brighten instead of flattening.
                  //
                  // This only works while the dust behind him stays below
                  // the display clamp — adding light to a saturated core
                  // changes nothing, which is why he vanished when the
                  // clusters were over-bright. That was the clusters' bug,
                  // not his.
                  //
                  // renderOrder still puts him after them: none of them
                  // write depth, so without it he could be painted over by
                  // whichever transparent object sorted later.
                  color={auraColor}
                  transparent
                  opacity={0.42}
                  blending={THREE.AdditiveBlending}
                  side={THREE.DoubleSide}
                  depthWrite={false}
                  toneMapped={false}
                />
              </mesh>
            ))}
          </group>
        </group>
        <pointLight color={auraColor} intensity={0.7} distance={3.4} decay={2} />

        {/* Invisible click target — sized to comfortably cover the figure
            silhouette so the whole man is clickable, not just the path. */}
        {onClick && (
          <mesh
            onClick={handleClick}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              document.body.style.cursor = "default";
            }}
          >
            <planeGeometry args={[FIGURE_SIZE, FIGURE_SIZE]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        )}
      </group>

    </group>
  );
};
