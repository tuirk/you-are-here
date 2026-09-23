import React, { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useDustParticleTexture } from "./DustParticle";

interface ParticleLayerProps {
  positions: Float32Array;
  sizes: Float32Array;
  colors: Float32Array;
  phases: Float32Array;
  opacities: Float32Array;
  size: number;
  opacity: number;
  isGlow?: boolean;
  rotationSpeed?: number;
  pulseSpeed?: number;
  pulsePhase?: number;
  pulseAmplitude?: number;
}

/**
 * THREE.PointsMaterial takes `size` as a uniform and has no per-vertex size
 * attribute, so the varied sizes ParticleGenerator computes were being
 * uploaded and then ignored — every particle in a layer drew at exactly the
 * same size. This shader reads that attribute, which is what gives a cluster
 * its grain instead of a wall of identical dots.
 *
 * The same was true of opacity, and worse. ParticleGenerator computes a
 * per-particle alpha in the 0.06-0.2 range, returned it, and nothing ever
 * read it — every mote drew at the layer's flat 0.7-0.95 instead, roughly
 * eight times its designed value. Under additive blending that made a
 * cluster core accumulate several times past the display clamp, so it
 * showed as a solid white blob and no amount of dimming the layer could
 * pull it back. aOpacity finally applies it.
 *
 * gl_PointSize mirrors THREE's own attenuation maths (scale / -mvPosition.z,
 * where scale is half the drawing-buffer height) so sizes stay consistent
 * with the rest of the scene across zoom and DPR.
 */
/**
 * Overall brightness of a mote, and the single dial for how alive the
 * clusters look.
 *
 * The per-particle opacities ParticleGenerator emits (0.06-0.2) carry the
 * variation that gives a cluster grain, but their absolute level was tuned
 * against particle counts roughly six times smaller than today's. Applied
 * raw they made the whole spiral read as dead: below Bloom's 0.12 luminance
 * threshold nothing glows at all, and the glow was doing most of the work.
 *
 * So the array is normalised to a mean of 1 and used purely as variation —
 * the same split ParticleLayer already applies to sizes through sizeScale —
 * and this constant sets the level.
 *
 * It sits at 1 because a single mote has to clear Bloom's luminance
 * threshold on its own. At 0.4 a mote's peak was 0.24, giving it a bloom
 * mask of 0.00 — sparse regions stopped glowing at all, which is what made
 * the body of the spiral read as dead. At 1 the peak is ~0.58 and the mask
 * ~0.16, so isolated dust sparkles the way it used to.
 *
 * Lowering it does not fix over-bright cores: those come from too many
 * motes overlapping, which is a density and spread problem, not a
 * brightness one. Trying to solve it here only kills the sparkle.
 */
const PARTICLE_ALPHA = 1.0;

export const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aPhase;
  attribute float aOpacity;

  uniform float uSizeScale;
  uniform float uAttenuationScale;
  uniform float uTime;
  uniform float uDrift;

  varying vec3 vColor;
  varying float vOpacity;

  #include <fog_pars_vertex>

  void main() {
    float phase = aPhase * 6.2831853;

    // Each mote wanders on its own, instead of the layer turning as one
    // rigid shell. Three offset sinusoids keyed to the particle's own
    // position and phase give cheap, non-repeating turbulence without a
    // noise texture or a per-frame CPU pass over the buffer.
    vec3 drift = vec3(
      sin(uTime * 0.21 + position.y * 1.7 + phase),
      cos(uTime * 0.17 + position.z * 1.9 + phase),
      sin(uTime * 0.19 + position.x * 1.5 + phase)
    ) * uDrift;

    // Scintillation: slow, per-particle brightness wander. Dust catching
    // light unevenly is what stops a cluster reading as a static texture.
    float twinkle = 0.74 + 0.26 * sin(uTime * (0.5 + aPhase * 1.7) + phase);
    vColor = aColor * twinkle;
    vOpacity = aOpacity;

    vec4 mvPosition = modelViewMatrix * vec4(position + drift, 1.0);
    gl_PointSize = aSize * uSizeScale * (uAttenuationScale / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;

    #include <fog_vertex>
  }
`;

export const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uOpacity;

  varying vec3 vColor;
  varying float vOpacity;

  #include <fog_pars_fragment>

  void main() {
    vec4 texel = texture2D(uMap, gl_PointCoord);
    if (texel.a < 0.01) discard;
    gl_FragColor = vec4(vColor, uOpacity * vOpacity) * texel;

    // Under additive blending, fogging toward the black fog colour fades
    // distant clusters out rather than tinting them — the depth cue that
    // PointsMaterial used to provide for free.
    #include <fog_fragment>
  }
`;

export const ParticleLayer: React.FC<ParticleLayerProps> = ({
  positions,
  sizes,
  colors,
  phases,
  opacities,
  size,
  opacity,
  isGlow = false,
  rotationSpeed = 0.003,
  pulseSpeed = 0.2,
  pulsePhase = 0,
  pulseAmplitude = 0.01,
}) => {
  const particleRef = useRef<THREE.Points>(null);
  const particleTexture = useDustParticleTexture({ isGlow });

  const viewportHeight = useThree((state) => state.size.height);
  const dpr = useThree((state) => state.viewport.dpr);

  // Normalise the per-particle sizes around the layer's mean so `size` keeps
  // meaning what it did before — the average particle — while the spread
  // around it now actually renders.
  /**
   * The geometry arrives in absolute spiral coordinates. Rotating or
   * scaling an object whose vertices sit at absolute positions acts about
   * the WORLD origin, not the cluster — so a cluster anchored to a date was
   * slowly orbiting the spiral's axis and walking off its own day. Because
   * the rotation accumulated with `+=` and never reset, it passed a full
   * radian after ten minutes and a half-turn after thirty, leaving the
   * today marker and the month labels behind.
   *
   * Carrying the centroid on the object's transform and centring the
   * vertices around it makes rotation and scale act about the cluster
   * itself, which is what they were always meant to do.
   */
  const { centeredPositions, centroid } = useMemo(() => {
    const count = positions.length / 3;
    if (count === 0) {
      return { centeredPositions: positions, centroid: new THREE.Vector3() };
    }

    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let i = 0; i < count; i++) {
      cx += positions[i * 3];
      cy += positions[i * 3 + 1];
      cz += positions[i * 3 + 2];
    }
    cx /= count;
    cy /= count;
    cz /= count;

    const out = new Float32Array(positions.length);
    for (let i = 0; i < count; i++) {
      out[i * 3] = positions[i * 3] - cx;
      out[i * 3 + 1] = positions[i * 3 + 1] - cy;
      out[i * 3 + 2] = positions[i * 3 + 2] - cz;
    }

    return { centeredPositions: out, centroid: new THREE.Vector3(cx, cy, cz) };
  }, [positions]);

  const sizeScale = useMemo(() => {
    if (sizes.length === 0) return size;
    let total = 0;
    for (let i = 0; i < sizes.length; i++) total += sizes[i];
    const mean = total / sizes.length;
    return mean > 0 ? size / mean : size;
  }, [sizes, size]);

  // Normalise per-particle alpha to a mean of 1 so `opacity` keeps meaning
  // "the average mote" while the spread around it still renders.
  const opacityScale = useMemo(() => {
    if (opacities.length === 0) return 1;
    let total = 0;
    for (let i = 0; i < opacities.length; i++) total += opacities[i];
    const mean = total / opacities.length;
    return mean > 0 ? 1 / mean : 1;
  }, [opacities]);

  const uniforms = useMemo(
    () =>
      THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uMap: { value: null },
          uOpacity: { value: 1 },
          uSizeScale: { value: 1 },
          uAttenuationScale: { value: 1 },
          uTime: { value: 0 },
          uDrift: { value: 0.05 },
        },
      ]),
    // Built once per layer and never rebuilt — swapping the uniforms object
    // would drop the GPU buffers. Live values are synced in useFrame below.
    []
  );

  useFrame((state) => {
    // Keep uniforms in step with prop and viewport changes without
    // rebuilding the material (which would drop the GPU buffers).
    uniforms.uMap.value = particleTexture;
    uniforms.uOpacity.value = opacity * opacityScale * PARTICLE_ALPHA;
    uniforms.uSizeScale.value = sizeScale;
    uniforms.uAttenuationScale.value = (viewportHeight * dpr) / 2;
    uniforms.uTime.value = state.clock.getElapsedTime();

    if (particleRef.current) {
      const time = state.clock.getElapsedTime();

      // Oscillating, not accumulating. An entry belongs to a day, so every
      // motion it makes has to come back; `+=` guaranteed it never would.
      // Sign and relative speed still come from rotationSpeed, so the
      // layers keep turning against each other.
      particleRef.current.rotation.y = Math.sin(time * 0.05 + pulsePhase) * rotationSpeed * 20;

      const pulse = Math.sin(time * pulseSpeed + pulsePhase) * pulseAmplitude;
      particleRef.current.scale.set(1 + pulse, 1 + pulse, 1 + pulse);

      // Gentle sway about the cluster's own anchor, so it always returns.
      particleRef.current.position.set(
        centroid.x + Math.sin(time * 0.3) * 0.03,
        centroid.y + Math.cos(time * 0.25) * 0.03,
        centroid.z + Math.sin(time * 0.35) * 0.03
      );
    }
  });

  return (
    <points ref={particleRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={centeredPositions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aSize"
          count={sizes.length}
          array={sizes}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aColor"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aOpacity"
          count={opacities.length}
          array={opacities}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aPhase"
          count={phases.length}
          array={phases}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        fog
      />
    </points>
  );
};
