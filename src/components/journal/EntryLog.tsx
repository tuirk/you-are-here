import React, { useState } from "react";
import { JournalEntry } from "@/types/event";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface EntryLogProps {
  entries: JournalEntry[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteEntry: (id: string) => void;
  onDeleteMultiple: (ids: string[]) => void;
  onEntryClick?: (entry: JournalEntry) => void;
  title?: string;
  emptyAction?: { label: string; onClick: () => void };
}

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const EntryLog: React.FC<EntryLogProps> = ({
  entries,
  open,
  onOpenChange,
  onDeleteMultiple,
  onEntryClick,
  title = "Entries",
  emptyAction,
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const sorted = [...entries].sort(
    (a, b) => new Date(b.anchorDate).getTime() - new Date(a.anchorDate).getTime()
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === entries.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(entries.map((e) => e.id)));
    }
  };

  const handleDelete = () => {
    onDeleteMultiple(Array.from(selected));
    setSelected(new Set());
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) setSelected(new Set());
    onOpenChange(o);
  };

  const allSelected = entries.length > 0 && selected.size === entries.length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="!bg-[rgba(12,12,20,0.94)] backdrop-blur-xl text-white border-white/[0.08] max-w-2xl rounded-2xl shadow-2xl shadow-black/70">
        <DialogHeader>
          <DialogTitle className="text-xl font-extralight tracking-[0.15em] text-white/[0.92]">
            {title}
          </DialogTitle>
          <DialogDescription className="text-white/70 text-xs">
            {entries.length === 0
              ? "nothing here yet"
              : title === "Entries"
              ? `${entries.length} on your spiral`
              : `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
          </DialogDescription>
        </DialogHeader>

        {/* Select all + delete bar */}
        {entries.length > 0 && (
          <div className="flex items-center justify-between py-2 border-b border-white/[0.08]">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div
                onClick={toggleAll}
                className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                  allSelected
                    ? "border-white/60 bg-white/25"
                    : "border-white/40 hover:border-white/60"
                }`}
              >
                {allSelected && <div className="w-1.5 h-1.5 rounded-sm bg-white/90" />}
              </div>
              <span className="text-[11px] text-white/70 group-hover:text-white/90">
                {allSelected ? "Deselect all" : "Select all"}
              </span>
            </label>
            {selected.size > 0 && (
              <Button
                onClick={handleDelete}
                variant="ghost"
                size="sm"
                className="text-red-400/70 hover:text-red-400 hover:bg-red-400/10 text-xs h-7 px-3"
              >
                <Trash2 className="mr-1.5 h-3 w-3" />
                Delete {selected.size}
              </Button>
            )}
          </div>
        )}

        <div className="max-h-[55vh] overflow-y-auto space-y-1.5 py-1 -mx-1 px-1">
          {sorted.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <p className="text-white/60 text-sm">
                {emptyAction ? "Nothing journaled yet." : "No entries yet. Click the spiral to add one."}
              </p>
              {emptyAction && (
                <Button
                  onClick={emptyAction.onClick}
                  className="bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-lg px-6"
                >
                  {emptyAction.label}
                </Button>
              )}
            </div>
          ) : (
            sorted.map((entry) => {
              const isSelected = selected.has(entry.id);
              return (
                <div
                  key={entry.id}
                  className={`flex items-start gap-3 p-3 rounded-xl transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-red-400/[0.1] border border-red-400/25"
                      : "bg-white/[0.05] border border-white/[0.06] hover:bg-white/[0.09]"
                  }`}
                  onClick={() => onEntryClick?.(entry)}
                >
                  {/* Checkbox */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(entry.id);
                    }}
                    className={`w-3.5 h-3.5 rounded border flex-shrink-0 mt-1 flex items-center justify-center transition-colors cursor-pointer ${
                      isSelected
                        ? "border-red-400/70 bg-red-400/30"
                        : "border-white/40 hover:border-white/60"
                    }`}
                  >
                    {isSelected && <div className="w-1.5 h-1.5 rounded-sm bg-red-400" />}
                  </div>

                  {/* Color dot */}
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5"
                    style={{ backgroundColor: entry.sentiment?.color || "#888" }}
                  />

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-white/[0.92] leading-relaxed whitespace-pre-wrap break-words">
                      {entry.text}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-white/70">
                        {formatDate(entry.anchorDate)}
                      </span>
                      {entry.sentiment?.categories && (
                        <span className="text-[10px] text-white/55">
                          {entry.sentiment.categories.join(" · ")}
                        </span>
                      )}
                      {entry.temporalScope !== "point" && (
                        <span className="text-[10px] text-white/45 italic">
                          {entry.temporalScope}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {emptyAction && sorted.length > 0 && (
          <div className="flex justify-end pt-2 border-t border-white/[0.06]">
            <Button
              onClick={emptyAction.onClick}
              variant="ghost"
              className="text-white/85 hover:text-white hover:bg-white/10 text-xs"
            >
              + {emptyAction.label}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EntryLog;
