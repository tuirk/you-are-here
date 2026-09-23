/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { Vector3 } from "three";
import { vertexShader, fragmentShader } from "./ParticleLayer";
import { useGenerateParticles } from "./ParticleGenerator";

/**
 * ParticleGenerator computes one value per particle for position, size,
 * colour, phase and opacity. Each has to be declared as an attribute here
 * and actually used, or it is uploaded to the GPU and silently ignored.
 *
 * That is not hypothetical. `opacities` was computed, returned and never
 * read by any consumer, in every commit since it was written — so every
 * mote drew at the layer's flat opacity instead of its own, roughly eight
 * times too bright. Under additive blending the cores piled up past the
 * display clamp into a white blob, and dimming a whole layer could not pull
 * them back because the overshoot simply absorbed the multiplier.
 *
 * A type error cannot catch this: the buffer is a Float32Array either way.
 */
describe("ParticleLayer shaders", () => {
  const perParticleAttributes = [
    ["position", "position"],
    ["size", "aSize"],
    ["colour", "aColor"],
    ["phase", "aPhase"],
    ["opacity", "aOpacity"],
  ] as const;

  it.each(perParticleAttributes)(
    "declares and consumes the per-particle %s",
    (_label, attribute) => {
      expect(vertexShader).toContain(attribute);

      // Declared is not enough — it has to reach a varying or an output.
      const uses = vertexShader.split(attribute).length - 1;
      expect(uses).toBeGreaterThan(1);
    }
  );

  it("folds per-particle opacity into the fragment's alpha", () => {
    expect(fragmentShader).toContain("vOpacity");
    expect(fragmentShader).toContain("uOpacity * vOpacity");
  });

  it("has an attribute for every per-particle buffer the generator emits", () => {
    const { result } = renderHook(() =>
      useGenerateParticles({
        color: "#F5A623",
        intensity: 0.5,
        points: [new Vector3(0, 0, 0)],
        particleCount: 10,
      })
    );

    const emitted = Object.keys(result.current);
    // If a new per-particle buffer is added to the generator, it needs a
    // matching attribute here or it will be computed and thrown away.
    expect(emitted.sort()).toEqual(
      ["colors", "opacities", "phases", "positions", "sizes"].sort()
    );
  });
});
