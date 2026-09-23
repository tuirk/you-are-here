import React, { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { generateStarfield, type StarfieldOptions } from "@/utils/starfield";

/**
 * The night sky behind the spiral.
 *
 * This replaces a uniform scatter of identical white dots. The colour and
 * brightness distributions come from `generateStarfield`; what happens here
 * is the rendering — per-star size that survives to the GPU, and a twinkle
 * built from two detuned frequencies so the field never settles into a
 * visible collective pulse.
 *
 * Deliberately not fogged. The scene's fog ends at 50 units and these sit
 * between 70 and 140, so including the fog chunks would resolve every star
 * to the fog colour and leave a black sky.
 */

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aPhase;
  attribute float aRate;

  uniform float uTime;
  uniform float uAttenuationScale;

  varying vec3 vColor;

  void main() {
    float phase = aPhase * 6.2831853;

    // Two offset frequencies rather than one. A single sine gives the whole
    // field a shared heartbeat once you watch it for a few seconds; detuning
    // a second one against it keeps the scintillation from ever repeating.
    float twinkle = 0.78
      + 0.14 * sin(uTime * aRate + phase)
      + 0.08 * sin(uTime * aRate * 2.37 + phase * 1.7);

    vColor = aColor * twinkle;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (uAttenuationScale / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uOpacity;

  varying vec3 vColor;

  void main() {
    vec4 texel = texture2D(uMap, gl_PointCoord);
    if (texel.a < 0.01) discard;
    gl_FragColor = vec4(vColor, uOpacity) * texel;
  }
`;

/**
 * A tighter sprite than the dust motes use. Stars want a crisp core with a
 * short halo — the soft, noisy dust texture turns them into fuzzy blobs at
 * the sizes they render at.
 */
const useStarTexture = () =>
  useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;

    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.Texture();

    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.12, "rgba(255,255,255,0.85)");
    gradient.addColorStop(0.35, "rgba(255,255,255,0.25)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);

interface StarfieldProps extends StarfieldOptions {
  opacity?: number;
  /** Very slow drift, so the sky is not locked rigidly to the scene. */
  rotationSpeed?: number;
}

export const Starfield: React.FC<StarfieldProps> = ({
  opacity = 1,
  rotationSpeed = 0.0016,
  ...options
}) => {
  const pointsRef = useRef<THREE.Points>(null);
  const starTexture = useStarTexture();

  const viewportHeight = useThree((state) => state.size.height);
  const dpr = useThree((state) => state.viewport.dpr);

  const stars = useMemo(
    () => generateStarfield(options),
    // Regenerating on every render would rebuild the buffers each frame;
    // the field is fixed for the life of the scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const uniforms = useMemo(
    () => ({
      uMap: { value: null as THREE.Texture | null },
      uOpacity: { value: 1 },
      uAttenuationScale: { value: 1 },
      uTime: { value: 0 },
    }),
    []
  );

  useFrame((state, delta) => {
    uniforms.uMap.value = starTexture;
    uniforms.uOpacity.value = opacity;
    uniforms.uAttenuationScale.value = (viewportHeight * dpr) / 2;
    uniforms.uTime.value = state.clock.getElapsedTime();

    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * rotationSpeed;
    }
  });

  return (
    <points ref={pointsRef} raycast={() => null} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={stars.positions.length / 3}
          array={stars.positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aColor"
          count={stars.colors.length / 3}
          array={stars.colors}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aSize"
          count={stars.sizes.length}
          array={stars.sizes}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aPhase"
          count={stars.phases.length}
          array={stars.phases}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aRate"
          count={stars.rates.length}
          array={stars.rates}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        fog={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};
