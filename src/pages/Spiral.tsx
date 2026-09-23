import React, { useEffect, useMemo, useState } from "react";
import { SpiralVisualization } from "@/components/spiral";
import EntryPopup from "@/components/journal/EntryPopup";
import EntryLog from "@/components/journal/EntryLog";
import { SpiralControls } from "@/components/spiral/SpiralControls";
import { SpiralHelp } from "@/components/spiral/SpiralHelp";
import { EmptyRecord } from "@/components/spiral/EmptyRecord";
import { RegionTooltip } from "@/components/spiral/RegionTooltip";
import { useSpiralEntries } from "@/hooks/useSpiralEntries";

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const Spiral: React.FC = () => {
  const {
    entries,
    ready,
    config,
    anchorDate,
    showEntryPopup,
    setShowEntryPopup,
    showEntryLog,
    setShowEntryLog,
    handleTildePlaced,
    handleSaveEntry,
    handleDeleteEntry,
    handleDeleteMultiple,
    handleHover,
    hoverInfo,
    loadSeedData,
  } = useSpiralEntries();

  const [showTodayLog, setShowTodayLog] = useState(false);

  // Seeding demo data is not a user-facing control — the spiral seeds itself
  // on first visit, and a button for it only clutters the view. It stays
  // reachable while developing the visualization:  window.loadSpiralDemo()
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { loadSpiralDemo?: () => void };
    w.loadSpiralDemo = loadSeedData;
    return () => {
      delete w.loadSpiralDemo;
    };
  }, [loadSeedData]);

  const todayEntries = useMemo(() => {
    const now = new Date();
    return entries.filter((e) => isSameDay(new Date(e.anchorDate), now));
  }, [entries]);

  const handleTodayClick = () => {
    if (todayEntries.length === 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      handleTildePlaced(today);
    } else {
      setShowTodayLog(true);
    }
  };


  const beginRecord = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    handleTildePlaced(today);
  };

  // Storage has not been read yet. Drawing anything here would mean guessing
  // between "no entries" and "not loaded", and guessing wrong flashes the
  // empty screen at somebody who has years of record.
  if (!ready) {
    return <div className="w-full h-screen bg-[#010206]" />;
  }

  // No record, no spiral. The composer still mounts, because it is how the
  // first entry gets written.
  if (entries.length === 0) {
    return (
      <>
        <EmptyRecord onBegin={beginRecord} />
        <EntryPopup
          open={showEntryPopup}
          onClose={() => setShowEntryPopup(false)}
          onSave={handleSaveEntry}
          anchorDate={anchorDate}
        />
      </>
    );
  }

  return (
    <div className="w-full h-screen">
      <SpiralVisualization
        entries={entries}
        config={config}
        onTildePlaced={handleTildePlaced}
        onHover={handleHover}
        onTodayClick={handleTodayClick}
      />

      <SpiralControls onViewEntriesClick={() => setShowEntryLog(true)} />

      <SpiralHelp />

      {hoverInfo && (
        <RegionTooltip
          visible={true}
          x={hoverInfo.x}
          y={hoverInfo.y}
          dateLabel={hoverInfo.dateLabel}
          summary={hoverInfo.summary}
          loading={hoverInfo.loading}
          entryCount={hoverInfo.entryCount}
        />
      )}

      <EntryLog
        entries={entries}
        open={showEntryLog}
        onOpenChange={setShowEntryLog}
        onDeleteEntry={handleDeleteEntry}
        onDeleteMultiple={handleDeleteMultiple}
      />

      <EntryLog
        entries={todayEntries}
        open={showTodayLog}
        onOpenChange={setShowTodayLog}
        onDeleteEntry={handleDeleteEntry}
        onDeleteMultiple={handleDeleteMultiple}
        title="Today"
        emptyAction={{
          label: "Journal today",
          onClick: () => {
            setShowTodayLog(false);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            handleTildePlaced(today);
          },
        }}
      />

      <EntryPopup
        open={showEntryPopup}
        onClose={() => setShowEntryPopup(false)}
        onSave={handleSaveEntry}
        anchorDate={anchorDate}
      />
    </div>
  );
};

export default Spiral;
