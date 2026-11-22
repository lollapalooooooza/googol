import { useEffect, useRef, useState, type PointerEvent as RPE } from "react";
import { getSearchWikiQueryKey, useSearchWiki } from "@workspace/api-client-react";
import {
  Search,
  X,
  Globe,
  ExternalLink,
  Image as ImageIcon,
  MoreVertical,
  ArrowRight,
  Share,
  Grip,
  Star,
  Cloud,
  CloudRain,
  CloudSun,
  Ticket,
  Navigation,
  Play,
  Images,
  Maximize2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { wikiUrl } from "@/lib/wiki";
import {
  EIFFEL_SPONSORED_TOURS,
  getCuratedChromeContent,
  normalizeSearchIntent,
  thumbUrl,
  type ChromeImageResult,
  type ChromeWebResult,
} from "@/lib/chrome-search";
import type { NavFn, SearchFn } from "@/components/wiki/wiki-page";
import type { VisualizationId } from "@/lib/visualizations";

type ChromeTab = "ai" | "all" | "images" | "videos" | "short" | "news" | "maps";

const BENTO_MOSAIC_PHOTOS = {
  hero: thumbUrl("18_completed_1889.jpg"),
  topRight: thumbUrl("36_great_arch.jpg"),
  bottomLeft: thumbUrl("01_second_platform.jpg"),
  bottomRight: thumbUrl("38_320.jpg"),
};

export function ChromeSearchPage({
  query,
  reloadTick,
  onChromeSearch,
  onNavigate,
  onOpenStandalone,
  onStartMarquee,
  onOpenPortalCenter,
  onGoHome,
}: {
  query: string;
  reloadTick: number;
  onChromeSearch: SearchFn;
  onNavigate: NavFn;
  onOpenStandalone: (model: VisualizationId) => void;
  onStartMarquee?: (start: { startX: number; startY: number; curX: number; curY: number }) => void;
  onOpenPortalCenter?: (rectEl: HTMLElement) => void;
  onGoHome?: () => void;
}) {
  const intent = normalizeSearchIntent(query);
  const curated = getCuratedChromeContent(intent);
  const [inputVal, setInputVal] = useState(query);
  const [activeTab, setActiveTab] = useState<ChromeTab>("all");
  const [entityTab, setEntityTab] = useState<"overview" | "tickets" | "reviews" | "events">("overview");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputVal(query);
    setActiveTab("all");
    setEntityTab("overview");
  }, [query]);

  useEffect(() => {
    document.title = `${query} - Google Search`;
  }, [query]);

  const wikiResultsQuery = useSearchWiki(
    { q: intent.effectiveQuery },
    {
      query: {
        queryKey: getSearchWikiQueryKey({ q: intent.effectiveQuery }),
        enabled: !!intent.effectiveQuery,
        staleTime: 60_000,
        retry: false,
      },
    },
  );
  const refetchRef = useRef(wikiResultsQuery.refetch);
  refetchRef.current = wikiResultsQuery.refetch;
  useEffect(() => {
    if (reloadTick > 0) void refetchRef.current();
  }, [reloadTick]);

  const seenWikiTitles = new Set(
    curated.results.map((r) => r.wikiTitle?.toLowerCase()).filter(Boolean),
  );
  const rawWikiResults = Array.isArray(wikiResultsQuery.data) ? wikiResultsQuery.data : [];
  const liveResults: ChromeWebResult[] = rawWikiResults
    .filter((w) => w && typeof w.title === "string" && !seenWikiTitles.has(w.title.toLowerCase()))
    .slice(0, 6)
    .map((w, i) => ({
      id: `wiki-live-${i}-${w.title}`,
      title: `${w.title} - Wikipedia`,
      displayUrl: `https://en.wikipedia.org › wiki › ${w.title.replace(/ /g, "_")}`,
      siteName: "Wikipedia",
      snippet: w.description || `Encyclopedia article covering ${w.title} on English Wikipedia.`,
      wikiTitle: w.title,
    }));

  const allResults = [...curated.results, ...liveResults];
  const filteredResults =
    activeTab === "news"
      ? allResults.filter((r) => r.newsEntry || /news|briefing|1889/i.test(r.title + r.snippet))
      : allResults;

  // Allow dragging a marquee selection box directly over any selectable image
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const handleImagePointerDown = (e: RPE<HTMLElement>) => {
    if (e.button !== 0 || !onStartMarquee) return;
    const startX = e.clientX;
    const startY = e.clientY;
    dragOriginRef.current = { x: startX, y: startY };

    const onMove = (ev: PointerEvent) => {
      if (!dragOriginRef.current) return;
      const dx = ev.clientX - dragOriginRef.current.x;
      const dy = ev.clientY - dragOriginRef.current.y;
      if (Math.hypot(dx, dy) >= 8) {
        cleanup();
        onStartMarquee({
          startX: dragOriginRef.current.x,
          startY: dragOriginRef.current.y,
          curX: ev.clientX,
          curY: ev.clientY,
        });
      }
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("pointercancel", cleanup);
  };

  const renderResultLink = (res: ChromeWebResult, index: number) => {
    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      if (res.wikiTitle) {
        const [title, hash] = res.wikiTitle.split("#");
        onNavigate(title, { hash, newTab: e.ctrlKey || e.metaKey });
      } else if (res.newsEntry) {
        onNavigate("/news/jensen-huang", { newTab: e.ctrlKey || e.metaKey });
      } else if (res.viewModel) {
        onOpenStandalone(res.viewModel);
      }
    };

    return (
      <article key={res.id} className="max-w-[652px]" data-testid={`chrome-result-${index}`}>
        <div className="flex items-center gap-2.5 text-[12px] leading-tight text-[#202124]">
          <span className="grid size-7 shrink-0 place-items-center rounded-full border border-[#dadce0] bg-[#f1f3f4] text-[#4d5156]">
            {res.siteName.startsWith("Wikipedia") ? (
              <span className="font-serif text-[13px] font-semibold">W</span>
            ) : (
              <Globe className="size-3.5" />
            )}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-normal text-[#202124]">{res.siteName}</div>
            <div className="truncate text-[12px] text-[#4d5156]">{res.displayUrl}</div>
          </div>
        </div>
        <h3 className="mt-1.5">
          <a
            href={res.wikiTitle ? wikiUrl(res.wikiTitle) : "#"}
            onClick={handleClick}
            data-testid={`link-chrome-result-${index}`}
            className="text-[20px] font-normal leading-[1.3] text-[#1a0dab] hover:underline visited:text-[#681da8]"
          >
            {res.title}
          </a>
        </h3>
        <p className="mt-1 text-[14px] leading-[1.58] text-[#4d5156]">{res.snippet}</p>
        {res.sitelinks && res.sitelinks.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
            {res.sitelinks.map((sl) => (
              <button
                key={sl.label}
                type="button"
                onClick={() => {
                  if (sl.wikiTitle) {
                    const [t, h] = sl.wikiTitle.split("#");
                    onNavigate(t, { hash: h });
                  } else if (sl.viewModel) {
                    onOpenStandalone(sl.viewModel);
                  }
                }}
                className="text-[#1a0dab] hover:underline"
              >
                {sl.label}
              </button>
            ))}
          </div>
        )}
      </article>
    );
  };

  const isEiffel = intent.matchedExhibit === "eiffel";
  const plateImage = curated.images.find((img) => img.id === "eiffel-plate") ?? null;
  const secondaryImages = curated.images.filter((img) => img.id !== "eiffel-plate");

  return (
    <div className="h-full overflow-y-auto bg-white text-[#202124]" data-testid="page-chrome-search">
      {/* Authentic Google Search Header */}
      <header className="sticky top-0 z-10 border-b border-[#ebebeb] bg-white pt-4">
        <div className="mx-auto flex max-w-[1220px] items-center gap-4 px-4 sm:px-7">
          <button
            type="button"
            onClick={() => (onGoHome ? onGoHome() : onChromeSearch("eiffel tower"))}
            aria-label="googol Search home"
            className="shrink-0 select-none font-sans text-[28px] font-medium tracking-[-0.04em] leading-none"
          >
            <span className="text-[#4285F4]">g</span>
            <span className="text-[#EA4335]">o</span>
            <span className="text-[#FBBC05]">o</span>
            <span className="text-[#4285F4]">g</span>
            <span className="text-[#34A853]">o</span>
            <span className="text-[#EA4335]">l</span>
          </button>

          <form
            role="search"
            aria-label="Search Google"
            className="flex h-[46px] min-w-[220px] flex-1 max-w-[692px] items-center gap-1.5 rounded-full border border-[#dfe1e5] bg-white pl-5 pr-2 shadow-[0_2px_8px_rgba(32,33,36,0.10)] hover:shadow-[0_2px_10px_rgba(32,33,36,0.16)] focus-within:shadow-[0_2px_10px_rgba(32,33,36,0.20)]"
            onSubmit={(e) => {
              e.preventDefault();
              const next = inputVal.trim();
              if (next) onChromeSearch(next);
            }}
          >
            <input
              ref={inputRef}
              type="search"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Search Google or type a URL"
              aria-label="Search query"
              data-testid="input-chrome-search"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-[#202124] outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {inputVal && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setInputVal("");
                  inputRef.current?.focus();
                }}
                className="grid size-8 place-items-center rounded-full text-[#4d5156] hover:bg-[#f1f3f4]"
              >
                <X className="size-4" />
              </button>
            )}
            <span className="mx-0.5 hidden h-5 w-px bg-[#dadce0] sm:block" aria-hidden="true" />
            <button
              type="button"
              aria-label="Search by voice"
              onClick={() => inputRef.current?.focus()}
              className="hidden size-8 place-items-center rounded-full text-[#4d5156] hover:bg-[#f1f3f4] sm:grid"
            >
              <GoogleMicIcon />
            </button>
            <button
              type="button"
              aria-label="Search by image"
              onClick={() => setActiveTab("images")}
              className="hidden size-8 place-items-center rounded-full text-[#4d5156] hover:bg-[#f1f3f4] sm:grid"
            >
              <GoogleLensIcon />
            </button>
            <button
              type="submit"
              aria-label="Search"
              data-testid="button-chrome-search"
              className="inline-flex h-[32px] items-center gap-1 rounded-full bg-[#f1f3f4] px-3 text-[13px] font-medium text-[#202124] hover:bg-[#e8eaed] whitespace-nowrap"
            >
              <span className="hidden sm:inline">AI Mode</span>
              <ArrowRight className="size-3.5 sm:inline hidden" />
              <Search className="size-4 sm:hidden text-[#4285F4]" />
            </button>
          </form>

          <div className="ml-auto hidden items-center gap-2 sm:flex">
            <button
              type="button"
              aria-label="Share search"
              className="grid size-9 place-items-center rounded-full text-[#5f6368] hover:bg-[#f1f3f4]"
            >
              <Share className="size-[18px]" />
            </button>
            <button
              type="button"
              aria-label="Google apps"
              className="grid size-9 place-items-center rounded-full text-[#5f6368] hover:bg-[#f1f3f4]"
            >
              <Grip className="size-[18px]" />
            </button>
            <span
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-full bg-[#1a73e8] text-[13px] font-medium text-white shadow-inner"
            >
              P
            </span>
          </div>
        </div>

        {/* Google SERP Navigation Tabs */}
        <nav
          aria-label="Search filters"
          className="mx-auto mt-3 flex max-w-[1220px] items-center gap-5 overflow-x-auto px-4 sm:pl-[148px] sm:pr-7 text-[14px]"
        >
          {(
            [
              ["ai", "AI Mode"],
              ["all", "All"],
              ["images", "Images"],
              ["videos", "Videos"],
              ["short", "Short videos"],
              ["news", "News"],
              ["maps", "Maps"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              data-testid={`tab-chrome-${id}`}
              className={`border-b-[3px] pb-2.5 text-[14px] whitespace-nowrap transition-colors ${
                activeTab === id
                  ? "border-[#1f1f1f] font-medium text-[#1f1f1f]"
                  : "border-transparent text-[#5f6368] hover:text-[#202124]"
              }`}
            >
              {label}
            </button>
          ))}
          <span className="inline-flex items-center gap-0.5 pb-2.5 text-[14px] text-[#5f6368] whitespace-nowrap">
            More <ChevronDown className="size-3.5" />
          </span>
          <span className="ml-auto hidden items-center gap-0.5 pb-2.5 text-[14px] text-[#5f6368] whitespace-nowrap md:inline-flex">
            Tools <ChevronDown className="size-3.5" />
          </span>
        </nav>
      </header>

      <main className="mx-auto max-w-[1220px] px-4 pb-20 pt-4 sm:pl-[148px] sm:pr-7">
        {/* Spell correction when query had typo like "effie tower" */}
        {intent.correctedFrom && (
          <div className="mb-3 text-[15px]" data-testid="text-chrome-correction">
            <span className="text-[#d93025]">Showing results for </span>
            <button
              type="button"
              onClick={() => onChromeSearch(intent.effectiveQuery.toLowerCase())}
              className="font-semibold italic text-[#1a0dab] hover:underline"
            >
              {intent.effectiveQuery.toLowerCase()}
            </button>
            <span className="ml-3 text-[13px] text-[#5f6368]">
              Search instead for <span className="italic">{intent.correctedFrom}</span>
            </span>
          </div>
        )}

        {activeTab === "images" && curated.images.length > 0 ? (
          <section className="mt-2" aria-label="Image results">
            <p className="mb-3 text-[13px] text-[#5f6368]">
              Drag a selection box over Gustave Eiffel&apos;s 1884 elevation plate or any archival photo to launch the 3D exhibition.
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" data-testid="chrome-images-grid">
              {curated.images.map((img) => (
                <ImageSelectCard
                  key={img.id}
                  image={img}
                  fullUncropped={img.id === "eiffel-plate"}
                  onPointerDown={handleImagePointerDown}
                  onQuickOpen={(el) => onOpenPortalCenter?.(el)}
                />
              ))}
            </div>
          </section>
        ) : isEiffel ? (
          <div className="space-y-6">
            {/* Authentic Google Knowledge Entity Header */}
            <section aria-label="Eiffel Tower overview" data-testid="chrome-entity-header">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <div>
                  <h1 className="text-[28px] font-normal leading-[36px] text-[#202124]">
                    Eiffel Tower
                  </h1>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[14px] text-[#4d5156]">
                    <span className="font-normal text-[#202124]">4.7</span>
                    <Star className="size-3.5 fill-[#fbbc04] text-[#fbbc04]" aria-hidden="true" />
                    <span className="text-[#1a0dab]">(501K)</span>
                    <span>·</span>
                    <span>Tower in Paris, France</span>
                    <span>·</span>
                    <span className="font-medium text-[#137333]">Open</span>
                    <MoreVertical className="size-3.5 text-[#5f6368]" aria-hidden="true" />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      ["overview", "Overview"],
                      ["tickets", "Tickets"],
                      ["reviews", "Reviews"],
                      ["events", "Events"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setEntityTab(id)}
                      className={`h-[36px] rounded-full px-4 text-[14px] transition-colors ${
                        entityTab === id
                          ? "border border-[#1f1f1f] bg-[#e8f0fe]/60 font-medium text-[#1f1f1f]"
                          : "bg-[#f1f3f4] text-[#202124] hover:bg-[#e8eaed]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Authentic 3-Column Google Bento Grid */}
              <div
                className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,44%)_minmax(0,28%)_minmax(0,28%)]"
                data-testid="chrome-bento-grid"
              >
                {/* Column 1: Photo Mosaic */}
                <div className="grid h-[256px] grid-cols-5 grid-rows-2 gap-1 overflow-hidden rounded-[20px] bg-[#f1f3f4]">
                  <div
                    onPointerDown={handleImagePointerDown}
                    data-eiffel-selectable="mosaic-hero"
                    className="col-span-3 row-span-2 cursor-crosshair select-none overflow-hidden bg-[#dfe3e8]"
                  >
                    <img
                      src={BENTO_MOSAIC_PHOTOS.hero}
                      alt="Eiffel Tower rising over the Champ-de-Mars in Paris"
                      draggable={false}
                      className="h-full w-full object-cover object-[center_14%] transition-transform duration-300 hover:scale-[1.02]"
                    />
                  </div>
                  <div
                    onPointerDown={handleImagePointerDown}
                    data-eiffel-selectable="mosaic-video"
                    className="relative col-span-2 row-span-1 cursor-crosshair select-none overflow-hidden bg-[#dfe3e8]"
                  >
                    <img
                      src={BENTO_MOSAIC_PHOTOS.topRight}
                      alt="Beneath the great arch of the Eiffel Tower"
                      draggable={false}
                      className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                    />
                    <span className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-medium text-white">
                      <Play className="size-2.5 fill-white" /> 0:45
                    </span>
                  </div>
                  <div className="col-span-2 row-span-1 grid grid-cols-2 gap-1">
                    <div
                      onPointerDown={handleImagePointerDown}
                      data-eiffel-selectable="mosaic-second"
                      className="cursor-crosshair select-none overflow-hidden bg-[#dfe3e8]"
                    >
                      <img
                        src={BENTO_MOSAIC_PHOTOS.bottomLeft}
                        alt="Eiffel Tower second platform gardens view"
                        draggable={false}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div
                      onPointerDown={handleImagePointerDown}
                      data-eiffel-selectable="mosaic-gallery"
                      className="relative cursor-crosshair select-none overflow-hidden bg-[#dfe3e8]"
                    >
                      <img
                        src={BENTO_MOSAIC_PHOTOS.bottomRight}
                        alt="Aerial view of Champ-de-Mars and Eiffel Tower"
                        draggable={false}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        aria-label="View all Eiffel Tower images"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => setActiveTab("images")}
                        className="absolute bottom-2 right-2 grid size-7 place-items-center rounded-full bg-black/65 text-white hover:bg-black/80"
                      >
                        <Images className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Column 2: Google Maps Champ-de-Mars Card */}
                <div
                  className="relative h-[256px] overflow-hidden rounded-[20px] border border-[#e3e5ea] bg-[#edf0f2]"
                  data-testid="chrome-paris-map"
                >
                  <ParisChampDeMarsMap />
                  <button
                    type="button"
                    aria-label="Open 3D Champ-de-Mars view"
                    onClick={() => onOpenStandalone("eiffel")}
                    className="absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full bg-black/60 text-white hover:bg-black/75"
                  >
                    <Maximize2 className="size-3.5" />
                  </button>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-end gap-2 bg-white/82 px-2.5 py-0.5 text-[10px] text-[#5f6368]">
                    <span>Map data ©2026 Google</span>
                    <span>Terms</span>
                  </div>
                </div>

                {/* Column 3: Tickets + Reviews + Weather Bento Cards */}
                <div className="grid h-[256px] grid-rows-[1fr_1fr] gap-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="flex flex-col justify-between rounded-[18px] bg-[#f1f3f4] p-3.5">
                      <div className="text-[13px] font-medium text-[#202124]">Tickets</div>
                      <div>
                        <div className="text-[18px] font-medium leading-tight text-[#202124]">$16.23</div>
                        <div className="mt-0.5 text-[11.5px] text-[#5f6368]">from official site</div>
                      </div>
                    </div>
                    <div className="flex flex-col justify-between rounded-[18px] bg-[#f1f3f4] p-3.5">
                      <div className="text-[13px] font-medium text-[#202124]">Reviews</div>
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="text-[18px] font-medium leading-tight text-[#202124]">4.7</span>
                          <span className="flex items-center gap-[1px]" aria-label="4.7 out of 5 stars">
                            {[0, 1, 2, 3, 4].map((idx) => (
                              <Star key={idx} className="size-2.5 fill-[#fbbc04] text-[#fbbc04]" />
                            ))}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-[#5f6368]">(501,327 reviews)</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between rounded-[18px] bg-[#f1f3f4] px-3.5 py-3">
                    <div className="text-[13px] font-medium text-[#202124]">Weather</div>
                    <div className="grid grid-cols-3 gap-2 text-[12px]">
                      <div>
                        <div className="text-[#5f6368]">Sat</div>
                        <div className="mt-0.5 flex items-center gap-1 font-medium text-[#202124]">
                          <Cloud className="size-4 text-[#5f6368]" /> 52°
                        </div>
                      </div>
                      <div>
                        <div className="text-[#5f6368]">Sun</div>
                        <div className="mt-0.5 flex items-center gap-1 font-medium text-[#202124]">
                          <CloudRain className="size-4 text-[#4285f4]" /> 45°
                        </div>
                      </div>
                      <div>
                        <div className="text-[#5f6368]">Mon</div>
                        <div className="mt-0.5 flex items-center gap-1 font-medium text-[#202124]">
                          <CloudSun className="size-4 text-[#f9ab00]" /> 43°
                        </div>
                      </div>
                    </div>
                    <div className="text-[11.5px] font-medium text-[#1a0dab]">Google Weather</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Preserved Images for Eiffel Tower — Full Uncropped 1884 Elevation Plate */}
            {plateImage && (
              <section
                aria-label="Images for Eiffel Tower"
                data-testid="chrome-images-strip"
                className="rounded-2xl border border-[#ebebeb] bg-[#fcfcfd] p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="size-4 text-[#5f6368]" />
                    <h2 className="text-[18px] font-normal text-[#202124]">
                      Images for Eiffel Tower
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("images")}
                    className="text-[13px] font-medium text-[#1a0dab] hover:underline"
                  >
                    View all
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-[224px_minmax(0,1fr)]">
                  {/* Lead Uncropped 1884 Architectural Elevation Plate (Figure 2 Red Box) */}
                  <div
                    onPointerDown={handleImagePointerDown}
                    data-testid="chrome-image-card-eiffel-plate"
                    data-eiffel-selectable="plate"
                    className="group relative flex cursor-crosshair select-none flex-col overflow-hidden rounded-xl border border-[#d6d3cb] bg-[#eceae4] shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="flex h-[356px] w-full items-center justify-center bg-[#e1dfda] p-2">
                      <img
                        data-eiffel-plate-img="true"
                        src={plateImage.src}
                        alt={plateImage.alt}
                        draggable={false}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="border-t border-[#dedbd3] bg-white px-2.5 py-2">
                      <div className="truncate text-[12px] font-medium text-[#202124]">
                        ÉLÉVATION Fig. 1 (1884)
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-[#5f6368]">
                        <span className="truncate">Plate 55 · 1:1,000</span>
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            const card = e.currentTarget.closest<HTMLElement>('[data-testid="chrome-image-card-eiffel-plate"]');
                            if (card) onOpenPortalCenter?.(card);
                          }}
                          className="shrink-0 font-medium text-[#1a73e8] hover:underline"
                        >
                          1884 → 3D
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Secondary 2x2 Archival Gallery matching the Plate height */}
                  <div className="grid grid-cols-2 gap-3">
                    {secondaryImages.slice(0, 4).map((img) => (
                      <ImageSelectCard
                        key={img.id}
                        image={img}
                        tallHeight
                        onPointerDown={handleImagePointerDown}
                        onQuickOpen={(el) => onOpenPortalCenter?.(el)}
                      />
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Authentic Lower 2-Column Google SERP (Sponsored Tours + Organic Results + Viator Box) */}
            <div className="grid grid-cols-1 gap-9 lg:grid-cols-[minmax(0,652px)_348px] lg:items-start">
              <div className="min-w-0 space-y-7">
                {/* Sponsored Tickets & Tours Strip */}
                <section aria-label="Sponsored Tickets and Tours" data-testid="chrome-sponsored-tours">
                  <div className="mb-3 flex items-center gap-1.5">
                    <h2 className="text-[18px] font-normal text-[#202124]">Sponsored Tickets &amp; Tours</h2>
                    <MoreVertical className="size-4 text-[#5f6368]" aria-hidden="true" />
                  </div>
                  <div className="relative">
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                      {EIFFEL_SPONSORED_TOURS.map((tour) => (
                        <div
                          key={tour.id}
                          onPointerDown={handleImagePointerDown}
                          data-eiffel-selectable={tour.id}
                          className="group cursor-crosshair select-none overflow-hidden rounded-2xl border border-[#ebebeb] bg-white"
                        >
                          <img
                            src={tour.image}
                            alt={tour.alt}
                            draggable={false}
                            className="h-[104px] w-full object-cover"
                          />
                          <div className="p-2">
                            <div className="line-clamp-2 text-[12.5px] leading-snug text-[#1a0dab] group-hover:underline">
                              {tour.title}
                            </div>
                            <div className="mt-1.5 text-[12.5px] font-semibold text-[#202124]">{tour.price}</div>
                            <div className="text-[11px] text-[#5f6368]">{tour.provider}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -right-3 top-[68px] hidden size-8 place-items-center rounded-full border border-[#dadce0] bg-white text-[#1a73e8] shadow-md sm:grid"
                    >
                      <ChevronRight className="size-4" />
                    </span>
                  </div>
                </section>

                {/* Organic Web Results */}
                <div className="space-y-6 border-t border-[#ebebeb] pt-5" data-testid="list-chrome-results">
                  {filteredResults.map((res, idx) => renderResultLink(res, idx))}
                </div>
              </div>

              {/* Right Column: Sponsored Viator Box + About Knowledge Summary */}
              <aside className="space-y-4" data-testid="chrome-knowledge-panel">
                <div className="rounded-2xl border border-[#dadce0] bg-white p-4">
                  <div className="text-[12px] font-semibold text-[#202124]">Sponsored</div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="grid size-6 place-items-center rounded-full bg-[#008768] text-[12px] font-bold text-white">
                      V
                    </span>
                    <span className="text-[13px] text-[#202124]">Viator</span>
                    <MoreVertical className="size-3.5 text-[#5f6368]" aria-hidden="true" />
                  </div>

                  <div className="mt-2 flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onOpenStandalone("eiffel")}
                        className="text-left text-[15px] leading-snug text-[#1a0dab] hover:underline"
                      >
                        Paris: Eiffel Tower Skip-the-Line Tour With Optional Add-Ons
                      </button>
                      <div className="mt-1 flex items-center gap-1 text-[13px] text-[#4d5156]">
                        <span className="font-semibold text-[#202124]">$54</span>
                        <span>·</span>
                        <span>4.6</span>
                        <Star className="size-3 fill-[#fbbc04] text-[#fbbc04]" />
                        <span>(1.5K)</span>
                      </div>
                      <div className="mt-0.5 text-[12px] text-[#5f6368]">Free cancellation</div>
                    </div>
                    <img
                      src={BENTO_MOSAIC_PHOTOS.hero}
                      alt="Eiffel Tower skip-the-line tour preview"
                      className="size-[74px] shrink-0 rounded-xl object-cover"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenStandalone("eiffel")}
                    data-testid="button-chrome-open-3d"
                    className="mt-3 flex h-[38px] w-full items-center justify-center gap-1.5 rounded-full bg-[#1a73e8] text-[14px] font-medium text-white hover:bg-[#1765cc]"
                  >
                    <Ticket className="size-4" /> See tickets
                  </button>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onNavigate("Eiffel Tower")}
                      className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-[#dadce0] px-3.5 text-[13px] text-[#202124] hover:bg-[#f8f9fa]"
                    >
                      <Globe className="size-3.5 text-[#5f6368]" /> Website
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenStandalone("eiffel")}
                      className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-[#dadce0] px-3.5 text-[13px] text-[#202124] hover:bg-[#f8f9fa]"
                    >
                      <Navigation className="size-3.5 text-[#5f6368]" /> Directions
                    </button>
                    <span className="inline-flex h-[34px] items-center rounded-full border border-[#dadce0] px-3 text-[13px] text-[#202124]">
                      +2
                    </span>
                  </div>
                </div>

                {curated.knowledge && (
                  <div className="rounded-2xl border border-[#dadce0] bg-white p-4">
                    <h2 className="text-[18px] font-normal text-[#202124]">About</h2>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-[#4d5156]">
                      {curated.knowledge.summary}{" "}
                      {curated.knowledge.wikiTitle && (
                        <button
                          type="button"
                          onClick={() => onNavigate(curated.knowledge!.wikiTitle!)}
                          className="text-[#1a0dab] hover:underline"
                        >
                          Wikipedia
                        </button>
                      )}
                    </p>
                    <dl className="mt-3 space-y-1.5 border-t border-[#ebebeb] pt-3 text-[13px]">
                      {curated.knowledge.specs.map((s) => (
                        <div key={s.label} className="flex gap-2">
                          <dt className="shrink-0 font-semibold text-[#202124]">{s.label}:</dt>
                          <dd className="text-[#4d5156]">{s.value}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-3 flex items-center justify-between border-t border-[#ebebeb] pt-3 text-[12.5px]">
                      <a
                        href="https://github.com/lollapalooooooza/Eiffel-Tower"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[#1a0dab] hover:underline"
                      >
                        1889 3D Archive <ExternalLink className="size-3" />
                      </a>
                      <button
                        type="button"
                        onClick={() => onNavigate("Eiffel Tower")}
                        className="font-medium text-[#1a73e8] hover:underline"
                      >
                        Wikipedia →
                      </button>
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </div>
        ) : (
          /* Standard Google Search Layout for other queries */
          <div>
            <p className="text-[13px] text-[#70757a]" data-testid="text-chrome-stats">
              {wikiResultsQuery.isFetching && allResults.length === 0
                ? `Searching results for “${query}”…`
                : `About ${Math.max(12, allResults.length * 142000).toLocaleString()} results (0.28 seconds)`}
            </p>
            <div className="mt-5 space-y-6" data-testid="list-chrome-results">
              {filteredResults.length > 0 ? (
                filteredResults.map((res, idx) => renderResultLink(res, idx))
              ) : !wikiResultsQuery.isLoading ? (
                <div className="rounded-xl border border-[#ebebeb] p-5 text-[14px] text-[#4d5156]">
                  No web results found for <strong>{query}</strong>. Try searching another landmark, planet, or topic.
                </div>
              ) : null}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ImageSelectCard({
  image,
  fullUncropped = false,
  tallHeight = false,
  onPointerDown,
  onQuickOpen,
}: {
  image: ChromeImageResult;
  fullUncropped?: boolean;
  tallHeight?: boolean;
  onPointerDown: (e: RPE<HTMLElement>) => void;
  onQuickOpen: (el: HTMLElement) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={cardRef}
      onPointerDown={onPointerDown}
      data-testid={`chrome-image-card-${image.id}`}
      data-eiffel-selectable={image.id}
      className="group relative flex cursor-crosshair select-none flex-col overflow-hidden rounded-xl border border-[#e3e5ea] bg-[#f8f9fa]"
    >
      <div
        className={`w-full overflow-hidden ${
          fullUncropped
            ? "flex h-[260px] items-center justify-center bg-[#e1dfda] p-2"
            : tallHeight
              ? "h-[150px]"
              : "h-[136px]"
        }`}
      >
        <img
          src={image.src}
          alt={image.alt}
          draggable={false}
          data-eiffel-plate-img={image.id === "eiffel-plate" ? "true" : undefined}
          className={
            fullUncropped
              ? "h-full w-full object-contain"
              : "h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          }
        />
      </div>
      <div className="px-2.5 py-1.5">
        <div className="truncate text-[12px] font-medium text-[#202124]">{image.caption}</div>
        <div className="flex items-center justify-between gap-1 text-[11px] text-[#5f6368]">
          <span className="truncate">{image.source}</span>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => cardRef.current && onQuickOpen(cardRef.current)}
            className="shrink-0 font-medium text-[#1a73e8] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:underline"
          >
            3D
          </button>
        </div>
      </div>
    </div>
  );
}

function GoogleMicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden="true">
      <path fill="#4285F4" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" />
      <path fill="#34A853" d="M11 18.92V22h2v-3.08A7 7 0 0 1 11 18.92z" />
      <path fill="#FBBC05" d="M7.05 16.95A6.97 6.97 0 0 1 5 12h2a5 5 0 0 0 1.46 3.54z" />
      <path fill="#EA4335" d="M12 17a5 5 0 0 0 5-5h2a7 7 0 0 1-11.95 4.95l1.41-1.41A4.98 4.98 0 0 0 12 17z" />
    </svg>
  );
}

function GoogleLensIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden="true">
      <circle cx="12" cy="13" r="3" fill="#4285F4" />
      <path fill="#EA4335" d="M7.5 6.5L9 4.5h6l1.5 2H19a2 2 0 0 1 2 2v3h-2v-3h-3.5l-1.5-2H10l-1.5 2H5v3H3v-3a2 2 0 0 1 2-2z" />
      <path fill="#FBBC05" d="M5 17.5V12H3v5.5A2.5 2.5 0 0 0 5.5 20H11v-2H5.5a.5.5 0 0 1-.5-.5z" />
      <path fill="#34A853" d="M19 12v5.5a.5.5 0 0 1-.5.5H15v2h3.5a2.5 2.5 0 0 0 2.5-2.5V12z" />
      <circle cx="17.5" cy="17.5" r="1.5" fill="#4285F4" />
    </svg>
  );
}

function ParisChampDeMarsMap() {
  return (
    <svg viewBox="0 0 360 260" className="h-full w-full" role="img" aria-label="Map of Eiffel Tower and Champ-de-Mars in Paris">
      {/* Base urban blocks */}
      <rect width="360" height="260" fill="#f1f3f4" />
      {/* Parks: Trocadéro & Champ-de-Mars */}
      <polygon points="0,38 72,22 104,68 48,105 0,95" fill="#d3edd7" />
      <polygon points="150,118 228,88 338,195 278,242 152,162" fill="#d3edd7" />
      <polygon points="118,140 162,126 196,158 158,184" fill="#c7e8cd" />
      {/* Seine River */}
      <path
        d="M -10,206 C 55,148 118,92 184,56 C 236,28 296,24 370,18 L 370,40 C 296,46 244,50 194,78 C 134,112 72,166 8,228 Z"
        fill="#aadaff"
      />
      {/* Parisian avenue grid */}
      <g stroke="#ffffff" strokeWidth="3.2" fill="none">
        <line x1="0" y1="68" x2="360" y2="232" />
        <line x1="56" y1="0" x2="290" y2="260" />
        <line x1="120" y1="0" x2="355" y2="215" />
        <line x1="18" y1="150" x2="275" y2="24" />
        <line x1="72" y1="248" x2="340" y2="108" />
        <line x1="158" y1="260" x2="360" y2="156" />
      </g>
      {/* Pont d'Iéna bridge */}
      <line x1="112" y1="90" x2="150" y2="118" stroke="#ffffff" strokeWidth="5.5" />

      {/* District labels */}
      <text x="234" y="136" fill="#5f6368" fontSize="9.5" fontWeight="600" letterSpacing="0.8">
        GROS-CAILLOU
      </text>
      <text x="236" y="218" fill="#5f6368" fontSize="9.5" fontWeight="600" letterSpacing="0.8">
        ÉCOLE-MILITAIRE
      </text>
      <text x="166" y="176" fill="#188038" fontSize="10.5" fontWeight="500">
        Champ-de-Mars
      </text>

      {/* Landmark pins & labels */}
      <g>
        <circle cx="195" cy="24" r="9" fill="#9c27b0" stroke="#fff" strokeWidth="1.5" />
        <text x="195" y="27.5" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700">M</text>
        <text x="58" y="27" fill="#7b1fa2" fontSize="11" fontWeight="500">Palais de Tokyo</text>
      </g>
      <g>
        <circle cx="76" cy="60" r="9" fill="#9c27b0" stroke="#fff" strokeWidth="1.5" />
        <text x="76" y="63.5" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700">T</text>
        <text x="6" y="64" fill="#7b1fa2" fontSize="10.5" fontWeight="500">Trocadéro</text>
      </g>
      <g>
        <circle cx="212" cy="78" r="9" fill="#9c27b0" stroke="#fff" strokeWidth="1.5" />
        <text x="212" y="81.5" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700">Q</text>
        <text x="226" y="76" fill="#7b1fa2" fontSize="10" fontWeight="500">Musée du quai Branly</text>
        <text x="226" y="88" fill="#7b1fa2" fontSize="9.5">- Jacques Chirac</text>
      </g>
      <g>
        <circle cx="132" cy="146" r="8.5" fill="#1e8e3e" stroke="#fff" strokeWidth="1.5" />
        <text x="145" y="150" fill="#137333" fontSize="10" fontWeight="500">Stade Émile Anthoine</text>
      </g>

      {/* Metro badges */}
      {[
        [106, 12],
        [44, 144],
        [86, 178],
        [152, 236],
      ].map(([cx, cy], idx) => (
        <g key={idx}>
          <circle cx={cx} cy={cy} r="6.5" fill="#ffffff" stroke="#5f6368" strokeWidth="1" />
          <text x={cx} y={cy + 3} textAnchor="middle" fill="#3c4043" fontSize="7.5" fontWeight="600">M</text>
        </g>
      ))}

      {/* Tour Eiffel Hero Red Map Pin */}
      <g transform="translate(174, 120)">
        <ellipse cx="0" cy="14" rx="8" ry="3" fill="rgba(0,0,0,0.22)" />
        <path
          d="M 0,-22 C -9.5,-22 -16,-15 -16,-6.5 C -16,4 0,14 0,14 C 0,14 16,4 16,-6.5 C 16,-15 9.5,-22 0,-22 Z"
          fill="#ea4335"
          stroke="#ffffff"
          strokeWidth="2"
        />
        <circle cx="0" cy="-7" r="5" fill="#b31412" />
      </g>
      <text x="152" y="122" textAnchor="end" fill="#c5221f" fontSize="13" fontWeight="600" stroke="#ffffff" strokeWidth="3" paintOrder="stroke">
        Tour Eiffel
      </text>
    </svg>
  );
}
