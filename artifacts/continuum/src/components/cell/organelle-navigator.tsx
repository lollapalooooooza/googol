import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { ORGANELLES, ORGANELLE_ORDER } from "./organelles";

export interface NavItem { id: string; name: string; color: string }
const PLANT_ITEMS: NavItem[] = ORGANELLE_ORDER.map((id) => ({ id, name: ORGANELLES[id].name, color: ORGANELLES[id].color }));
import "./organelle-navigator.css";

const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));

export function OrganelleNavigator<T extends string>({ selected, onSelect, items = PLANT_ITEMS as unknown as NavItem[], noun = "organelles" }: {
  selected: T | null;
  onSelect: (id: T | null) => void;
  items?: NavItem[];
  noun?: string;
}) {
  const ORDER = items.map((i) => i.id as T);
  const byId = new Map(items.map((i) => [i.id, i]));
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);
  const id = useId();
  const viewport = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const drag = useRef<{ offset: number } | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const [focusIndex, setFocusIndex] = useState(0);
  const [scroll, setScroll] = useState({ left: 0, max: 0, ratio: 1 });
  const [dragging, setDragging] = useState(false);
  const reduced = !!useReducedMotion();
  const behavior = reduced ? "instant" as const : "smooth" as const;
  const overflowing = scroll.max > 1;
  const canBack = scroll.left > 1;
  const canNext = scroll.left < scroll.max - 1;

  const measure = useCallback(() => {
    const el = viewport.current;
    if (el) setScroll({ left: el.scrollLeft, max: Math.max(0, el.scrollWidth - el.clientWidth), ratio: el.clientWidth / Math.max(1, el.scrollWidth) });
  }, []);

  useEffect(() => {
    const el = viewport.current, content = row.current;
    if (!el || !content) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el); observer.observe(content);
    measure();
    // Keep a vertical mouse wheel useful here without scrolling the page.
    const wheel = (e: WheelEvent) => {
      const max = el.scrollWidth - el.clientWidth;
      if (e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY) || max <= 1) return;
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientWidth : 1);
      if ((delta > 0 && el.scrollLeft >= max - 1) || (delta < 0 && el.scrollLeft <= 1)) return;
      e.preventDefault();
      el.scrollBy({ left: delta, behavior: "instant" });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => { observer.disconnect(); el.removeEventListener("wheel", wheel); };
  }, [measure]);

  const reveal = useCallback((key: string) => {
    const el = viewport.current, button = buttons.current.get(key);
    if (!el || !button) return;
    const v = el.getBoundingClientRect(), b = button.getBoundingClientRect();
    if (b.left < v.left + 8) el.scrollBy({ left: b.left - v.left - 8, behavior });
    else if (b.right > v.right - 8) el.scrollBy({ left: b.right - v.right + 8, behavior });
  }, [behavior]);

  useEffect(() => {
    if (selected) reveal(selected);
  }, [selected, reveal]);

  const page = (direction: number) => {
    const el = viewport.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.7, behavior });
  };
  const navigate = (e: KeyboardEvent) => {
    let next = focusIndex;
    if (e.key === "ArrowRight") next = Math.min(ORDER.length - 1, focusIndex + 1);
    else if (e.key === "ArrowLeft") next = Math.max(0, focusIndex - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = ORDER.length - 1;
    else return;
    e.preventDefault();
    buttons.current.get(ORDER[next])?.focus({ preventScroll: true });
    reveal(ORDER[next]);
  };

  // Thumb length shows the visible fraction; its position shows the scroll offset.
  const thumbPercent = Math.max(10, scroll.ratio * 100);
  const thumbLeft = scroll.max > 0 ? scroll.left / scroll.max * (100 - thumbPercent) : 0;
  const scrub = (clientX: number) => {
    const el = viewport.current, track = rail.current;
    if (!el || !track || !drag.current) return;
    const rect = track.getBoundingClientRect();
    const travel = rect.width * (1 - thumbPercent / 100);
    if (travel > 0) el.scrollTo({ left: clamp((clientX - rect.left - drag.current.offset) / travel, 1) * scroll.max, behavior: "instant" });
  };
  const startScrub = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !overflowing) return;
    e.preventDefault(); e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const thumbStart = rect.left + rect.width * thumbLeft / 100;
    const thumbWidth = rect.width * thumbPercent / 100;
    const onThumb = e.clientX >= thumbStart && e.clientX <= thumbStart + thumbWidth;
    drag.current = { offset: onThumb ? e.clientX - thumbStart : thumbWidth / 2 };
    setDragging(true); scrub(e.clientX);
  };
  const endScrub = () => { drag.current = null; setDragging(false); };

  return (
    <div className="organelle-nav pointer-events-auto absolute left-1/2 -translate-x-1/2 bottom-0" data-overflow={overflowing} data-dragging={dragging}>
      <div className="organelle-nav-body">
        {overflowing && <button className="organelle-nav-arrow" aria-label={`Scroll ${noun} left`} title="Scroll left" disabled={!canBack} onClick={() => page(-1)} data-testid="button-organelles-prev"><ChevronLeft size={15} /></button>}
        <div ref={viewport} id={id} className="organelle-nav-viewport" onScroll={measure}
          style={{ "--fade-left": canBack ? "18px" : "0px", "--fade-right": canNext ? "18px" : "0px" } as CSSProperties}>
          <div ref={row} role="toolbar" aria-label={Noun} aria-orientation="horizontal" className="organelle-nav-row" onKeyDown={navigate} data-testid="list-organelles">
            {ORDER.map((key, index) => (
              <button key={key} ref={(el) => { if (el) buttons.current.set(key, el); else buttons.current.delete(key); }}
                className="organelle-nav-chip" aria-pressed={selected === key} tabIndex={focusIndex === index ? 0 : -1}
                onFocus={() => { setFocusIndex(index); reveal(key); }}
                onClick={() => onSelect(selected === key ? null : key)} data-testid={`chip-${key}`}
                style={{ "--organelle-color": byId.get(key)!.color } as CSSProperties}>
                <span className="organelle-nav-dot" aria-hidden />
                {byId.get(key)!.name}
              </button>
            ))}
          </div>
        </div>
        {overflowing && <button className="organelle-nav-arrow" aria-label={`Scroll ${noun} right`} title="Scroll right" disabled={!canNext} onClick={() => page(1)} data-testid="button-organelles-next"><ChevronRight size={15} /></button>}
      </div>
      {overflowing && (
        <div ref={rail} role="scrollbar" tabIndex={0} aria-label={`Scroll ${noun}`} aria-controls={id} aria-orientation="horizontal"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(scroll.max ? scroll.left / scroll.max * 100 : 0)}
          className="organelle-nav-rail" data-testid="scrollbar-organelles"
          onPointerDown={startScrub} onPointerMove={(e) => { if (drag.current) scrub(e.clientX); }}
          onPointerUp={endScrub} onPointerCancel={endScrub} onLostPointerCapture={endScrub}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); page(e.key === "ArrowRight" ? 1 : -1); }
            else if (e.key === "Home" || e.key === "End") { e.preventDefault(); viewport.current?.scrollTo({ left: e.key === "Home" ? 0 : scroll.max, behavior }); }
          }}>
          <span className="organelle-nav-track" aria-hidden />
          <span className="organelle-nav-thumb" aria-hidden style={{ width: `${thumbPercent}%`, left: `${thumbLeft}%` }} />
        </div>
      )}
    </div>
  );
}
