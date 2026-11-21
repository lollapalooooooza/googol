import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as RKE, type PointerEvent as RPE } from "react";
import { createPortal } from "react-dom";
import type { ClipSelection } from "@/lib/jensen-clips";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Maximize2, Minimize2, X, GripHorizontal } from "lucide-react";
import { CellViewer } from "@/components/cell/cell-viewer";
import type { Rect } from "./region-select";
import { EXHIBIT_MEDIA, VISUALIZATION_INFO, type VisualizationId } from "@/lib/visualizations";
import { MarsViewer } from "@/components/exhibits/mars-viewer";
import { VideoViewer } from "@/components/exhibits/video-viewer";
import { ModelUnavailable } from "./model-unavailable";

type Op = "move" | "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";
const MINW = 200, MINH = 140, PAD = 8;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const vpSize = () => ({ w: window.innerWidth, h: window.innerHeight });

function fit(b: Rect, vw: number, vh: number): Rect {
  // A taller clip queue must not cover the browser tabs after collapse.
  const tabBottom = document.querySelector('[role="tablist"]')?.getBoundingClientRect().bottom ?? 0;
  const top = Math.max(PAD, Math.min(tabBottom + PAD, vh - MINH - PAD));
  const availableHeight = vh - top - PAD;
  const w = clamp(b.w, Math.min(MINW, vw - PAD * 2), vw - PAD * 2);
  const h = clamp(b.h, Math.min(MINH, availableHeight), availableHeight);
  return { w, h, x: clamp(b.x, PAD, vw - w - PAD), y: clamp(b.y, top, vh - h - PAD) };
}
function initial(a: Rect, portrait = false): Rect {
  const { w: vw, h: vh } = vpSize();
  const pw = portrait ? clamp(vw * 0.3, 280, 420) : clamp(vw * 0.26, 240, 380);
  const ph = portrait ? Math.min(pw * 1.95, vh * 0.75) : pw * 0.66;
  let x = a.x + a.w + 8;
  if (x + pw > vw - PAD) x = a.x - pw - 8;
  if (x < PAD) x = a.x + a.w - pw;
  return fit({ x, y: a.y + a.h / 2 - ph / 2, w: pw, h: ph }, vw, vh);
}
function centered(vw: number, vh: number): Rect {
  const w = Math.min(vw * 0.88, 1240), h = Math.min(vh * 0.84, 860);
  return { x: (vw - w) / 2, y: (vh - h) / 2, w, h };
}

export function CellPortal({ anchor, expanded, onExpand, onCollapse, onClose, onReady, model, topic, videoSelection }: {
  anchor: Rect; expanded: boolean; onExpand: () => void; onCollapse: () => void; onClose: () => void; onReady: () => void;
  model: VisualizationId | null; topic: string; videoSelection?: ClipSelection;
}) {
  const reduced = !!useReducedMotion();
  const isVideo = model === "jensen-video";
  const [loading, setLoading] = useState(true);
  const [box, setBox] = useState<Rect>(() => initial(anchor, model === "jensen-video"));
  const [vp, setVp] = useState(vpSize);
  const [active, setActive] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const readyRef = useRef(onReady); readyRef.current = onReady;
  const start = useRef<{ px: number; py: number; b: Rect; op: Op } | null>(null);
  const portalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = portalRef.current;
    if (!expanded || !root) return;
    // Keep the same canvas mounted through expansion, while making the
    // centered window modal to keyboard and assistive-technology users.
    const siblings = Array.from(document.body.children)
      .filter((el): el is HTMLElement => el instanceof HTMLElement && el !== root && el.dataset.testid !== "scrim-portal")
      .map((el) => ({ el, inert: el.inert }));
    siblings.forEach(({ el }) => { el.inert = true; });
    const focusInside = () => (root.querySelector<HTMLElement>("button:not([disabled])") ?? root).focus();
    const guardFocus = (event: FocusEvent) => {
      if (!root.contains(event.target as Node)) focusInside();
    };
    document.addEventListener("focusin", guardFocus);
    focusInside();
    return () => {
      document.removeEventListener("focusin", guardFocus);
      siblings.forEach(({ el, inert }) => { el.inert = inert; });
    };
  }, [expanded]);

  const onWindowKey = (e: RKE<HTMLDivElement>) => {
    if (!expanded) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onCollapse(); return; }
    if (e.key !== "Tab") return;
    const nodes = Array.from(portalRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], video[controls], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? []).filter((el) => el.getClientRects().length > 0);
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (!first) { e.preventDefault(); portalRef.current?.focus(); }
    else if (e.shiftKey && (document.activeElement === first || document.activeElement === portalRef.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  useEffect(() => {
    const t = window.setTimeout(() => { setLoading(false); readyRef.current(); }, 3000);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    const h = () => { const s = vpSize(); setVp(s); setBox((b) => fit(b, s.w, s.h)); };
    window.addEventListener("resize", h); return () => window.removeEventListener("resize", h);
  }, []);
  useLayoutEffect(() => {
    setTransitioning(!reduced);
    if (reduced) return;
    // Also settle when the window already happens to match its target bounds.
    const timer = window.setTimeout(() => setTransitioning(false), 980);
    return () => window.clearTimeout(timer);
  }, [expanded, reduced]);
  useEffect(() => {
    const root = portalRef.current;
    if (!expanded || transitioning || !root) return;
    // During expansion only the container is available. Move focus into the
    // controls once they mount, without interrupting focus already inside.
    if (document.activeElement === root || !root.contains(document.activeElement)) {
      (root.querySelector<HTMLElement>("button:not([disabled])") ?? root).focus();
    }
  }, [expanded, transitioning]);

  const begin = (e: RPE, op: Op) => {
    if (expanded || transitioning) return;
    e.preventDefault(); e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    start.current = { px: e.clientX, py: e.clientY, b: box, op }; setActive(true);
  };
  const move = (e: RPE) => {
    const s = start.current; if (!s) return;
    const dx = e.clientX - s.px, dy = e.clientY - s.py, r = s.b, vw = vp.w, vh = vp.h;
    if (s.op === "move") { setBox({ ...r, x: clamp(r.x + dx, PAD, vw - r.w - PAD), y: clamp(r.y + dy, PAD, vh - r.h - PAD) }); return; }
    let { x, y, w, h } = r;
    if (s.op.includes("e")) w = clamp(r.w + dx, MINW, vw - PAD - r.x);
    if (s.op.includes("s")) h = clamp(r.h + dy, MINH, vh - PAD - r.y);
    if (s.op.includes("w")) { const nx = clamp(r.x + dx, PAD, r.x + r.w - MINW); w = r.w + r.x - nx; x = nx; }
    if (s.op.includes("n")) { const ny = clamp(r.y + dy, PAD, r.y + r.h - MINH); h = r.h + r.y - ny; y = ny; }
    setBox({ x, y, w, h });
  };
  const end = () => { start.current = null; setActive(false); };
  const onGripKey = (e: RKE) => {
    const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key as string];
    if (!k) return; e.preventDefault();
    const st = e.altKey ? 4 : 16;
    setBox((b) => e.shiftKey ? fit({ ...b, w: Math.max(MINW, b.w + k[0] * st), h: Math.max(MINH, b.h + k[1] * st) }, vp.w, vp.h)
      : fit({ ...b, x: b.x + k[0] * st, y: b.y + k[1] * st }, vp.w, vp.h));
  };

  const t = expanded ? centered(vp.w, vp.h) : box;
  const transition = active || reduced ? { duration: 0 } : {
    type: "tween" as const, duration: 0.9, ease: [0.22, 0.68, 0, 1] as [number, number, number, number],
  };
  const H = (op: Op, cls: string, line: string) => (
    <div key={op} aria-hidden onPointerDown={(e) => begin(e, op)} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
      className={`absolute z-20 touch-none group/h ${cls}`} data-testid={`handle-portal-${op}`}>
      <span className={`absolute rounded-full bg-[#3f4f2c]/55 opacity-0 group-hover/h:opacity-100 transition-opacity ${line}`} />
    </div>
  );

  const actions = <>
    <PBtn label="Collapse to window" testid="button-portal-collapse" onClick={onCollapse}><Minimize2 className="size-4" /></PBtn>
    <PBtn label="Close preview" testid="button-portal-close-expanded" onClick={onClose}><X className="size-4" /></PBtn>
  </>;
  const node = (
    <>
      <AnimatePresence>
        {expanded && (
          <motion.div key="scrim" className="fixed inset-0 z-[60] bg-[#e9ece4]/35 backdrop-blur-[3px]" onClick={onCollapse}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.3 }} data-testid="scrim-portal" />
        )}
      </AnimatePresence>
      <motion.div ref={portalRef} tabIndex={-1} onKeyDown={onWindowKey} className={`group fixed ${expanded || transitioning ? "z-[61]" : "z-50"}`}
        style={{ left: 0, top: 0, willChange: transitioning ? "transform, width, height" : "auto" }}
        initial={{ opacity: 0, x: t.x, y: t.y, width: t.w, height: t.h }}
        animate={{ opacity: 1, x: t.x, y: t.y, width: t.w, height: t.h }}
        onAnimationComplete={() => setTransitioning(false)}
        exit={{ opacity: 0, transition: { duration: 0.15 } }} transition={transition}
        data-testid="portal-cell" role={expanded ? "dialog" : "region"} aria-modal={expanded || undefined}
        data-motion={transitioning ? "transitioning" : "settled"}
        aria-label={`${model ? VISUALIZATION_INFO[model].title : topic} ${model === "jensen-video" ? "video" : "3D"} preview`} data-model={model ?? "unavailable"}
        aria-busy={loading} data-state={loading ? "loading" : expanded ? "expanded" : "ready"}>
        {!isVideo && <motion.div aria-hidden className="absolute pointer-events-none backdrop-blur-[10px] -inset-5 rounded-[40%] feather-ring"
          initial={false} animate={{ opacity: expanded ? 0 : 1 }} transition={transition} />
        }
        {!isVideo && <motion.div aria-hidden className="absolute pointer-events-none backdrop-blur-[10px] -inset-6 rounded-[48px] feather-ring-soft"
          initial={false} animate={{ opacity: expanded ? 1 : 0 }} transition={transition} />}
        {loading && <div aria-hidden className="portal-breathing-haze absolute -inset-3 rounded-[45%]" />}
        <div className={`absolute inset-0 ${isVideo ? "" : "feather-soft"} ${loading ? "portal-materializing pointer-events-none" : ""}`}>
          <motion.div className="absolute inset-0"
            style={isVideo ? undefined : {
              maskImage: "radial-gradient(ellipse at center, #000 var(--portal-solid), transparent var(--portal-clear))",
              WebkitMaskImage: "radial-gradient(ellipse at center, #000 var(--portal-solid), transparent var(--portal-clear))",
            }}
            initial={false}
            animate={isVideo ? undefined : { "--portal-solid": expanded ? "100%" : "58%", "--portal-clear": expanded ? "140%" : "100%" }}
            transition={transition}>
          {model === "mars"
            ? <MarsViewer compact={!expanded} transitioning={transitioning} textureUrl={EXHIBIT_MEDIA.mars} actions={actions} />
            : model === "jensen-video"
            ? <VideoViewer compact={!expanded} transitioning={transitioning} playWhenReady={!loading} selection={videoSelection} src={EXHIBIT_MEDIA.video} poster={EXHIBIT_MEDIA.poster} actions={actions} />
            : model ? <CellViewer key={model} model={model} compact={!expanded} transitioning={transitioning} feathered actions={actions} />
            : <ModelUnavailable topic={topic} compact={!expanded} actions={actions} />}
          </motion.div>
        </div>
        <span className="sr-only" role="status">{loading ? "Preview is coming into focus." : "Preview ready."}</span>

        {!expanded && !transitioning && (
          <>
            {H("n", "left-6 right-6 -top-1.5 h-4 cursor-ns-resize", "left-1/2 -translate-x-1/2 top-[6px] h-[3px] w-10")}
            {H("s", "left-6 right-6 -bottom-1.5 h-4 cursor-ns-resize", "left-1/2 -translate-x-1/2 bottom-[6px] h-[3px] w-10")}
            {H("w", "top-6 bottom-6 -left-1.5 w-4 cursor-ew-resize", "top-1/2 -translate-y-1/2 left-[6px] w-[3px] h-10")}
            {H("e", "top-6 bottom-6 -right-1.5 w-4 cursor-ew-resize", "top-1/2 -translate-y-1/2 right-[6px] w-[3px] h-10")}
            {H("nw", "-left-2 -top-2 size-7 cursor-nwse-resize", "left-2 top-2 size-2.5")}
            {H("ne", "-right-2 -top-2 size-7 cursor-nesw-resize", "right-2 top-2 size-2.5")}
            {H("sw", "-left-2 -bottom-2 size-7 cursor-nesw-resize", "left-2 bottom-2 size-2.5")}
            {H("se", "-right-2 -bottom-2 size-7 cursor-nwse-resize", "right-2 bottom-2 size-2.5")}
            <div className="absolute z-30 left-1/2 -translate-x-1/2 top-[7%] flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <button aria-label="Move window. Arrow keys move, Shift plus arrows resize." title="Drag to move (arrows move, Shift+arrows resize)"
                onPointerDown={(e) => begin(e, "move")} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onKeyDown={onGripKey}
                data-testid="button-portal-move"
                className="grid place-items-center h-8 w-10 rounded-full bg-white/85 backdrop-blur text-[#2a2d33] shadow-sm cursor-grab active:cursor-grabbing touch-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#3f4f2c]">
                <GripHorizontal className="size-4" />
              </button>
              <PBtn label={loading ? "Expand (preview still loading)" : "Expand"} testid="button-portal-expand" onClick={onExpand} disabled={loading}><Maximize2 className="size-3.5" /></PBtn>
              <PBtn label="Close preview" testid="button-portal-close" onClick={onClose}><X className="size-3.5" /></PBtn>
            </div>
          </>
        )}
      </motion.div>
    </>
  );
  return createPortal(node, document.body);
}

function PBtn({ children, label, onClick, disabled, testid }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; testid: string }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label} data-testid={testid}
      className="grid place-items-center size-8 rounded-full bg-white/85 backdrop-blur text-[#2a2d33] shadow-sm hover:bg-white disabled:opacity-35 disabled:cursor-wait focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#3f4f2c]">
      {children}
    </button>
  );
}
