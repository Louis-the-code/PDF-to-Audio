import { FileUp } from "lucide-react";
import { motion } from "motion/react";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { spring } from "../../lib/motion";

interface Props {
  onFile: (file: File) => void;
}

export function UploadZone({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Enter/leave fire for every child element, so count them to know when the drag really left.
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow choosing the same file again after an error
    if (file) onFile(file);
  };

  const onDragEnter = (e: DragEvent) => {
    e.preventDefault();
    dragDepth.current++;
    setIsDragging(true);
  };
  const onDragLeave = (e: DragEvent) => {
    e.preventDefault();
    if (--dragDepth.current <= 0) {
      dragDepth.current = 0;
      setIsDragging(false);
    }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <motion.div
      animate={{ transform: isDragging ? "scale(1.015)" : "scale(1)" }}
      transition={spring.tactile}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={`relative flex min-h-[340px] flex-col items-center justify-center gap-5 rounded-3xl border-2 border-dashed p-8 text-center transition-colors duration-200 ${
        isDragging ? "border-signal bg-signal/[0.07]" : "border-white/[0.12] bg-ink-900/60"
      }`}
    >
      <input type="file" accept=".pdf,application/pdf" className="hidden" ref={inputRef} onChange={onChange} />
      <motion.span
        animate={{ transform: isDragging ? "translateY(-4px) rotate(-6deg)" : "translateY(0px) rotate(0deg)" }}
        transition={spring.tactile}
        className={`grid h-16 w-16 place-items-center rounded-2xl ${isDragging ? "bg-signal text-ink-950" : "bg-ink-800 text-signal"}`}
      >
        <FileUp className="h-7 w-7" />
      </motion.span>
      <div>
        <p className="font-display text-2xl font-semibold">{isDragging ? "Drop it here" : "Drop a PDF here"}</p>
        <p className="mt-1.5 text-mist-muted">Up to 10 MB. Text-based PDFs work best.</p>
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="press h-12 rounded-xl bg-signal px-6 font-semibold text-ink-950 shadow-signal hover:bg-signal-strong"
      >
        Choose a PDF
      </button>
    </motion.div>
  );
}
