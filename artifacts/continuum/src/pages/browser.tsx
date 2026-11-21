import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, RotateCw, X, Minus, Search, ScanSearch } from "lucide-react";
import { WikiPage, NewTabPage, type NavFn } from "@/components/wiki/wiki-page";
import { WikiSearchPage } from "@/components/wiki/wiki-search-page";
import { SuggestList } from "@/components/wiki/search-suggest";
import { RegionSelect, type Rect } from "@/components/browser/region-select";
import { CellPortal } from "@/components/browser/cell-portal";
import { CellViewer } from "@/components/cell/cell-viewer";
import { AddressCapsule } from "@/components/browser/address-capsule";
import { BrowserTabs } from "@/components/browser/browser-tabs";
import { useBrowserWidth } from "@/components/browser/browser-width";
import { titleFromUrl, wikiUrl, wikiSearchUrl, normTitle, looksLikeUrl, searchEntry, searchFromEntry } from "@/lib/wiki";
import { INITIAL_ARTICLES } from "@/data/articles";
import { useReaderSettings } from "@/hooks/use-reader-settings";
import { getGetWikiArticleQueryKey, useGetWikiArticle } from "@workspace/api-client-react";
import { MODEL_INFO, modelFromView, type ModelId } from "@/lib/model-catalog";
import { EXHIBIT_MEDIA, NEWS_ENTRY, VISUALIZATION_INFO, resolveVisualization } from "@/lib/visualizations";
import { clipsForRegion, type ClipSelection } from "@/lib/jensen-clips";
import { MarsViewer } from "@/components/exhibits/mars-viewer";
import { NewsPage } from "@/components/exhibits/news-page";

interface Tab { key: number; history: string[]; idx: number }
const INITIAL = INITIAL_ARTICLES;
let keySeq = 10;
const split = (e: string) => { const i = e.indexOf("#"); return i < 0 ? { title: e, hash: undefined } : { title: e.slice(0, i), hash: e.slice(i + 1) }; };
const entry = (t: string, hash?: string) => (hash ? `${normTitle(t)}#${hash}` : normTitle(t));

const HELP: [string, string][] = [
  ["Plant cell", "open an article by title"],
  ["https://en.wikipedia.org/wiki/…", "open a Wikipedia URL"],
  ["search beaver dam", "show matching articles"],
  ["new tab neuron", "open in a new tab"],
  ["select", "drag-select a region of the page"],
  ["3d model", "expand the current article's selected 3D preview"],
  ["back / forward / reload / close tab", "browser actions"],
];

export default function Browser({ newsRoute = false }: { newsRoute?: boolean }) {
  const [standalone, setStandalone] = useState<ModelId | "mars" | null>(() => {
    const view = new URLSearchParams(window.location.search).get("view");
    return view === "mars" ? "mars" : modelFromView(view);
  });
  const [tabs, setTabs] = useState<Tab[]>(() => INITIAL.map((t, i) => ({ key: i + 1, history: [t], idx: 0 })));
  const [activeKey, setActiveKey] = useState(() => newsRoute ? 4 : 1);
  const [names, setNames] = useState<Record<number, { entry: string; title: string }>>({});
  const [closed, setClosed] = useState<Tab[]>([]);
  const [reloadTick, setReloadTick] = useState(0);
  const [contentsOpen, setContentsOpen] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const [portalOn, setPortalOn] = useState(false);
  const [portalAnchor, setPortalAnchor] = useState<Rect | null>(null);
  const [portalRun, setPortalRun] = useState(0);
  const [portalReady, setPortalReady] = useState(false);
  const [cellOpen, setCellOpen] = useState(false);
  const [portalDocument, setPortalDocument] = useState("");
  const [videoSelection, setVideoSelection] = useState<ClipSelection>();
  const areaRef = useRef<HTMLDivElement>(null);
  const addrRef = useRef<HTMLInputElement>(null);
  const browserWidth = useBrowserWidth();
  const viewerReturnFocus = useRef<{ element: HTMLElement | null; testid: string | null }>({ element: null, testid: null });
  const focusRun = useRef(0);
  const reader = useReaderSettings();
  const openCell = () => {
    focusRun.current++;
    const element = document.activeElement as HTMLElement | null;
    viewerReturnFocus.current = { element, testid: element?.getAttribute("data-testid") ?? null };
    setCellOpen(true);
  };
  const closePortal = () => {
    focusRun.current++;
    setPortalOn(false); setPortalReady(false); setCellOpen(false);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[data-testid="button-selection-visualize"]')?.focus());
  };
  const collapseCell = () => {
    setCellOpen(false);
    const run = ++focusRun.current;
    const deadline = performance.now() + 1000;
    const restore = () => {
      if (run !== focusRun.current) return;
      const { element, testid } = viewerReturnFocus.current;
      const target = element?.isConnected ? element : testid ? document.querySelector<HTMLElement>(`[data-testid="${CSS.escape(testid)}"]`) : null;
      // Compact controls remount only after the window's collapse animation.
      if (!target && testid && performance.now() < deadline) { requestAnimationFrame(restore); return; }
      (target ?? addrRef.current)?.focus();
    };
    requestAnimationFrame(restore);
  };

  const active = tabs.find((t) => t.key === activeKey) ?? tabs[0];
  const cur = active ? active.history[active.idx] : "";
  const searchQuery = searchFromEntry(cur);
  const { title, hash } = split(searchQuery === null ? cur : "");
  const isNews = title === NEWS_ENTRY;
  // Observe the SAME query as WikiPage without fetching twice. Tab display
  // names are not proof that this document has successfully loaded.
  const articleQuery = useGetWikiArticle({ title }, { query: {
    queryKey: getGetWikiArticleQueryKey({ title }), enabled: false,
  } });
  const loadedArticle = isNews ? { title: "Jensen Huang" } : searchQuery === null && title ? articleQuery.data : undefined;
  const model = resolveVisualization(loadedArticle?.title, title);
  const documentIdentity = `${active?.key ?? ""}:${cur}:${reloadTick}:${loadedArticle?.title ?? ""}`;
  const portalMatches = portalDocument === documentIdentity && !!loadedArticle;

  // A real, shareable news URL while the internal browser stays mounted.
  useEffect(() => {
    if (newsRoute === isNews) return;
    const target = tabs.find((tab) => (split(tab.history[tab.idx]).title === NEWS_ENTRY) === newsRoute);
    if (target) setActiveKey(target.key);
    else {
      const key = ++keySeq;
      setTabs((current) => [...current, { key, history: [newsRoute ? NEWS_ENTRY : "Plant cell"], idx: 0 }]);
      setActiveKey(key);
    }
  }, [newsRoute]);
  useEffect(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const path = isNews ? `${base}${NEWS_ENTRY}` : `${base}/`;
    if (window.location.pathname !== path) window.history.replaceState(window.history.state, "", `${path}${window.location.search}`);
  }, [isNews]);
  useEffect(() => {
    focusRun.current++;
    setRect(null); setDrawing(false); setPortalAnchor(null);
    setPortalOn(false); setPortalReady(false); setCellOpen(false);
  }, [cur, activeKey, reloadTick, loadedArticle?.title]);
  useEffect(() => { if (standalone) document.title = `${VISUALIZATION_INFO[standalone].title} — Interactive 3D`; }, [standalone]);
  useEffect(() => { if (isNews) document.title = "Jensen Huang: Relationships and Recent News"; }, [isNews]);
  useEffect(() => { if (!title && searchQuery === null) document.title = "New tab"; }, [title, searchQuery]);

  const pushEntry = useCallback((key: number, e: string) => {
    setTabs((ts) => ts.map((t) => (t.key !== key ? t : t.history[t.idx] === e ? t : { ...t, history: [...t.history.slice(0, t.idx + 1), e], idx: t.idx + 1 })));
  }, []);
  const openTab = useCallback((e: string, focus = true) => {
    const k = ++keySeq;
    setTabs((ts) => [...ts, { key: k, history: [e], idx: 0 }]);
    if (focus) setActiveKey(k);
    setMinimized(false);
  }, []);
  const navigate: NavFn = useCallback((t, opts) => {
    const e = entry(t, opts?.hash);
    if (opts?.newTab || !active) openTab(e, !opts?.newTab || !active);
    else pushEntry(active.key, e);
    setMinimized(false);
  }, [active, openTab, pushEntry]);
  const closeTab = (k: number) => {
    const i = tabs.findIndex((t) => t.key === k); const t = tabs[i]; if (!t) return;
    const next = tabs.filter((x) => x.key !== k);
    setClosed((c) => [t, ...c].slice(0, 20));
    setTabs(next);
    if (k === activeKey && next.length) setActiveKey(next[Math.max(0, i - 1)].key);
  };
  const reopen = () => { const [t, ...rest] = closed; if (!t) return; setClosed(rest); setTabs((ts) => [...ts, t]); setActiveKey(t.key); };
  const go = (d: number) => active && setTabs((ts) => ts.map((t) => (t.key !== active.key ? t : { ...t, idx: Math.min(t.history.length - 1, Math.max(0, t.idx + d)) })));

  /* address */
  const [addr, setAddr] = useState("");
  const [addrFocus, setAddrFocus] = useState(false);
  const submitAddress = (raw: string) => {
    const s = raw.trim(); if (!s) return;
    const localPath = `${import.meta.env.BASE_URL.replace(/\/$/, "")}${NEWS_ENTRY}`;
    if (s === NEWS_ENTRY || s === NEWS_ENTRY.slice(1) || s === `${window.location.origin}${localPath}`) {
      navigate(NEWS_ENTRY); setAddrFocus(false); addrRef.current?.blur(); return;
    }
    const u = titleFromUrl(s);
    if (u) navigate(u.title, { hash: u.hash });
    else if (looksLikeUrl(s)) say("Only English Wikipedia article URLs open inside googol.");
    else search(s);
    setAddrFocus(false); addrRef.current?.blur();
  };

  /* command bar */
  const [cmd, setCmd] = useState("");
  const [cmdMsg, setCmdMsg] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const say = (m: string) => { setCmdMsg(m); window.setTimeout(() => setCmdMsg((x) => (x === m ? null : x)), 3200); };
  const search = (query: string) => {
    const value = query.trim();
    if (!value) return;
    if (value.length > 250) { say("Search using 250 characters or fewer."); return; }
    // Wikipedia's exact Mars search opens its real article, never the exhibit.
    if (/^mars(?: \(planet\))?$/i.test(value)) { navigate("Mars"); return; }
    const e = searchEntry(value);
    if (active) pushEntry(active.key, e); else openTab(e);
    setMinimized(false);
  };
  const clearSelection = () => {
    setRect(null); setPortalAnchor(null); setPortalOn(false); setPortalReady(false); setCellOpen(false);
  };
  const startSelect = () => {
    if (!loadedArticle) { say(title ? "Wait for the Wikipedia article to load before selecting a region." : "Open a Wikipedia article first."); return; }
    clearSelection(); setDrawing(true); setCellOpen(false); setMinimized(false);
  };
  const revealPortal = (selection: Rect | null) => {
    if (!loadedArticle || !selection || selection.w < 40 || selection.h < 40) return;
    const b = areaRef.current?.getBoundingClientRect();
    const absoluteSelection = { ...selection, x: selection.x + (b?.left ?? 0), y: selection.y + (b?.top ?? 0) };
    setVideoSelection(model === "jensen-video" && areaRef.current ? clipsForRegion(areaRef.current, absoluteSelection) : undefined);
    setPortalDocument(documentIdentity);
    setCellOpen(false);
    setPortalAnchor(absoluteSelection); setPortalReady(false); setPortalRun((n) => n + 1); setPortalOn(true);
  };
  const finishSelection = (selection: Rect | null) => {
    setDrawing(false);
    if (selection) revealPortal(selection);
    else clearSelection();
  };
  const runCommand = (e: FormEvent) => {
    e.preventDefault();
    const raw = cmd.trim(); const s = raw.toLowerCase(); if (!raw) return;
    setCmd(""); setHelpOpen(false);
    if (s === "help" || s === "?") { setHelpOpen(true); return; }
    if (/^(select|draw|region|select region|selection)$/.test(s)) { startSelect(); return; }
    const requestedModel = /^(3d neuron|neuron 3d|open 3d neuron)$/.test(s) ? "neuron"
      : /^(plant cell 3d|3d plant cell)$/.test(s) ? "plant-cell" : null;
    if (requestedModel && model !== requestedModel) {
      navigate(MODEL_INFO[requestedModel].title);
      say(`Select a region in ${MODEL_INFO[requestedModel].title} once its article loads.`);
      return;
    }
    if (requestedModel || /^(3d|3d model|3d cell|cell|open 3d cell|model|open cell|show cell)$/.test(s)) {
      if (!portalAnchor || !portalOn) startSelect();
      else if (!portalReady) say("The 3D preview is coming into focus.");
      else { openCell(); say(model ? `Opened the ${VISUALIZATION_INFO[model].title} preview.` : `No 3D model is available for ${loadedArticle?.title ?? title}.`); }
      return;
    }
    if (s === "back") { go(-1); return; }
    if (s === "forward") { go(1); return; }
    if (s === "reload" || s === "refresh") { setReloadTick((n) => n + 1); return; }
    if (s === "close tab") { if (active) closeTab(active.key); return; }
    if (s === "reopen tab" || s === "reopen") { reopen(); return; }
    if (s === "new tab") { openTab(""); return; }
    let m = raw.match(/^new tab\s+(.+)$/i) ?? raw.match(/^open\s+(.+?)\s+in (?:a )?new tab$/i);
    if (m) {
      const u = titleFromUrl(m[1]);
      if (!u && looksLikeUrl(m[1])) { say("Only English Wikipedia article URLs open inside googol."); return; }
      openTab(entry(u?.title ?? m[1], u?.hash)); return;
    }
    m = raw.match(/^(?:search|find)\s+(.+)$/i);
    if (m) { search(m[1]); return; }
    m = raw.match(/^(?:open|go to|goto|read|visit)\s+(.+)$/i);
    const target = m ? m[1] : raw;
    const u = titleFromUrl(target);
    if (u) { navigate(u.title, { hash: u.hash }); return; }
    if (looksLikeUrl(target)) { say("Only English Wikipedia article URLs open inside googol."); return; }
    navigate(target); say(`Opening “${target}”`);
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (cellOpen) collapseCell();
        else {
          const portalFocused = !!document.activeElement?.closest('[data-testid="portal-cell"]');
          setDrawing(false); clearSelection();
          if (portalFocused) requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[data-testid="button-select-region"]')?.focus());
        }
        setHelpOpen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "l") { e.preventDefault(); addrRef.current?.focus(); addrRef.current?.select(); }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "t") { e.preventDefault(); reopen(); }
      if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); go(1); }
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  });

  if (standalone) {
    return (
      <div className="h-[100dvh] w-full">
        {standalone === "mars"
          ? <MarsViewer textureUrl={EXHIBIT_MEDIA.mars} onClose={() => { window.history.replaceState(null, "", window.location.pathname); setStandalone(null); }} />
          : <CellViewer key={standalone} model={standalone} onClose={() => { window.history.replaceState(null, "", window.location.pathname); setStandalone(null); }} />}
      </div>
    );
  }

  const tabLabel = (t: Tab) => {
    const e = t.history[t.idx]; if (!e) return "New tab";
    if (split(e).title === NEWS_ENTRY) return "Jensen Huang — Briefing";
    const query = searchFromEntry(e);
    if (query !== null) return `${query} — Wikipedia search`;
    return `${names[t.key]?.entry === e ? names[t.key].title : split(e).title} — Wikipedia`;
  };
  const resolvedTitle = active && names[active.key]?.entry === cur ? names[active.key].title : title;
  const shownUrl = isNews ? NEWS_ENTRY : searchQuery !== null ? wikiSearchUrl(searchQuery) : title ? wikiUrl(resolvedTitle, hash) : "";

  return (
    <div className="desk relative min-h-[100dvh] h-[100dvh] w-full overflow-hidden" data-testid="desktop">
      {/* tabs outside browser */}
      <BrowserTabs tabs={tabs.map((t) => ({ key: t.key, label: tabLabel(t), empty: !t.history[t.idx] }))}
        activeKey={activeKey} minimized={minimized} onSelect={(key) => { setActiveKey(key); setMinimized(false); }}
        onClose={closeTab} onNew={() => openTab("")} />
      {/* browser */}
      <motion.section aria-label="Browser" id="continuum-browser-window" data-resizing={browserWidth.resizing}
        style={{ left: browserWidth.bounds.x, width: browserWidth.bounds.w }}
        initial={{ opacity: 0, y: 14 }} animate={minimized ? { opacity: 0, y: 30, scale: 0.97 } : { opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
        className={`absolute top-[56px] bottom-[76px] md:top-[7.5%] md:bottom-auto md:h-[82%] rounded-[12px] flex flex-col bg-[#f4f5f7] shadow-[0_24px_60px_-24px_rgba(30,40,70,.35),0_0_0_1px_rgba(30,40,70,.08)] ${minimized ? "pointer-events-none" : ""}`}>
        {browserWidth.handles}
        <div className="browser-window-content h-full min-h-0 w-full flex flex-col rounded-[12px] overflow-hidden">
        <div className="flex items-center gap-1 px-2.5 h-[34px] bg-[#f4f5f7] shrink-0">
          <Tb label="Back" testid="button-back" disabled={!active || active.idx === 0} onClick={() => go(-1)}><ChevronLeft className="size-4" /></Tb>
          <Tb label="Forward" testid="button-forward" disabled={!active || active.idx >= active.history.length - 1} onClick={() => go(1)}><ChevronRight className="size-4" /></Tb>
          <Tb label="Reload" testid="button-reload" disabled={!cur} onClick={() => setReloadTick((n) => n + 1)}><RotateCw className="size-3.5" /></Tb>
          <AddressCapsule selecting={drawing} onCancel={() => setDrawing(false)}>
          <form className="relative min-w-0 w-full" onSubmit={(e) => { e.preventDefault(); submitAddress(addr); }}>
            <div className={`flex items-center gap-2 h-[24px] px-3 rounded-full bg-[#e8eaed] transition-shadow ${addrFocus ? "bg-white shadow-[0_0_0_1.5px_#9db7e8]" : ""}`}>
              <Search className="size-3.5 text-[#5f6368] shrink-0" />
              <input ref={addrRef} aria-label="Address" data-testid="input-address" spellCheck={false}
                value={addrFocus ? addr : shownUrl} placeholder="Search Wikipedia or enter a wikipedia.org address"
                onFocus={(e) => { setAddrFocus(true); setAddr(shownUrl); requestAnimationFrame(() => e.target.select()); }}
                onBlur={() => setTimeout(() => setAddrFocus(false), 140)} onChange={(e) => setAddr(e.target.value)}
                className="flex-1 min-w-0 bg-transparent outline-none text-[12.5px] text-[#202124] placeholder:text-[#80868b]" />
            </div>
            {addrFocus && addr !== shownUrl && <SuggestList text={addr} onPick={(t) => { navigate(t); setAddrFocus(false); addrRef.current?.blur(); }} testid="list-address-suggest" />}
          </form>
          </AddressCapsule>
          <Tb label="Minimize browser" testid="button-minimize" onClick={() => setMinimized(true)}><Minus className="size-3.5" /></Tb>
          <Tb label="Close tab" testid="button-close-current" disabled={!active} onClick={() => active && closeTab(active.key)}><X className="size-3.5" /></Tb>
        </div>

        <div ref={areaRef} id="browser-article-panel" role={active ? "tabpanel" : "region"} aria-labelledby={active ? `header-tab-${active.key}` : undefined} aria-label={!active ? "Browser content" : undefined} className="relative flex-1 min-h-0 bg-white rounded-t-[6px] overflow-hidden">
          {!active ? (
            <div className="h-full grid place-items-center text-center p-6" data-testid="status-no-tabs">
              <div>
                <p className="font-wikiserif text-[22px] text-[#202122]">All tabs are closed.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {closed.length > 0 && <button onClick={reopen} className="h-8 px-3 rounded-full bg-[#1d1f24] text-white text-[13px]" data-testid="button-reopen">Reopen last tab</button>}
                  {INITIAL.map((t) => <button key={t} onClick={() => openTab(t)} className="h-8 px-3 rounded-full border border-[#d5d8de] text-[13px] hover:bg-[#f4f5f7]">{t === NEWS_ENTRY ? "Jensen Huang" : t}</button>)}
                </div>
              </div>
            </div>
          ) : searchQuery !== null ? (
            <WikiSearchPage key={`${active.key}-${searchQuery}`} query={searchQuery} reloadTick={reloadTick} onNavigate={navigate} onSearch={search} onToggleContents={() => setContentsOpen((v) => !v)} />
          ) : isNews ? <NewsPage key={`${active.key}-${reloadTick}`} onNavigate={navigate} /> : title ? (
            <WikiPage key={active.key} title={title} hash={hash} reloadTick={reloadTick} contentsOpen={contentsOpen} onToggleContents={() => setContentsOpen((v) => !v)} reader={reader}
              onNavigate={navigate} onSearch={search} onResolved={(t) => setNames((n) => (n[active.key]?.entry === cur && n[active.key]?.title === t ? n : { ...n, [active.key]: { entry: cur, title: t } }))} />
          ) : <NewTabPage key={active.key} onNavigate={navigate} onSearch={search} />}

          {active && title && loadedArticle && (
            <RegionSelect drawing={drawing} rect={rect} setRect={setRect} onDrawEnd={finishSelection} isVideo={isNews} onAdjustEnd={isNews ? finishSelection : undefined}
              onVisualize={() => revealPortal(rect)} onExpand={() => { if (portalReady && portalOn) openCell(); else revealPortal(rect); }}
              onClear={clearSelection} />
          )}
          <AnimatePresence>
            {active && title && portalAnchor && portalOn && portalMatches && !drawing && (
              <CellPortal key={`portal-${portalRun}-${documentIdentity}`} model={model} topic={loadedArticle.title} anchor={portalAnchor} expanded={cellOpen}
                videoSelection={videoSelection} onReady={() => setPortalReady(true)} onExpand={openCell} onCollapse={collapseCell} onClose={closePortal} />
            )}
          </AnimatePresence>
        </div>
        </div>
      </motion.section>

      {/* bottom command input */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-[14px] w-[min(92vw,max(300px,28vw))] z-40">
        <AnimatePresence>
          {helpOpen && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="absolute bottom-full mb-2 left-0 right-0 rounded-2xl bg-white/95 backdrop-blur border border-[#e3e5ea] shadow-[0_12px_32px_-14px_rgba(30,40,70,.35)] p-3" data-testid="panel-command">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-[#80868b]">Supported commands</span>
                <button aria-label="Close" onClick={() => setHelpOpen(false)} className="text-[#80868b] hover:text-[#1d1f24]"><X className="size-3.5" /></button>
              </div>
                <ul className="space-y-1">{HELP.map(([c, d]) => <li key={c} className="flex gap-2 text-[12.5px]"><code className="font-mono text-[#1d1f24] shrink-0">{c}</code><span className="text-[#6b7280] truncate">— {d}</span></li>)}
                  <li className="pt-1 text-[11.5px] text-[#80868b]">These are fixed commands, not an AI assistant.</li></ul>
            </motion.div>
          )}
        </AnimatePresence>
        <form onSubmit={runCommand} className="flex items-center gap-2 h-[38px] pl-4 pr-1.5 rounded-full bg-white shadow-[0_6px_20px_-8px_rgba(30,40,70,.28),0_0_0_1px_rgba(30,40,70,.06)]">
          <input value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder="ask googol anything" aria-label="Command" data-testid="input-command"
            onFocus={() => !cmd && setCmdMsg("Type help to see supported commands")} className="flex-1 min-w-0 bg-transparent outline-none text-[13.5px] text-[#1d1f24] placeholder:text-[#9aa0a6]" />
          <button type="button" onClick={() => (drawing ? setDrawing(false) : startSelect())} aria-pressed={drawing} aria-label="Select a region" title="Select a region" data-testid="button-select-region"
            className={`grid place-items-center size-7 rounded-full transition ${drawing ? "bg-[#2f6fe0] text-white" : "text-[#5f6368] hover:bg-[#f0f2f5]"}`}>
            <ScanSearch className="size-4" />
          </button>
        </form>
        <AnimatePresence>
          {cmdMsg && !helpOpen && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute left-0 right-0 -top-6 text-center text-[11.5px] text-[#5f6368]" data-testid="status-command">{cmdMsg}</motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Tb({ children, label, onClick, disabled, testid }: { children: ReactNode; label: string; onClick: () => void; disabled?: boolean; testid: string }) {
  return (
    <button aria-label={label} title={label} data-testid={testid} disabled={disabled} onClick={onClick}
      className="grid place-items-center size-[24px] rounded-md text-[#5f6368] hover:bg-[#e3e5e8] active:scale-95 transition disabled:opacity-35 disabled:pointer-events-none shrink-0">
      {children}
    </button>
  );
}
