import { Upload } from "lucide-react";
import { motion } from "motion/react";
import { useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from "react";

interface Props {
  onFile: (file: File) => void;
}

export function UploadZone({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Enter/leave fire for every child element, so count them to know when the drag really left.
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const open = () => inputRef.current?.click();

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
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  };

  return (
    <>
      <input type="file" accept=".pdf,application/pdf" className="hidden" ref={inputRef} onChange={onChange} />
      <motion.div
        layout
        role="button"
        tabIndex={0}
        aria-label="Select or drop a PDF"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`flex flex-col items-center justify-center gap-6 p-12 w-full rounded-[2rem] border-2 border-dashed transition-all duration-300 relative overflow-hidden group cursor-pointer focus-visible:ring-2 focus-visible:ring-white/40 outline-none ${
          isDragging
            ? "border-white bg-white/10 shadow-[0_0_40px_rgba(255,255,255,0.2)]"
            : "border-white/10 bg-black/20 hover:bg-white/5 hover:border-white/30 shadow-2xl shadow-black/50"
        }`}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={open}
        onKeyDown={onKeyDown}
      >
        {isDragging && (
          <>
            <motion.div
              className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none"
              animate={{ opacity: [0.3, 0.8, 0.3], y: [-20, 0, -20] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{ boxShadow: "inset 0 0 50px rgba(255,255,255,0.1)" }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            />
          </>
        )}

        <span
          className={`flex items-center gap-3 px-8 py-4 bg-white text-black rounded-full font-semibold group-hover:bg-white/90 transition-all shadow-glow-white z-10 ${
            isDragging ? "scale-110 shadow-[0_0_30px_rgba(255,255,255,0.8)]" : ""
          }`}
        >
          <motion.span animate={isDragging ? { y: [-3, 3, -3] } : {}} transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}>
            <Upload className="w-5 h-5" />
          </motion.span>
          {isDragging ? "Drop PDF Here" : "Select PDF"}
        </span>
        <p className={`text-sm transition-colors duration-300 z-10 ${isDragging ? "text-white font-medium" : "text-white/40"}`}>
          {isDragging ? "Release to upload" : "or drag and drop your PDF here"}
        </p>
      </motion.div>
    </>
  );
}
