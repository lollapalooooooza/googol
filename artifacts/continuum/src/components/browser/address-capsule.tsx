import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ScanSearch, X } from "lucide-react";

/** URL capsule that morphs into the black "Select anywhere to generate" pill while region selection is active. */
export function AddressCapsule({ selecting, onCancel, children }: { selecting: boolean; onCancel: () => void; children: ReactNode }) {
  const reduced = !!useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => setAvailableWidth(container.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  const width = availableWidth === null ? "100%" : selecting ? Math.min(480, availableWidth) : availableWidth;
  return (
    <div ref={containerRef} className="relative flex-1 min-w-0 max-w-[700px] mx-auto flex justify-center">
      {/* Animate real width, not a layout scale that distorts the text. */}
      <motion.div initial={false} animate={{ width }}
        transition={{ duration: reduced ? 0 : 0.36, ease: [0.22, 1, 0.36, 1] }}
        className="relative min-w-0 max-w-full">
        <AnimatePresence mode="wait" initial={false}>
          {selecting ? (
            <motion.div key="sel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ opacity: { duration: reduced ? 0 : 0.14 } }}
              role="status" data-testid="status-select-capsule"
              className="flex items-center gap-2 h-[24px] pl-3 pr-1 rounded-full bg-[#1b1c1f] text-[#f2f2f0] shadow-[0_4px_14px_-6px_rgba(10,12,16,.5)]">
              <ScanSearch className="size-3.5 shrink-0 opacity-90" />
              <span className="flex-1 min-w-0 truncate text-center text-[12.5px] font-medium">Select anywhere to generate</span>
              <button type="button" onClick={onCancel} aria-label="Cancel selection" title="Cancel selection (Esc)" data-testid="button-cancel-select"
                className="grid place-items-center size-[20px] shrink-0 rounded-full bg-white/15 hover:bg-white/25 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                <X className="size-3" />
              </button>
            </motion.div>
          ) : (
            <motion.div key="url" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.14 }}>
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
