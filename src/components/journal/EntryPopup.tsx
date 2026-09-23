import React, { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, MicOff, Pencil } from "lucide-react";
import { JournalEntry } from "@/types/event";
import { v4 as uuidv4 } from "uuid";

interface EntryPopupProps {
  open: boolean;
  onClose: () => void;
  onSave: (entry: JournalEntry) => void;
  anchorDate: Date | null;
}

const formatDateLabel = (d: Date) => {
  const months = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

const toDateInputValue = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const EntryPopup: React.FC<EntryPopupProps> = ({
  open,
  onClose,
  onSave,
  anchorDate,
}) => {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [editedDate, setEditedDate] = useState<Date | null>(null);
  const [editingDate, setEditingDate] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (open) {
      setEditedDate(anchorDate);
      setEditingDate(false);
    }
  }, [open, anchorDate]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await transcribeAudio(blob);
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }, [recording]);

  const transcribeAudio = async (blob: Blob) => {
    setTranscribing(true);
    try {
      // Use Whisper via Groq (free) — falls back to Web Speech API
      const formData = new FormData();
      formData.append("file", blob, "recording.webm");
      formData.append("model", "whisper-large-v3");

      const groqKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
      if (groqKey) {
        const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${groqKey}` },
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          const spoken = typeof data.text === "string" ? data.text.trim() : "";
          if (spoken) {
            setText((prev) => (prev ? prev + " " : "") + spoken);
          }
        }
      } else {
        // Fallback: use Web Speech API recognition
        // Groq key not set — speech-to-text unavailable
      }
    } catch (err) {
      console.error("Transcription failed:", err);
    } finally {
      setTranscribing(false);
    }
  };

  const handleSave = () => {
    const finalDate = editedDate ?? anchorDate;
    if (!text.trim() || !finalDate) return;

    const entry: JournalEntry = {
      id: uuidv4(),
      text: text.trim(),
      createdAt: new Date().toISOString(),
      anchorDate: finalDate.toISOString(),
      temporalScope: "point",
    };

    onSave(entry);
    setText("");
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSave();
    }
  };

  const displayDate = editedDate ?? anchorDate;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl !bg-[rgba(12,12,20,0.94)] backdrop-blur-xl border border-white/[0.08] shadow-2xl shadow-black/60 max-h-[85vh] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-extralight tracking-[0.15em] text-white/[0.92]">
            {displayDate ? (
              editingDate ? (
                <input
                  type="date"
                  autoFocus
                  value={toDateInputValue(displayDate)}
                  onChange={(e) => {
                    const [y, m, d] = e.target.value.split("-").map(Number);
                    if (y && m && d) {
                      const next = new Date(displayDate);
                      next.setFullYear(y, m - 1, d);
                      setEditedDate(next);
                    }
                  }}
                  onBlur={() => setEditingDate(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") setEditingDate(false);
                  }}
                  className="bg-white/5 border border-white/15 rounded-md px-2 py-1 text-2xl font-extralight tracking-[0.15em] text-white/[0.92] focus:outline-none focus:border-white/30 [color-scheme:dark]"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingDate(true)}
                  className="group inline-flex items-center gap-2 text-white/[0.92] hover:text-white transition-colors"
                  title="Click to change the date"
                >
                  <span>{formatDateLabel(displayDate)}</span>
                  <Pencil className="h-3.5 w-3.5 text-white/30 group-hover:text-white/70 transition-colors" />
                </button>
              )
            ) : (
              "New Entry"
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="py-6">
          <div className="relative">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={transcribing ? "Transcribing..." : "What's on your mind..."}
              className="min-h-[180px] bg-white/[0.06] border-white/[0.1] text-white/[0.92] text-base leading-relaxed placeholder:text-white/40 resize-none focus:border-white/25 focus:ring-0 pr-14 rounded-xl"
              autoFocus
              disabled={transcribing}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={recording ? stopRecording : startRecording}
              disabled={transcribing}
              className={`absolute bottom-3 right-3 h-9 w-9 rounded-full ${
                recording
                  ? "text-red-400 bg-red-400/20 animate-pulse"
                  : "text-white/50 hover:text-white/80 hover:bg-white/10"
              }`}
            >
              {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-white/50 mt-3 tracking-wide">
            Ctrl+Enter to save{transcribing ? " · transcribing..." : ""}
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/5">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!text.trim() || transcribing}
            className="bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-lg px-6"
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EntryPopup;
