import React from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info } from "lucide-react";
import { SENTIMENT_LEGEND } from "@/utils/colorMapping";

export const SpiralHelp: React.FC = () => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="absolute bottom-4 right-4 rounded-full bg-[rgba(12,12,20,0.85)] backdrop-blur-md hover:bg-[rgba(20,20,32,0.94)] border border-white/[0.12] text-white/80 hover:text-white"
        >
          <Info className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 !bg-[rgba(12,12,20,0.94)] backdrop-blur-xl text-white/[0.92] border-white/[0.08] shadow-2xl shadow-black/70 max-h-[80vh] overflow-y-auto"
      >
        <div className="space-y-5">
          <div className="space-y-3">
            <h3 className="font-medium text-lg text-white/[0.92] tracking-wide">About "You're Here"</h3>
            <p className="text-sm text-white/80 leading-relaxed">
              Your record begins at the light in the middle and winds outward,
              a day at a time. The first loop holds a month; every loop after
              it holds more than the one inside, so the further back you look,
              the closer together the months sit.
            </p>
            <ul className="text-sm text-white/80 space-y-2 list-disc pl-5 marker:text-white/50">
              <li>Click anywhere on the spiral to journal that day.</li>
              <li>The floating figure is today. Click it for today's entries.</li>
              <li>A moment lands as a knot of dust; something that lasted is
                  drawn as a stretch of it.</li>
              <li>Anything you've written about a day still to come is drawn
                  faint, and fills in as it arrives.</li>
              <li>Hover a stretch to see roughly when it is and what's on it.</li>
              <li>Drag to rotate, scroll to zoom.</li>
            </ul>
          </div>

          <div className="space-y-2 pt-3 border-t border-white/[0.08]">
            <h4 className="text-[11px] uppercase tracking-[0.18em] text-white/55">
              What the colors mean
            </h4>
            <ul className="space-y-1.5">
              {SENTIMENT_LEGEND.map(({ key, label, color }) => (
                <li key={key} className="flex items-center gap-2.5">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: color,
                      boxShadow: `0 0 8px ${color}80`,
                    }}
                  />
                  <span className="text-xs text-white/80 leading-none">{label}</span>
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-white/50 pt-1 leading-relaxed">
              Mixed feelings blend their colors, and the figure takes its glow
              from whatever is around today. A loud day burns brighter than a
              quiet one — though a week you wrote in every day holds itself
              back a little, so it stays colour instead of going white.
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
