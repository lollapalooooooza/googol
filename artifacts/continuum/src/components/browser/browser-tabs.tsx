import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { tabLayout } from "./tab-layout";
import "./browser-tabs.css";

export type HeaderTabKind = "wiki" | "google" | "news" | "empty";

interface HeaderTab {
  key: number;
  label: string;
  empty: boolean;
  kind?: HeaderTabKind;
}

function GoogleFavicon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[14px]" aria-hidden="true">
      <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z" />
      <path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 0 0 0 10.76l3.98-3.09z" />
      <path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  );
}

export function BrowserTabs({ tabs, activeKey, minimized, onSelect, onClose, onNew }: {
  tabs: HeaderTab[];
  activeKey: number;
  minimized: boolean;
  onSelect: (key: number) => void;
  onClose: (key: number) => void;
  onNew: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<number, HTMLButtonElement>());
  const [available, setAvailable] = useState(0);
  const [edges, setEdges] = useState({ start: true, end: true });
  const count = tabs.length;
  // Compress every capsule equally, then scroll only at the usable minimum.
  const { overflow, width: tabWidth } = tabLayout(available, count);
  const updateEdges = () => {
    const el = viewport.current;
    if (el) setEdges({ start: el.scrollLeft <= 1, end: el.scrollLeft >= el.scrollWidth - el.clientWidth - 1 });
  };

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => setAvailable(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const reveal = () => {
      const button = buttons.current.get(activeKey);
      if (button) {
        const tab = button.parentElement!.getBoundingClientRect(), view = el.getBoundingClientRect();
        if (tab.left < view.left) el.scrollLeft += tab.left - view.left;
        else if (tab.right > view.right) el.scrollLeft += tab.right - view.right;
      }
      updateEdges();
    };
    const frame = requestAnimationFrame(reveal);
    // Recheck once actual width transitions have finished, without scaling text.
    const timer = window.setTimeout(reveal, 260);
    return () => { cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, [activeKey, count, tabWidth]);

  useEffect(() => {
    const el = viewport.current;
    if (!el || !overflow) return;
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientWidth : 1);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [overflow]);

  const keyboard = (e: KeyboardEvent, key: number) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const index = tabs.findIndex((t) => t.key === key);
    let target: HeaderTab | undefined;
    if (e.key === "ArrowRight") target = tabs[(index + 1) % count];
    else if (e.key === "ArrowLeft") target = tabs[(index - 1 + count) % count];
    else if (e.key === "Home") target = tabs[0];
    else if (e.key === "End") target = tabs[count - 1];
    else if (e.key === "Delete") {
      e.preventDefault();
      onClose(key);
      const next = tabs[index + 1] ?? tabs[index - 1];
      requestAnimationFrame(() => next ? buttons.current.get(next.key)?.focus() : root.current?.querySelector<HTMLButtonElement>("[data-testid='button-new-tab']")?.focus());
      return;
    }
    if (target) { e.preventDefault(); onSelect(target.key); buttons.current.get(target.key)?.focus({ preventScroll: true }); }
  };

  return (
    <div ref={root} className="browser-tabs" data-testid="browser-tabs" data-overflow={overflow}>
      {/* Own only tab buttons, keeping their independent close buttons outside
          the tablist's accessibility tree. */}
      {count > 0 && <div className="absolute inset-0 pointer-events-none" role="tablist" aria-label="Open tabs" aria-owns={tabs.map((tab) => `header-tab-${tab.key}`).join(" ")} />}
      {overflow && <button className="browser-tabs-arrow" aria-label="Scroll tabs left" title="Scroll tabs left" disabled={edges.start}
        onClick={() => viewport.current?.scrollBy({ left: -180, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })}><ChevronLeft size={13} /></button>}
      <div ref={viewport} className="browser-tabs-viewport" onScroll={updateEdges}>
        {tabs.map((tab) => {
          const on = tab.key === activeKey && !minimized;
          const kind: HeaderTabKind = tab.kind ?? (tab.empty ? "empty" : "wiki");
          const title =
            kind === "google"
              ? tab.label.replace(/ (?:—|-) Google Search$/, "")
              : kind === "news"
                ? tab.label.replace(/ — Briefing$/, "")
                : tab.label.replace(/ — Wikipedia(?: search)?$/, "");
          const sourceSuffix =
            kind === "google"
              ? " - Google Search"
              : kind === "news"
                ? " — Briefing"
                : kind === "wiki"
                  ? " — Wikipedia"
                  : "";
          return (
            <div key={tab.key} className="browser-tab" data-active={on} data-tab-kind={kind} style={{ width: tabWidth }}
              onMouseDown={(e) => { if (e.button === 1) e.preventDefault(); }}
              onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); onClose(tab.key); } }}>
              <button ref={(el) => { if (el) buttons.current.set(tab.key, el); else buttons.current.delete(tab.key); }}
                id={`header-tab-${tab.key}`} role="tab" aria-selected={on} aria-controls="browser-article-panel"
                aria-label={tab.label} title={tab.label} tabIndex={tab.key === activeKey ? 0 : -1}
                data-testid={`tab-${tab.key}`} className="browser-tab-select" onKeyDown={(e) => keyboard(e, tab.key)} onClick={() => onSelect(tab.key)}>
                <span className="browser-tab-favicon" aria-hidden>
                  {kind === "empty" ? <Plus size={12} /> : kind === "google" ? <GoogleFavicon /> : kind === "news" ? "N" : "W"}
                </span>
                <span className="browser-tab-title">
                  {title}
                  {sourceSuffix && <span className="browser-tab-source">{sourceSuffix}</span>}
                </span>
              </button>
              <button className="browser-tab-close" aria-label={`Close ${tab.label}`} title="Close tab"
                data-testid={`button-close-tab-${tab.key}`} onClick={() => onClose(tab.key)}><X size={12} /></button>
            </div>
          );
        })}
      </div>
      {overflow && <button className="browser-tabs-arrow" aria-label="Scroll tabs right" title="Scroll tabs right" disabled={edges.end}
        onClick={() => viewport.current?.scrollBy({ left: 180, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })}><ChevronRight size={13} /></button>}
      <button className="browser-tabs-new" aria-label="New tab" title="New tab" data-testid="button-new-tab" onClick={onNew}><Plus size={15} /></button>
    </div>
  );
}
