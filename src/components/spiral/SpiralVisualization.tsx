import React from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { JournalEntry, SpiralConfig } from "@/types/event";
import { SpiralScene } from "./SpiralScene";
import { SPIRAL_RADIUS_GROWTH } from "@/utils/daily/generateDailySpiralPoints";
import { HoverInfo } from "./TildePlacement";

interface SpiralVisualizationProps {
  entries: JournalEntry[];
  config: SpiralConfig;
  onTildePlaced: (date: Date) => void;
  onHover: (info: HoverInfo | null) => void;
  onTodayClick?: () => void;
}

const SpiralVisualization: React.FC<SpiralVisualizationProps> = ({
  entries,
  config,
  onTildePlaced,
  onHover,
  onTodayClick,
}) => {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{
          position: [15, 15, 15],
          fov: 50,
          near: 0.1,
          far: 1000,
        }}
        gl={{
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
          failIfMajorPerformanceCaveat: false,
        }}
        linear
        dpr={[1, 2]}
        onCreated={({ gl }) => {
          const canvas = gl.domElement;
          canvas.addEventListener("webglcontextlost", (event) => {
            event.preventDefault();
          }, false);
          canvas.addEventListener("webglcontextrestored", () => {}, false);
        }}
      >
        {/* Depth cue for the additive clusters, in the same units as the
            spiral — so it scales with SPIRAL_RADIUS_GROWTH rather than
            swallowing the outer turns whenever the record is opened up. */}
        <fog
          attach="fog"
          args={["#000", SPIRAL_RADIUS_GROWTH * 4.6, SPIRAL_RADIUS_GROWTH * 15.4]}
        />
        <SpiralScene
          entries={entries}
          config={config}
          onTildePlaced={onTildePlaced}
          onHover={onHover}
          onTodayClick={onTodayClick}
        />

        {/* Additive particles read as flat dots without bloom. The low
            luminance threshold is deliberate: the clusters are dim by
            design, so a conventional threshold would leave them untouched
            and only blow out the today-marker. */}
        {/* No multisampling. It was the single most expensive thing in the
            frame — turning it off took a nine-month record from 14fps to
            43fps on integrated graphics — and it was buying almost nothing:
            the scene is additive point sprites whose edges are already soft
            alpha from their texture, and bloom blurs whatever is left.
            MSAA only ever firmed up the today-figure's silhouette, and the
            bloom around it hides that too. */}
        <EffectComposer multisampling={0}>
          <Bloom
            intensity={1.35}
            luminanceThreshold={0.12}
            luminanceSmoothing={0.65}
            radius={0.72}
            mipmapBlur
          />
          <Vignette offset={0.28} darkness={0.62} eskil={false} />
        </EffectComposer>
      </Canvas>
    </div>
  );
};

export default SpiralVisualization;
