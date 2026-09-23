import React from "react";
import { Button } from "@/components/ui/button";
import { ListIcon } from "lucide-react";

interface SpiralControlsProps {
  onViewEntriesClick: () => void;
}

export const SpiralControls: React.FC<SpiralControlsProps> = ({
  onViewEntriesClick,
}) => {
  return (
    <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
      <Button
        variant="ghost"
        className="text-white/85 hover:text-white bg-[rgba(12,12,20,0.7)] hover:bg-[rgba(20,20,32,0.9)] border border-white/[0.12] backdrop-blur-md text-xs px-3 py-1.5 h-auto rounded-lg"
        onClick={onViewEntriesClick}
      >
        <ListIcon className="mr-1.5 h-3.5 w-3.5" />
        Entries
      </Button>
    </div>
  );
};
