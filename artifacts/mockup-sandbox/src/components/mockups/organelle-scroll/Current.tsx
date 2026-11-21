import { useRef, useState } from "react";
import "./_group.css";

// Extracted from CellViewer's original capsule; only scene state is local.
const items = ["Cell wall", "Central vacuole", "Nucleus", "Endoplasmic reticulum", "Golgi apparatus", "Chloroplast", "Mitochondrion", "Ribosomes", "Cytoplasm & cytoskeleton"];
export function Current() {
  const chipsRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="organelle-preview min-h-screen relative">
      <div className="absolute inset-4">
        <div ref={chipsRef} tabIndex={0} role="listbox" aria-label="Organelles" data-testid="list-organelles"
          onWheel={(e) => { if (chipsRef.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) chipsRef.current.scrollLeft += e.deltaY; }}
          onKeyDown={(e) => { if (!chipsRef.current) return; if (e.key === "ArrowRight") chipsRef.current.scrollLeft += 120; if (e.key === "ArrowLeft") chipsRef.current.scrollLeft -= 120; }}
          className="chip-scroll pointer-events-auto absolute left-1/2 -translate-x-1/2 bottom-0 max-w-full w-max flex gap-1 overflow-x-auto whitespace-nowrap rounded-full border border-[#e2dccd] bg-[#f8f5ec]/90 backdrop-blur p-1 shadow-[0_8px_24px_-14px_rgba(70,55,30,.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6f8f4e]">
          {items.map((id) => (
            <button key={id} role="option" aria-selected={selected === id} onClick={() => setSelected(selected === id ? null : id)}
              className={`shrink-0 px-3 h-8 rounded-full text-[12px] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6f8f4e] ${selected === id ? "bg-[#2f2a24] text-[#f3eee2]" : "text-[#5c554b] hover:bg-white"}`}>
              {id}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
