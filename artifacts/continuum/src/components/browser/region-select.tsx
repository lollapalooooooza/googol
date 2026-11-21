import { useEffect, useRef, type PointerEvent as RPE } from "react";
import { Sparkles, Maximize2, X, Move, Globe2 } from "lucide-react";

export interface Rect { x: number; y: number; w: number; h: number }
export interface ExternalMarqueeStart { startX: number; startY: number; curX: number; curY: number }
const MIN = 40;
type Op = "move" | "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";

export function RegionSelect({ drawing, rect, setRect, onDrawEnd, onAdjustEnd, onVisualize, onExpand, onLaunchGenie, onClear, isVideo = false, externalDrag, onExternalDragConsumed }: {
  drawing: boolean; rect: Rect | null; setRect: (r: Rect | null) => void; onDrawEnd: (r: Rect | null) => void; onAdjustEnd?: (r: Rect | null) => void; onVisualize: () => void; onExpand: () => void; onLaunchGenie?: () => void; onClear: () => void; isVideo?: boolean;
  externalDrag?: ExternalMarqueeStart | null; onExternalDragConsumed?: () => void;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const start = useRef<{ px: number; py: number; r: Rect; op: Op | "draw"; bw: number; bh: number } | null>(null);
  const latest = useRef<Rect | null>(null);
  const updateRect = (r: Rect) => { latest.current = r; setRect(r); };

  const bounds = () => layer.current?.getBoundingClientRect() ?? new DOMRect(0, 0, 1, 1);
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  const updateFromClientPoint = (clientX: number, clientY: number) => {
    const s = start.current; if (!s) return;
    const b = bounds();
    const px = clamp(clientX - b.left, 0, s.bw), py = clamp(clientY - b.top, 0, s.bh);
    const dx = px - s.px, dy = py - s.py; const r = s.r;
    if (s.op === "draw") { updateRect({ x: Math.min(s.px, px), y: Math.min(s.py, py), w: Math.abs(dx), h: Math.abs(dy) }); return; }
    if (s.op === "move") { updateRect({ ...r, x: clamp(r.x + dx, 0, s.bw - r.w), y: clamp(r.y + dy, 0, s.bh - r.h) }); return; }
    let { x, y, w, h } = r;
    if (s.op.includes("e")) w = clamp(r.w + dx, MIN, s.bw - r.x);
    if (s.op.includes("s")) h = clamp(r.h + dy, MIN, s.bh - r.y);
    if (s.op.includes("w")) { const nx = clamp(r.x + dx, 0, r.x + r.w - MIN); w = r.w + (r.x - nx); x = nx; }
    if (s.op.includes("n")) { const ny = clamp(r.y + dy, 0, r.y + r.h - MIN); h = r.h + (r.y - ny); y = ny; }
    updateRect({ x, y, w, h });
  };

  const begin = (e: RPE, op: Op | "draw") => {
    e.preventDefault(); e.stopPropagation();
    const b = bounds();
    const px = e.clientX - b.left, py = e.clientY - b.top;
    start.current = { px, py, r: op === "draw" ? { x: px, y: py, w: 0, h: 0 } : rect!, op, bw: b.width, bh: b.height };
    latest.current = start.current.r;
    (e.target as Element).setPointerCapture(e.pointerId);
    if (op === "draw") updateRect({ x: px, y: py, w: 0, h: 0 });
  };
  const move = (e: RPE) => { updateFromClientPoint(e.clientX, e.clientY); };
  const end = () => {
    const s = start.current; start.current = null; if (!s) return;
    // Pointer release must render again so the floating toolbar reappears.
    const finalRect = latest.current;
    if (finalRect) setRect({ ...finalRect });
    if (s.op === "draw") {
      const valid = finalRect && finalRect.w >= MIN && finalRect.h >= MIN ? finalRect : null;
      if (!valid) setRect(null);
      onDrawEnd(valid);
    } else if (finalRect) onAdjustEnd?.(finalRect);
  };
  const cancel = () => {
    const s = start.current; start.current = null;
    if (s?.op === "draw") { setRect(null); onDrawEnd(null); }
    else if (s) setRect({ ...s.r });
  };

  const endRef = useRef(end);
  endRef.current = end;
  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;
  const consumedRef = useRef(onExternalDragConsumed);
  consumedRef.current = onExternalDragConsumed;

  useEffect(() => {
    if (!externalDrag) return;
    const b = bounds();
    const sx = clamp(externalDrag.startX - b.left, 0, b.width);
    const sy = clamp(externalDrag.startY - b.top, 0, b.height);
    start.current = { px: sx, py: sy, r: { x: sx, y: sy, w: 0, h: 0 }, op: "draw", bw: b.width, bh: b.height };
    latest.current = start.current.r;
    updateFromClientPoint(externalDrag.curX, externalDrag.curY);

    const onWinMove = (ev: PointerEvent) => updateFromClientPoint(ev.clientX, ev.clientY);
    const onWinUp = () => {
      cleanup();
      consumedRef.current?.();
      endRef.current();
    };
    const onWinCancel = () => {
      cleanup();
      consumedRef.current?.();
      cancelRef.current();
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", onWinMove);
      window.removeEventListener("pointerup", onWinUp);
      window.removeEventListener("pointercancel", onWinCancel);
    };
    window.addEventListener("pointermove", onWinMove);
    window.addEventListener("pointerup", onWinUp);
    window.addEventListener("pointercancel", onWinCancel);
    return cleanup;
  }, [externalDrag]);

  const handles: [Op, string][] = [["nw", "-left-[5px] -top-[5px] cursor-nwse-resize"], ["ne", "-right-[5px] -top-[5px] cursor-nesw-resize"], ["sw", "-left-[5px] -bottom-[5px] cursor-nesw-resize"], ["se", "-right-[5px] -bottom-[5px] cursor-nwse-resize"],
    ["n", "left-1/2 -translate-x-1/2 -top-[5px] cursor-ns-resize"], ["s", "left-1/2 -translate-x-1/2 -bottom-[5px] cursor-ns-resize"], ["w", "top-1/2 -translate-y-1/2 -left-[5px] cursor-ew-resize"], ["e", "top-1/2 -translate-y-1/2 -right-[5px] cursor-ew-resize"]];

  const ready = rect && rect.w >= MIN && rect.h >= MIN;

  return (
    <div ref={layer} className={`absolute inset-0 z-20 ${drawing ? "cursor-crosshair touch-none" : "pointer-events-none"}`}
      onPointerDown={drawing ? (e) => begin(e, "draw") : undefined} onPointerMove={move} onPointerUp={end} onPointerCancel={cancel}
      data-testid="layer-region-select" aria-label={drawing ? "Drag to select a region" : undefined}>
      {rect && (
        <div className="absolute pointer-events-auto touch-none" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} data-testid="box-selection">
          <div className="absolute inset-0 rounded-[3px] border-[1.5px] border-[#2f6fe0] bg-[#2f6fe0]/[.06] cursor-move" onPointerDown={(e) => begin(e, "move")} onPointerMove={move} onPointerUp={end} />
          {ready && handles.map(([op, cls]) => (
            <span key={op} onPointerDown={(e) => begin(e, op)} onPointerMove={move} onPointerUp={end} aria-hidden
              className={`absolute size-[10px] rounded-[2px] bg-white border-[1.5px] border-[#2f6fe0] ${cls}`} />
          ))}
          {ready && !start.current && (
            <div className="absolute left-1/2 -translate-x-1/2 -top-11 flex items-center gap-0.5 rounded-full bg-white/95 backdrop-blur border border-[#e3e5ea] shadow-[0_6px_18px_-8px_rgba(20,30,50,.35)] p-1 whitespace-nowrap" onPointerDown={(e) => e.stopPropagation()}>
              <span className="grid place-items-center size-7 text-[#6b7280] cursor-move" onPointerDown={(e) => begin(e, "move")} onPointerMove={move} onPointerUp={end} title="Move selection"><Move className="size-3.5" /></span>
              <button onClick={onVisualize} data-testid="button-selection-visualize" className="flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium text-[#1d1f24] hover:bg-[#f0f2f5]"><Sparkles className="size-3.5" />Visualize</button>
              <button onClick={onExpand} data-testid="button-selection-expand" className="flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] text-[#1d1f24] hover:bg-[#f0f2f5]"><Maximize2 className="size-3.5" />{isVideo ? "Open video" : "Open 3D"}</button>
              {onLaunchGenie && (
                <button onClick={onLaunchGenie} data-testid="button-selection-genie" className="flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium text-[#1f54c4] hover:bg-[#eef4ff]"><Globe2 className="size-3.5" />Genie 4 World</button>
              )}
              <button onClick={onClear} aria-label="Clear selection" data-testid="button-selection-close" className="grid place-items-center size-7 rounded-full text-[#6b7280] hover:bg-[#f0f2f5]"><X className="size-3.5" /></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
