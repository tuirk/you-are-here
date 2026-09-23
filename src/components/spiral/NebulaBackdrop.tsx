import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Soft volumetric clouds behind the spiral.
 *
 * Without these the scene is a bright object on flat black, which reads as a
 * diagram. A few very faint additive planes at different depths give the
 * starfield something to sit in, and because they drift at different rates
 * they parallax gently against each other as the camera orbits.
 *
 * Everything here is deliberately dim — these should register as atmosphere,
 * never as shapes you can point at.
 */

const makeCloudTexture = (inner: string, outer: string) => {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;

  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Texture();

  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.45, outer);
  gradient.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
};

type Cloud = {
  position: [number, number, number];
  scale: number;
  opacity: number;
  spin: number;
  inner: string;
  outer: string;
};

const CLOUDS: Cloud[] = [
  {
    position: [-14, 2, -22],
    scale: 42,
    opacity: 0.34,
    spin: 0.004,
    inner: "rgba(64,96,190,0.55)",
    outer: "rgba(28,40,96,0.2)",
  },
  {
    position: [16, -6, -26],
    scale: 50,
    opacity: 0.3,
    spin: -0.003,
    inner: "rgba(128,72,190,0.5)",
    outer: "rgba(48,24,88,0.18)",
  },
  {
    position: [2, 10, -30],
    scale: 56,
    opacity: 0.24,
    spin: 0.0022,
    inner: "rgba(40,140,150,0.45)",
    outer: "rgba(16,52,64,0.16)",
  },
  {
    position: [-8, -12, -18],
    scale: 34,
    opacity: 0.26,
    spin: -0.0045,
    inner: "rgba(150,70,120,0.4)",
    outer: "rgba(58,22,50,0.14)",
  },
];

const CloudPlane: React.FC<Cloud> = ({ position, scale, opacity, spin, inner, outer }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => makeCloudTexture(inner, outer), [inner, outer]);

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.z += delta * spin;
  });

  return (
    <mesh ref={meshRef} position={position} scale={scale} raycast={() => null}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        depthTest={false}
        side={THREE.DoubleSide}
        toneMapped={false}
        // The scene fog fades to black from 15 units out; these clouds sit
        // at 18-30, so leaving fog on erases them completely.
        fog={false}
      />
    </mesh>
  );
};

export const NebulaBackdrop: React.FC = () => (
  <group renderOrder={-1}>
    {CLOUDS.map((cloud, i) => (
      <CloudPlane key={i} {...cloud} />
    ))}
  </group>
);
