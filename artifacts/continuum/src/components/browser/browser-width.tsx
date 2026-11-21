import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { defaultBrowserBounds, fitBrowserBounds, minBrowserWidth, resizeBrowserBounds, windowPadding, type BrowserBounds } from "./browser-width-layout";
import "./browser-width.css";

export function useBrowserWidth() {
  const [bounds, setBounds] = useState(() => defaultBrowserBounds(window.innerWidth));
  const [resizing, setResizing] = useState(false);
  const viewport = useRef(window.innerWidth);
  const changed = useRef(false);
  const drag = useRef<{ edge: "left" | "right"; pointerX: number; bounds: BrowserBounds } | null>(null);

  useEffect(() => {
    const resize = () => {
      viewport.current = window.innerWidth;
      drag.current = null; setResizing(false);
      document.documentElement.classList.remove("browser-width-resizing");
      setBounds((b) => changed.current ? fitBrowserBounds(b, viewport.current) : defaultBrowserBounds(viewport.current));
    };
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      document.documentElement.classList.remove("browser-width-resizing");
    };
  }, []);
  const begin = (e: PointerEvent, edge: "left" | "right") => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { edge, pointerX: e.clientX, bounds };
    setResizing(true);
    document.documentElement.classList.add("browser-width-resizing");
  };
  const move = (e: PointerEvent) => {
    const start = drag.current;
    if (!start) return;
    changed.current = true;
    setBounds(resizeBrowserBounds(start.bounds, start.edge, e.clientX - start.pointerX, viewport.current));
  };
  const end = () => {
    drag.current = null; setResizing(false);
    document.documentElement.classList.remove("browser-width-resizing");
  };
  const cancel = () => { if (drag.current) setBounds(drag.current.bounds); end(); };
  const reset = () => { end(); changed.current = false; setBounds(defaultBrowserBounds(viewport.current)); };
  const keyboard = (e: KeyboardEvent, edge: "left" | "right") => {
    let delta: number;
    if (e.key === "ArrowLeft") delta = e.shiftKey ? -48 : -16;
    else if (e.key === "ArrowRight") delta = e.shiftKey ? 48 : 16;
    else if (e.key === "Home") delta = edge === "left" ? bounds.w : -bounds.w;
    else if (e.key === "End") delta = edge === "left" ? -viewport.current : viewport.current;
    else return;
    e.preventDefault(); changed.current = true;
    setBounds((b) => resizeBrowserBounds(b, edge, delta, viewport.current));
  };

  const handles = (
    <>
      {(["left", "right"] as const).map((edge) => (
        <div key={edge} role="separator" aria-orientation="vertical" aria-label={`Resize browser from ${edge} edge`}
          aria-controls="continuum-browser-window" tabIndex={0}
          aria-valuenow={Math.round(bounds.w)} aria-valuemin={Math.round(minBrowserWidth(viewport.current))}
          aria-valuemax={Math.round(edge === "left" ? bounds.x + bounds.w - windowPadding(viewport.current) : viewport.current - windowPadding(viewport.current) - bounds.x)}
          aria-valuetext={`${Math.round(bounds.w)} pixels wide`}
          title="Drag to resize width. Double-click to reset. Arrow keys resize."
          className={`browser-width-handle browser-width-handle-${edge}`} data-testid={`handle-browser-${edge}`}
          onPointerDown={(e) => begin(e, edge)} onPointerMove={move} onPointerUp={end} onPointerCancel={cancel} onLostPointerCapture={end}
          onDoubleClick={reset} onKeyDown={(e) => keyboard(e, edge)}><span aria-hidden /></div>
      ))}
    </>
  );
  return { bounds, resizing, handles };
}
