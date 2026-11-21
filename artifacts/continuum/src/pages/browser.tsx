import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, RotateCw, X, Minus, Search } from "lucide-react";
import { WikiPage, NewTabPage, type NavFn } from "@/components/wiki/wiki-page";
import { WikiSearchPage } from "@/components/wiki/wiki-search-page";
import { ChromeSearchPage } from "@/components/chrome/chrome-search-page";
import { SuggestList } from "@/components/wiki/search-suggest";
import { RegionSelect, type ExternalMarqueeStart, type Rect } from "@/components/browser/region-select";
import { CellPortal } from "@/components/browser/cell-portal";
import { CellViewer } from "@/components/cell/cell-viewer";
import { AddressCapsule } from "@/components/browser/address-capsule";
import { BrowserTabs, type HeaderTabKind } from "@/components/browser/browser-tabs";
import { useBrowserWidth } from "@/components/browser/browser-width";
import { CommandDock, type Gemini4Answer } from "@/components/browser/command-dock";
import {
  titleFromUrl,
  wikiUrl,
  wikiSearchUrl,
  googleSearchUrl,
  normTitle,
  looksLikeUrl,
  searchEntry,
  searchFromEntry,
  chromeSearchEntry,
  chromeSearchFromEntry,
} from "@/lib/wiki";
import { INITIAL_ARTICLES } from "@/data/articles";
import { useReaderSettings } from "@/hooks/use-reader-settings";
import { getGetWikiArticleQueryKey, useGetWikiArticle } from "@workspace/api-client-react";
import { MODEL_INFO, modelFromView, type ModelId } from "@/lib/model-catalog";
import { EXHIBIT_MEDIA, NEWS_ENTRY, VISUALIZATION_INFO, resolveVisualization, type VisualizationId } from "@/lib/visualizations";
import {
  EIFFEL_ELEVATION_PLATE_SRC,
  normalizeSearchIntent,
  pickBestImageForMarquee,
  resolveChromeVisualization,
  type BoxRect,
} from "@/lib/chrome-search";
import { clipsForRegion, type ClipSelection } from "@/lib/jensen-clips";
import { extractSelectedRegionContext } from "@/lib/region-extract";
import { MarsViewer } from "@/components/exhibits/mars-viewer";
import { EiffelViewer } from "@/components/exhibits/eiffel-viewer";
import {
  GenieWorldViewer,
  type GenieStatus,
  type GenieWorldController,
  type GenieWorldLaunchRequest,
} from "@/components/exhibits/genie-world-viewer";
import {
  MARS_GENIE_PRESETS,
  compressImageUrlToGenieJpeg,
  isMarsWorldContext,
  type MarsGeniePreset,
} from "@/lib/mars-genie-presets";
import {
  NewsHeaderCapsules,
  NewsPage,
  type NewsStreamSession,
} from "@/components/exhibits/news-page";

interface Tab { key: number; history: string[]; idx: number }
const INITIAL = INITIAL_ARTICLES;
let keySeq = 10;
const split = (e: string) => { const i = e.indexOf("#"); return i < 0 ? { title: e, hash: undefined } : { title: e.slice(0, i), hash: e.slice(i + 1) }; };
const entry = (t: string, hash?: string) => (hash ? `${normTitle(t)}#${hash}` : normTitle(t));

const HELP: [string, string][] = [
  ["Ask anything", "routed to Gemini 4 Argon or Hydrogen"],
  ["jensen news", "open a new tab & stream live sourced briefing"],
  ["genie <scene>", "generate a live Genie 4 interactive world"],
  ["open Plant cell", "open an article by title"],
  ["search beaver dam", "search Wikipedia articles"],
  ["select", "box-select text or images for 3D / Genie 4"],
  ["back / forward / reload / close tab", "browser actions"],
];

export default function Browser({ newsRoute = false }: { newsRoute?: boolean }) {
  const [standalone, setStandalone] = useState<ModelId | "mars" | "eiffel" | null>(() => {
    const view = new URLSearchParams(window.location.search).get("view");
    return view === "mars" ? "mars" : view === "eiffel" ? "eiffel" : modelFromView(view);
  });
  const [tabs, setTabs] = useState<Tab[]>(() => INITIAL.map((t, i) => ({ key: i + 1, history: [t], idx: 0 })));
  const [activeKey, setActiveKey] = useState(() => newsRoute ? 4 : 1);
  const [names, setNames] = useState<Record<number, { entry: string; title: string }>>({});
  const [closed, setClosed] = useState<Tab[]>([]);
  const [reloadTick, setReloadTick] = useState(0);
  const [contentsOpen, setContentsOpen] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [externalDrag, setExternalDrag] = useState<ExternalMarqueeStart | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [portalOn, setPortalOn] = useState(false);
  const [portalAnchor, setPortalAnchor] = useState<Rect | null>(null);
  const [portalRun, setPortalRun] = useState(0);
  const [portalReady, setPortalReady] = useState(false);
  const [cellOpen, setCellOpen] = useState(false);
  const [portalDocument, setPortalDocument] = useState("");
  const [videoSelection, setVideoSelection] = useState<ClipSelection>();
  const [eiffelExhibition, setEiffelExhibition] = useState<{ sourceRect: BoxRect; imageSrc: string } | null>(null);
  const [genieWorld, setGenieWorld] = useState<GenieWorldLaunchRequest | null>(null);
  const [genieStatus, setGenieStatus] = useState<GenieStatus>("building");
  const [marsLoadEpoch, setMarsLoadEpoch] = useState(0);
  const [marsLoadBlur, setMarsLoadBlur] = useState(18);
  const [newsStreams, setNewsStreams] = useState<Record<number, NewsStreamSession>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<Gemini4Answer | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const addrRef = useRef<HTMLInputElement>(null);
  const genieRef = useRef<GenieWorldController | null>(null);
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
  const chromeQuery = chromeSearchFromEntry(cur);
  const searchQuery = chromeQuery === null ? searchFromEntry(cur) : null;
  const { title, hash } = split(searchQuery === null && chromeQuery === null ? cur : "");
  const isNews = title === NEWS_ENTRY;
  // Observe the SAME query as WikiPage without fetching twice. Tab display
  // names are not proof that this document has successfully loaded.
  const articleQuery = useGetWikiArticle({ title }, { query: {
    queryKey: getGetWikiArticleQueryKey({ title }), enabled: false,
  } });
  const loadedArticle = isNews ? { title: "Jensen Huang" } : searchQuery === null && chromeQuery === null && title ? articleQuery.data : undefined;
  const portalSubject = chromeQuery !== null
    ? normalizeSearchIntent(chromeQuery).effectiveQuery || chromeQuery
    : loadedArticle?.title ?? title;
  const model = chromeQuery !== null
    ? resolveChromeVisualization(chromeQuery)
    : resolveVisualization(loadedArticle?.title, title);
  const canSelectRegion = Boolean((title && loadedArticle) || chromeQuery !== null);
  const documentIdentity = `${active?.key ?? ""}:${cur}:${reloadTick}:${chromeQuery !== null ? "chrome" : loadedArticle?.title ?? ""}`;
  const portalMatches = portalDocument === documentIdentity && (chromeQuery !== null || !!loadedArticle);
  const resolvedTitle = active && names[active.key]?.entry === cur ? names[active.key].title : title;
  const shownUrl = isNews
    ? NEWS_ENTRY
    : chromeQuery !== null
      ? googleSearchUrl(chromeQuery)
      : searchQuery !== null
        ? wikiSearchUrl(searchQuery)
        : title
          ? wikiUrl(resolvedTitle, hash)
          : "";

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
    setRect(null); setDrawing(false); setExternalDrag(null); setPortalAnchor(null);
    setPortalOn(false); setPortalReady(false); setCellOpen(false); setEiffelExhibition(null); setGenieWorld(null);
  }, [cur, activeKey, reloadTick, loadedArticle?.title]);
  useEffect(() => { if (standalone) document.title = `${VISUALIZATION_INFO[standalone].title} — Interactive 3D`; }, [standalone]);
  useEffect(() => { if (isNews) document.title = "Jensen Huang: Relationships and Recent News"; }, [isNews]);
  useEffect(() => { if (!title && searchQuery === null && chromeQuery === null) document.title = "New tab"; }, [title, searchQuery, chromeQuery]);

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
  const chromeSearch = (query: string) => {
    const value = query.trim();
    if (!value) return;
    if (value.length > 250) { say("Search using 250 characters or fewer."); return; }
    const e = chromeSearchEntry(value);
    if (active) pushEntry(active.key, e); else openTab(e);
    setMinimized(false);
  };
  const submitAddress = (raw: string) => {
    const s = raw.trim(); if (!s) return;
    const localPath = `${import.meta.env.BASE_URL.replace(/\/$/, "")}${NEWS_ENTRY}`;
    if (s === NEWS_ENTRY || s === NEWS_ENTRY.slice(1) || s === `${window.location.origin}${localPath}`) {
      navigate(NEWS_ENTRY); setAddrFocus(false); addrRef.current?.blur(); return;
    }
    const u = titleFromUrl(s);
    if (u) navigate(u.title, { hash: u.hash });
    else if (looksLikeUrl(s)) say("Only English Wikipedia article URLs open inside googol.");
    else chromeSearch(s);
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
    setRect(null); setExternalDrag(null); setPortalAnchor(null); setPortalOn(false); setPortalReady(false); setCellOpen(false);
  };
  const startSelect = () => {
    if (!canSelectRegion) { say(title ? "Wait for the Wikipedia article to load before selecting a region." : "Open a Wikipedia article or Google search page first."); return; }
    clearSelection(); setDrawing(true); setCellOpen(false); setMinimized(false);
  };
  const startImageMarquee = (drag: ExternalMarqueeStart) => {
    if (!canSelectRegion) return;
    clearSelection();
    setDrawing(true);
    setExternalDrag(drag);
    setCellOpen(false);
    setMinimized(false);
  };
  const launchGenieFromSelection = useCallback(
    (selection: Rect | null, customPrompt?: string) => {
      const b = areaRef.current?.getBoundingClientRect();
      const pageLabel = portalSubject || resolvedTitle || "Web page";
      const viewportSelection =
        selection && b
          ? { x: selection.x + b.left, y: selection.y + b.top, w: selection.w, h: selection.h }
          : b
            ? { x: b.left, y: b.top, w: b.width, h: Math.min(b.height, 420) }
            : { x: 0, y: 0, w: 0, h: 0 };

      const extracted = extractSelectedRegionContext(areaRef.current, viewportSelection, pageLabel);
      setRect(null);
      setDrawing(false);
      setExternalDrag(null);
      setPortalOn(false);
      setCellOpen(false);
      setGenieStatus("building");
      setMarsLoadBlur(18);
      setMarsLoadEpoch((n) => n + 1);
      setGenieWorld({
        selectedText: extracted.selectedText,
        imageAlt: extracted.imageAlt,
        referenceImageBase64: extracted.referenceImageBase64,
        pageTitle: pageLabel,
        sourceLabel: customPrompt ? customPrompt.slice(0, 72) : extracted.sourceLabel,
        customPrompt,
      });
    },
    [portalSubject, resolvedTitle],
  );

  const switchMarsPreset = useCallback(async (preset: MarsGeniePreset) => {
    setGenieStatus("building");
    setMarsLoadBlur(18);
    setMarsLoadEpoch((n) => n + 1);
    const seedJpeg = await compressImageUrlToGenieJpeg(preset.imageUrl);
    setGenieWorld({
      selectedText: preset.worldPrompt,
      imageAlt: preset.ariaLabel,
      referenceImageBase64: seedJpeg,
      pageTitle: "Mars",
      sourceLabel: preset.ariaLabel,
      exactWorldPrompt: preset.worldPrompt,
      presetId: preset.id,
    });
  }, []);

  // Synchronize progressive unblurring on the 4 Mars preview tabs with Genie 4 loading
  useEffect(() => {
    if (!genieWorld) {
      setMarsLoadBlur(18);
      return;
    }
    if (genieStatus !== "building") {
      setMarsLoadBlur(0);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      // Gradually sharpen from 18px -> ~6.2px while the world builds, then snap-clear to 0px once live
      const decay = 6.2 + 11.8 * Math.exp(-elapsed / 2900);
      const breath = 0.65 * Math.sin(elapsed / 360);
      setMarsLoadBlur(Math.max(5.5, decay + breath));
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [genieWorld, genieStatus, marsLoadEpoch]);

  const revealPortal = (selection: Rect | null) => {
    if (!canSelectRegion || !selection || selection.w < 40 || selection.h < 40) return;
    const b = areaRef.current?.getBoundingClientRect();
    const absoluteSelection = { ...selection, x: selection.x + (b?.left ?? 0), y: selection.y + (b?.top ?? 0) };

    if (chromeQuery !== null && model === "eiffel") {
      const container = areaRef.current;
      let sourceRect: BoxRect = absoluteSelection;
      if (container) {
        const candidates = Array.from(container.querySelectorAll<HTMLElement>("[data-eiffel-selectable]"))
          .map((el) => {
            const img = el.querySelector<HTMLImageElement>("img");
            const target = img ?? el;
            const r = target.getBoundingClientRect();
            return {
              el,
              img,
              rect: { x: r.left, y: r.top, w: r.width, h: r.height },
            };
          })
          .filter((c) => c.rect.w > 10 && c.rect.h > 10);

        const matched = pickBestImageForMarquee(absoluteSelection, candidates);
        if (matched) {
          sourceRect = matched.rect;
        } else {
          const plateImg = container.querySelector<HTMLImageElement>('[data-eiffel-plate-img="true"]');
          if (plateImg) {
            const pr = plateImg.getBoundingClientRect();
            if (pr.width > 10 && pr.height > 10) {
              sourceRect = { x: pr.left, y: pr.top, w: pr.width, h: pr.height };
            }
          }
        }
      }
      setRect(null);
      setDrawing(false);
      setExternalDrag(null);
      setPortalOn(false);
      setEiffelExhibition({
        sourceRect,
        imageSrc: EIFFEL_ELEVATION_PLATE_SRC,
      });
      return;
    }

    // Any page/content without a bespoke exhibit launches a real Genie 4 world model
    // from the user's selected text & image context.
    if (model === null) {
      launchGenieFromSelection(selection);
      return;
    }

    setVideoSelection(model === "jensen-video" && areaRef.current ? clipsForRegion(areaRef.current, absoluteSelection) : undefined);
    setPortalDocument(documentIdentity);
    setCellOpen(false);
    setPortalAnchor(absoluteSelection); setPortalReady(false); setPortalRun((n) => n + 1); setPortalOn(true);
  };
  const finishSelection = (selection: Rect | null) => {
    setDrawing(false);
    setExternalDrag(null);
    if (selection) revealPortal(selection);
    else clearSelection();
  };
  const openPortalForElement = (el: HTMLElement) => {
    const containerRect = areaRef.current?.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    if (!containerRect) return;
    const localRect: Rect = {
      x: Math.max(0, elRect.left - containerRect.left),
      y: Math.max(0, elRect.top - containerRect.top),
      w: Math.max(48, elRect.width),
      h: Math.max(48, elRect.height),
    };
    setRect(localRect);
    revealPortal(localRect);
  };

  const askGemini4 = async (rawPrompt: string) => {
    setAiLoading(true);
    setAiError(null);
    setAiAnswer(null);
    setHelpOpen(false);

    let selectedContext = "";
    if (rect && areaRef.current) {
      const b = areaRef.current.getBoundingClientRect();
      const extracted = extractSelectedRegionContext(
        areaRef.current,
        { x: rect.x + b.left, y: rect.y + b.top, w: rect.w, h: rect.h },
        portalSubject || resolvedTitle,
      );
      selectedContext = [extracted.imageAlt, extracted.selectedText].filter(Boolean).join(" — ");
    }

    try {
      const res = await fetch("/api/ai/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: rawPrompt,
          pageTitle: portalSubject || resolvedTitle,
          pageUrl: shownUrl,
          selectedContext,
        }),
      });
      const data = (await res.json()) as {
        answer?: string;
        model?: "gemini-4-argon" | "gemini-4-hydrogen";
        modelLabel?: string;
        reason?: string;
        error?: string;
      };
      if (!res.ok || !data.answer || !data.model) {
        throw new Error(data.error || "Gemini 4 request failed.");
      }
      setAiAnswer({
        prompt: rawPrompt,
        answer: data.answer,
        model: data.model,
        modelLabel: data.modelLabel || (data.model === "gemini-4-argon" ? "Gemini 4 Argon" : "Gemini 4 Hydrogen"),
        reason: data.reason || "",
      });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Failed to reach Gemini 4.");
    } finally {
      setAiLoading(false);
    }
  };

  const openStreamingJensenNewsTab = (rawPrompt: string) => {
    const useHydrogen = /^(?:@hydrogen|\/hydrogen)\b/i.test(rawPrompt);
    const cleanPrompt =
      rawPrompt.replace(/^(?:@(?:argon|hydrogen)|\/(?:argon|hydrogen))\s+/i, "").trim() ||
      rawPrompt;
    const k = ++keySeq;
    setNewsStreams((prev) => ({
      ...prev,
      [k]: {
        runId: Date.now() + k,
        prompt: cleanPrompt,
        model: useHydrogen ? "gemini-4-hydrogen" : "gemini-4-argon",
        modelLabel: useHydrogen ? "Gemini 4 Hydrogen" : "Gemini 4 Argon",
      },
    }));
    setAiAnswer(null);
    setAiError(null);
    setGenieWorld(null);
    setMinimized(false);
    setTabs((ts) => [...ts, { key: k, history: [NEWS_ENTRY], idx: 0 }]);
    setActiveKey(k);
  };

  const runPromptOrCommand = (rawInput: string) => {
    const raw = rawInput.trim();
    const s = raw.toLowerCase();
    if (!raw) return;
    setHelpOpen(false);
    if (s === "help" || s === "?") { setAiAnswer(null); setAiError(null); setHelpOpen(true); return; }

    // "jensen news" opens a new tab and live-streams the sourced Gemini 4 briefing in < 5s
    if (
      /^(?:@(?:argon|hydrogen)\s+|\/(?:argon|hydrogen)\s+)?(?:(?:generate|write|show|latest|open|read)\s+)?(?:jensen(?:\s+huang)?\s+(?:news|briefing|report|article|timeline)|(?:news|briefing|report|article)\s+(?:on\s+|about\s+|for\s+)?jensen(?:\s+huang)?|黄仁勋\s*(?:新闻|最新新闻|报道|简报))$/i.test(
        raw,
      )
    ) {
      openStreamingJensenNewsTab(raw);
      return;
    }

    if (genieWorld) {
      if (/^(?:exit|close|close world|return|browser|返回|退出)$/.test(s)) {
        setGenieWorld(null);
        return;
      }
      const geniePrefix = raw.match(/^(?:genie|genie 4|world|生成世界|世界模型)\s+(.+)$/i);
      genieRef.current?.steer(geniePrefix ? geniePrefix[1].trim() : raw);
      return;
    }

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

    let m = raw.match(/^(?:genie|genie 4|world|生成世界|世界模型)\s+(.+)$/i);
    if (m) {
      launchGenieFromSelection(rect, m[1].trim());
      return;
    }
    m = raw.match(/^new tab\s+(.+)$/i) ?? raw.match(/^open\s+(.+?)\s+in (?:a )?new tab$/i);
    if (m) {
      const u = titleFromUrl(m[1]);
      if (!u && looksLikeUrl(m[1])) { say("Only English Wikipedia article URLs open inside googol."); return; }
      openTab(entry(u?.title ?? m[1], u?.hash)); return;
    }
    m = raw.match(/^(?:search|find)\s+(.+)$/i);
    if (m) { search(m[1]); return; }
    m = raw.match(/^(?:open|go to|goto|read|visit)\s+(.+)$/i);
    if (m) {
      const target = m[1];
      const u = titleFromUrl(target);
      if (u) { navigate(u.title, { hash: u.hash }); return; }
      if (looksLikeUrl(target)) { say("Only English Wikipedia article URLs open inside googol."); return; }
      navigate(target); say(`Opening “${target}”`);
      return;
    }
    const directUrl = titleFromUrl(raw);
    if (directUrl) { navigate(directUrl.title, { hash: directUrl.hash }); return; }
    if (looksLikeUrl(raw)) { say("Only English Wikipedia article URLs open inside googol."); return; }

    // Natural language prompt -> intelligent Gemini 4 Argon / Hydrogen routing
    void askGemini4(raw);
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (genieWorld) {
          setGenieWorld(null);
        } else if (eiffelExhibition) {
          setEiffelExhibition(null);
        } else if (cellOpen) collapseCell();
        else if (aiAnswer || aiError) {
          setAiAnswer(null);
          setAiError(null);
        } else {
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
          : standalone === "eiffel"
          ? <EiffelViewer onClose={() => { window.history.replaceState(null, "", window.location.pathname); setStandalone(null); }} />
          : <CellViewer key={standalone} model={standalone} onClose={() => { window.history.replaceState(null, "", window.location.pathname); setStandalone(null); }} />}
      </div>
    );
  }

  const tabKind = (t: Tab): HeaderTabKind => {
    const e = t.history[t.idx];
    if (!e) return "empty";
    if (split(e).title === NEWS_ENTRY) return "news";
    if (chromeSearchFromEntry(e) !== null) return "google";
    return "wiki";
  };
  const tabLabel = (t: Tab) => {
    const e = t.history[t.idx]; if (!e) return "New tab";
    if (split(e).title === NEWS_ENTRY) return "Jensen Huang — Briefing";
    const chromeQ = chromeSearchFromEntry(e);
    if (chromeQ !== null) return `${chromeQ} - Google Search`;
    const query = searchFromEntry(e);
    if (query !== null) return `${query} — Wikipedia search`;
    return `${names[t.key]?.entry === e ? names[t.key].title : split(e).title} — Wikipedia`;
  };

  const browserHidden = minimized || Boolean(genieWorld);
  const isNewsWindow = Boolean(active && isNews);

  return (
    <div className="desk relative min-h-[100dvh] h-[100dvh] w-full overflow-hidden" data-testid="desktop">
      {/* tabs outside browser */}
      <BrowserTabs tabs={tabs.map((t) => ({ key: t.key, label: tabLabel(t), empty: !t.history[t.idx], kind: tabKind(t) }))}
        activeKey={activeKey} minimized={minimized} onSelect={(key) => { setGenieWorld(null); setActiveKey(key); setMinimized(false); }}
        onClose={closeTab} onNew={() => { setGenieWorld(null); openTab(""); }} />
      {/* browser */}
      <motion.section aria-label="Browser" id="continuum-browser-window" data-resizing={browserWidth.resizing}
        inert={genieWorld ? true : undefined}
        style={{ left: browserWidth.bounds.x, width: browserWidth.bounds.w }}
        initial={{ opacity: 0, y: 14 }} animate={browserHidden ? { opacity: 0, y: minimized ? 30 : 8, scale: 0.985 } : { opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
        className={`absolute top-[56px] bottom-[76px] md:top-[7.5%] md:bottom-auto md:h-[82%] rounded-[12px] flex flex-col ${isNewsWindow ? "bg-white" : "bg-[#f4f5f7]"} shadow-[0_24px_60px_-24px_rgba(30,40,70,.35),0_0_0_1px_rgba(30,40,70,.08)] ${browserHidden ? "pointer-events-none" : ""}`}>
        {browserWidth.handles}
        <div className="browser-window-content h-full min-h-0 w-full flex flex-col rounded-[12px] overflow-hidden">
        {isNewsWindow ? (
          <div className="flex items-center gap-2 px-3 h-[36px] bg-white shrink-0">
            <div className="hidden sm:block w-[52px] shrink-0" aria-hidden />
            <AddressCapsule selecting={drawing} onCancel={() => setDrawing(false)}>
              <NewsHeaderCapsules
                key={`${active.key}-${newsStreams[active.key]?.runId ?? 0}`}
                streamSession={newsStreams[active.key]}
              />
            </AddressCapsule>
            <div className="flex items-center gap-1 shrink-0">
              <Tb label="Minimize browser" testid="button-minimize" onClick={() => setMinimized(true)}><Minus className="size-3.5" /></Tb>
              <Tb label="Close tab" testid="button-close-current" disabled={!active} onClick={() => active && closeTab(active.key)}><X className="size-3.5" /></Tb>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1 px-2.5 h-[34px] bg-[#f4f5f7] shrink-0">
            <Tb label="Back" testid="button-back" disabled={!active || active.idx === 0} onClick={() => go(-1)}><ChevronLeft className="size-4" /></Tb>
            <Tb label="Forward" testid="button-forward" disabled={!active || active.idx >= active.history.length - 1} onClick={() => go(1)}><ChevronRight className="size-4" /></Tb>
            <Tb label="Reload" testid="button-reload" disabled={!cur} onClick={() => setReloadTick((n) => n + 1)}><RotateCw className="size-3.5" /></Tb>
            <AddressCapsule selecting={drawing} onCancel={() => setDrawing(false)}>
            <form className="relative min-w-0 w-full" onSubmit={(e) => { e.preventDefault(); submitAddress(addr); }}>
              <div className={`flex items-center gap-2 h-[24px] px-3 rounded-full bg-[#e8eaed] transition-shadow ${addrFocus ? "bg-white shadow-[0_0_0_1.5px_#9db7e8]" : ""}`}>
                <Search className="size-3.5 text-[#5f6368] shrink-0" />
                <input ref={addrRef} aria-label="Address" data-testid="input-address" spellCheck={false}
                  value={addrFocus ? addr : shownUrl} placeholder="Search Google or type a URL"
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
        )}

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
          ) : chromeQuery !== null ? (
            <ChromeSearchPage
              key={`${active.key}-chrome-${chromeQuery}`}
              query={chromeQuery}
              reloadTick={reloadTick}
              onChromeSearch={chromeSearch}
              onNavigate={navigate}
              onOpenStandalone={(m: VisualizationId) => setStandalone(m === "jensen-video" ? null : m)}
              onStartMarquee={startImageMarquee}
              onOpenPortalCenter={openPortalForElement}
            />
          ) : searchQuery !== null ? (
            <WikiSearchPage key={`${active.key}-${searchQuery}`} query={searchQuery} reloadTick={reloadTick} onNavigate={navigate} onSearch={search} onToggleContents={() => setContentsOpen((v) => !v)} />
          ) : isNews ? (
            <NewsPage
              key={`${active.key}-${reloadTick}-${newsStreams[active.key]?.runId ?? 0}`}
              streamSession={newsStreams[active.key]}
              onNavigate={navigate}
            />
          ) : title ? (
            <WikiPage key={active.key} title={title} hash={hash} reloadTick={reloadTick} contentsOpen={contentsOpen} onToggleContents={() => setContentsOpen((v) => !v)} reader={reader}
              onNavigate={navigate} onSearch={search} onResolved={(t) => setNames((n) => (n[active.key]?.entry === cur && n[active.key]?.title === t ? n : { ...n, [active.key]: { entry: cur, title: t } }))} />
          ) : <NewTabPage key={active.key} onNavigate={navigate} onSearch={search} />}

          {active && canSelectRegion && (
            <RegionSelect drawing={drawing} rect={rect} setRect={setRect} onDrawEnd={finishSelection} isVideo={isNews} onAdjustEnd={isNews ? finishSelection : undefined}
              externalDrag={externalDrag} onExternalDragConsumed={() => setExternalDrag(null)}
              onVisualize={() => revealPortal(rect)} onExpand={() => { if (portalReady && portalOn) openCell(); else revealPortal(rect); }}
              onLaunchGenie={() => launchGenieFromSelection(rect)}
              onClear={clearSelection} />
          )}
          <AnimatePresence>
            {active && portalAnchor && portalOn && portalMatches && !drawing && !genieWorld && (
              <CellPortal key={`portal-${portalRun}-${documentIdentity}`} model={model} topic={portalSubject} anchor={portalAnchor} expanded={cellOpen}
                videoSelection={videoSelection} onReady={() => setPortalReady(true)} onExpand={openCell} onCollapse={collapseCell} onClose={closePortal} />
            )}
          </AnimatePresence>
        </div>
        </div>
      </motion.section>

      {/* In-Place Genie 4 Interactive World Panel + Left Mars Related World Preview Tabs */}
      <AnimatePresence>
        {genieWorld && isMarsWorldContext(genieWorld) && (
          <motion.nav
            key="mars-genie-presets"
            aria-label="Related Mars world models"
            data-testid="rail-mars-presets"
            data-loading={genieStatus === "building" ? "true" : "false"}
            style={{ left: 0, width: Math.max(84, browserWidth.bounds.x) }}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute top-[56px] bottom-[76px] md:top-[7.5%] md:bottom-auto md:h-[82%] z-[31] hidden sm:flex flex-col items-center justify-center gap-3 px-2.5"
          >
            {MARS_GENIE_PRESETS.map((preset) => {
              const isActive = genieWorld.presetId === preset.id;
              const isBuilding = genieStatus === "building";
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-label={preset.ariaLabel}
                  aria-pressed={isActive}
                  data-testid={`button-mars-preset-${preset.id}`}
                  onClick={() => void switchMarsPreset(preset)}
                  className={`mars-topic-tab pointer-events-auto max-w-[128px] ${isBuilding ? "is-loading" : ""}`}
                >
                  <div className="mars-topic-media">
                    <img
                      src={preset.imageUrl}
                      alt=""
                      draggable={false}
                      style={{
                        filter: isBuilding ? `blur(${marsLoadBlur.toFixed(2)}px) saturate(1.08)` : "blur(0px)",
                        transform: isBuilding
                          ? `scale(${(1 + marsLoadBlur * 0.006).toFixed(3)})`
                          : "scale(1)",
                      }}
                      className={`mars-topic-img h-full w-full object-cover ${isBuilding ? "is-loading" : ""}`}
                    />
                  </div>
                </button>
              );
            })}
          </motion.nav>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {genieWorld && (
          <motion.section
            key="genie-world-panel"
            aria-label={`Genie 4 interactive world — ${genieWorld.sourceLabel}`}
            data-testid="genie-world-overlay"
            style={{ left: browserWidth.bounds.x, width: browserWidth.bounds.w }}
            initial={{ opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.985 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="absolute top-[56px] bottom-[76px] md:top-[7.5%] md:bottom-auto md:h-[82%] z-30"
          >
            <GenieWorldViewer
              ref={genieRef}
              request={genieWorld}
              onClose={() => setGenieWorld(null)}
              onStatusChange={setGenieStatus}
            />
          </motion.section>
        )}
      </AnimatePresence>

      {/* Bottom Prompt Box: Gemini 4 (Argon / Hydrogen) + Live Genie Steering + Audio Detection + Region Select */}
      <CommandDock
        cmd={cmd}
        setCmd={setCmd}
        onSubmitPrompt={runPromptOrCommand}
        drawing={drawing}
        onToggleSelect={() => (drawing ? setDrawing(false) : startSelect())}
        helpOpen={helpOpen}
        setHelpOpen={setHelpOpen}
        helpEntries={HELP}
        cmdMsg={cmdMsg}
        onFocusHint={() =>
          !cmd &&
          setCmdMsg(
            genieWorld
              ? "Type any weather, lighting, or scene change to steer the Genie 4 world live"
              : "Ask Gemini 4 anything, type 'jensen news', or type help for browser commands",
          )
        }
        aiLoading={aiLoading}
        aiAnswer={aiAnswer}
        aiError={aiError}
        onDismissAi={() => { setAiAnswer(null); setAiError(null); }}
        onLaunchGenieFromPrompt={(prompt) => {
          setAiAnswer(null);
          launchGenieFromSelection(rect, prompt);
        }}
        worldActive={Boolean(genieWorld)}
      />

      {/* Eiffel Tower Archival Exhibition with CellPortal-style soft feathered blur edges (no hardcut border) */}
      {eiffelExhibition &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <motion.div
              key="eiffel-scrim"
              className="fixed inset-0 z-[88] bg-[#e9ece4]/38 backdrop-blur-[5px]"
              onClick={() => setEiffelExhibition(null)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              data-testid="eiffel-exhibition-scrim"
            />
            <div
              className="pointer-events-none fixed inset-0 z-[90] grid place-items-center p-4 sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-label="La Tour de 300 Mètres — 1884 to 1889 Exhibition"
              data-testid="eiffel-exhibition-overlay"
            >
              <div className="pointer-events-auto relative h-[min(88vh,860px)] w-[min(92vw,1320px)]">
                {/* Outer feathered blur halo matching CellPortal expanded window */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -inset-6 rounded-[48px] backdrop-blur-[12px] feather-ring-soft"
                />
                {/* Feathered 3D scene melts softly into the blurred desk while HUD & 1884 plate stay crisp */}
                <div className="absolute inset-0">
                  <EiffelViewer
                    feathered
                    transitionSource={eiffelExhibition}
                    autoStartFrom1884
                    onClose={() => setEiffelExhibition(null)}
                  />
                </div>
              </div>
            </div>
          </>,
          document.body,
        )}
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
