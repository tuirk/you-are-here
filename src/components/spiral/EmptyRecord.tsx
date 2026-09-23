import React from "react";
import { CosmicBackdrop } from "./CosmicBackdrop";

interface EmptyRecordProps {
  /** Opens the composer on today. */
  onBegin: () => void;
}

/**
 * What a spiral with nothing on it looks like.
 *
 * There used to be no such thing. Clearing every entry put the demo record
 * straight back, because an empty store was read as a first visit — so the
 * one state a journal most needs to be able to reach, its own beginning,
 * was the one state it could not get to.
 *
 * It is deliberately not an empty spiral. A curve with no entries on it is
 * a claim about time that has not been written about yet, and drawing nine
 * months of blank scaffolding is a worse answer than drawing nothing: the
 * spiral is the record, so with no record there is no spiral — just the sky
 * it sits in, and somewhere to start.
 */
export const EmptyRecord: React.FC<EmptyRecordProps> = ({ onBegin }) => {
  return (
    <div className="relative h-screen w-full overflow-hidden">
      <div className="absolute inset-0">
        <CosmicBackdrop />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 text-center">
        <h2 className="text-2xl font-extralight tracking-[0.2em] text-white/[0.92] mb-3 [text-shadow:0_2px_24px_rgba(0,0,0,0.6)]">
          Nothing here yet
        </h2>
        <p className="text-sm font-extralight tracking-[0.1em] text-white/60 mb-12 max-w-sm leading-relaxed">
          Your spiral starts on the day you first write. Everything after it
          winds outward from there.
        </p>

        <button
          onClick={onBegin}
          className="text-white/85 hover:text-white bg-[rgba(12,12,20,0.7)] hover:bg-[rgba(20,20,32,0.9)] border border-white/[0.12] backdrop-blur-md text-sm tracking-[0.2em] font-extralight px-6 py-2 rounded-lg transition-all duration-300"
        >
          make your first entry
        </button>
      </div>
    </div>
  );
};
