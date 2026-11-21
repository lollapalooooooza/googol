import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Keep one WebGL drawing buffer and camera projection through portal resizing.
 * Only a uniform compositor transform changes, never the model's proportions.
 * Canvas must use offsetSize so its observer ignores this ancestor transform.
 */
export function StableSceneSurface({ children }: { children: ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    const factor = 1000 / Math.max(w, h);
    setSize({ w: Math.round(w * factor), h: Math.round(h * factor) });
  }, []);

  useLayoutEffect(() => {
    const el = host.current, scene = surface.current;
    if (!el || !scene || !size) return;
    const fit = () => {
      const scale = Math.min(el.clientWidth / size.w, el.clientHeight / size.h);
      scene.style.transform = `translate(-50%, -50%) scale(${scale})`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [size]);

  return <div ref={host} className="absolute inset-0 overflow-hidden" data-testid="stable-scene-surface">
    {size && <div ref={surface} style={{
      position: "absolute", left: "50%", top: "50%", width: size.w, height: size.h,
      transformOrigin: "center", willChange: "transform",
    }}>{children}</div>}
  </div>;
}
