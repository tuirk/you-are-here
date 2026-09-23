import React, { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { NebulaBackdrop } from "./NebulaBackdrop";
import { Starfield } from "./Starfield";
import { CATEGORY_COLORS } from "@/utils/colorMapping";

/**
 * The spiral's sky, for the screens that come before it.
 *
 * The welcome and empty-record screens used drei's stock <Stars>: thousands
 * of identical white dots on flat black, with no nebula and no bloom. Next to
 * the record itself they looked like a different, older app. This draws the
 * same starfield, clouds and post-processing the spiral does, so walking from
 * the welcome screen into the record reads as one place.
 */

const DUST_COUNT = 7000;
/** Share of motes gathered into knots, the way entries gather on the record. */
const KNOT_SHARE = 0.45;
const KNOT_COUNT = 18;
const DUST_TURNS = 2;
const DUST_RADIUS_MIN = 5.2;
const DUST_RADIUS_MAX = 12.5;
const DUST_DROP_PER_TURN = 0.9;

const useMoteTexture = () =>
  useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.Texture();
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.3, "rgba(255,255,255,0.5)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(canvas);
  }, []);

/**
 * A faint spiral of dust in the sentiment palette — a hint of the record
 * rather than a record. Colour drifts in slow bands along the curve, the way
 * a lived year does, instead of being scattered per mote.
 */
const DustSpiral: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const texture = useMoteTexture();

  const geometry = useMemo(() => {
    const palette = Object.values(CATEGORY_COLORS).map((hex) => new THREE.Color(hex));
    const positions = new Float32Array(DUST_COUNT * 3);
    const colors = new Float32Array(DUST_COUNT * 3);
    const color = new THREE.Color();

    const knots = Array.from({ length: KNOT_COUNT }, () => ({
      t: 0.05 + Math.random() * 0.93,
      color: palette[Math.floor(Math.random() * palette.length)],
    }));
    const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

    for (let i = 0; i < DUST_COUNT; i++) {
      const knot = Math.random() < KNOT_SHARE ? knots[i % KNOT_COUNT] : null;
      const t = knot ? Math.min(1, Math.max(0, knot.t + gauss() * 0.018)) : Math.random();
      const angle = t * DUST_TURNS * Math.PI * 2;
      const radius = DUST_RADIUS_MIN + (DUST_RADIUS_MAX - DUST_RADIUS_MIN) * t;
      // Scatter grows with the radius, so the outer turns read as loose dust
      // and the centre stays a clear thread. Knots stay tight.
      const spread = knot ? 0.55 : 0.35 + radius * 0.09;
      positions[i * 3] = Math.cos(angle) * radius + gauss() * spread;
      positions[i * 3 + 1] = -t * DUST_TURNS * DUST_DROP_PER_TURN + gauss() * spread * 0.6;
      positions[i * 3 + 2] = Math.sin(angle) * radius + gauss() * spread;

      if (knot) {
        color.copy(knot.color).multiplyScalar(0.8 + Math.random() * 0.4);
      } else {
        const band = t * palette.length * 1.7;
        const a = palette[Math.floor(band) % palette.length];
        const b = palette[(Math.floor(band) + 1) % palette.length];
        color.copy(a).lerp(b, band % 1).multiplyScalar(0.35 + Math.random() * 0.35);
      }
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, []);

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.035;
  });

  return (
    <group ref={groupRef} position={[0, 2.2, 0]}>
      <points geometry={geometry} raycast={() => null}>
        <pointsMaterial
          map={texture}
          size={0.2}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
    </group>
  );
};

interface CosmicBackdropProps {
  /** Draw the faint dust spiral behind whatever sits on top. */
  dust?: boolean;
}

export const CosmicBackdrop: React.FC<CosmicBackdropProps> = ({ dust = false }) => (
  <Canvas
    camera={{ position: [0, 9, 22], fov: 50, near: 0.1, far: 1000 }}
    gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    linear
    dpr={[1, 2]}
    onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
  >
    <color attach="background" args={["#010206"]} />
    <NebulaBackdrop />
    <Starfield />
    {dust && <DustSpiral />}
    <EffectComposer multisampling={0}>
      <Bloom intensity={1.2} luminanceThreshold={0.12} luminanceSmoothing={0.65} radius={0.72} mipmapBlur />
      <Vignette offset={0.28} darkness={0.62} eskil={false} />
    </EffectComposer>
  </Canvas>
);
