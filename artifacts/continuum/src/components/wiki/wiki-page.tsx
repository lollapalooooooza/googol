import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useGetWikiArticle, getGetWikiArticleQueryKey } from "@workspace/api-client-react";
import { Menu, Search, ChevronDown, ExternalLink, RotateCw } from "lucide-react";
import { classifyHref, normTitle, sanitizeWiki, wikiUrl, WIKI } from "@/lib/wiki";
import { SuggestList, useWikiSuggestions } from "./search-suggest";
import { EXPLORE_ARTICLES } from "@/data/articles";
import { wikiReadStatus } from "./wiki-read-status";
import { WikiRefreshNotice } from "./wiki-refresh-notice";
import { ReaderTools } from "./reader-tools";
import type { ReaderSettings } from "@/hooks/use-reader-settings";

export type NavFn = (title: string, opts?: { newTab?: boolean; hash?: string }) => void;
export type SearchFn = (query: string) => void;

const ext = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

export function Masthead({ onNavigate, onSearch, onToggleContents, searchQuery = "" }: { onNavigate: NavFn; onSearch: SearchFn; onToggleContents: () => void; searchQuery?: string }) {
  const [q, setQ] = useState(searchQuery);
  const [focus, setFocus] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setQ(searchQuery); }, [searchQuery]);
  const go = (t: string) => { onNavigate(t); setQ(""); setFocus(false); (document.activeElement as HTMLElement | null)?.blur(); };
  return (
    <header className="wiki-masthead relative z-30 flex items-center gap-3 sm:gap-5 px-3 sm:px-4 h-[52px] border-b border-transparent">
      <button aria-label="Toggle contents" data-testid="button-wiki-menu" onClick={onToggleContents} className="grid place-items-center size-8 rounded hover:bg-[#eaecf0] text-[#202122]"><Menu className="size-5" strokeWidth={1.8} /></button>
      <button onClick={() => onNavigate("Plant cell")} className="hidden sm:flex items-center gap-2 shrink-0" aria-label="Wikipedia home: Plant cell" data-testid="link-wiki-logo">
        <img src="https://en.wikipedia.org/static/images/icons/wikipedia.png" alt="" className="size-[34px] object-contain" />
        <span className="leading-none text-left">
          <span className="block font-wikiserif text-[19px] tracking-[0.06em] text-[#202122]">WIKIPEDIA</span>
          <span className="block font-wikiserif text-[10.5px] text-[#202122] mt-0.5">The Free Encyclopedia</span>
        </span>
      </button>
      <form role="search" aria-label="Search English Wikipedia" className="relative flex-1 min-w-0 max-w-[440px] flex"
        onFocusCapture={() => setFocus(true)}
        onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocus(false); }}
        onSubmit={(e) => {
          e.preventDefault();
          const keyword = q.trim();
          if (!keyword) { inputRef.current?.focus(); return; }
          onSearch(keyword); setQ(keyword); setFocus(false); inputRef.current?.blur();
        }}>
        <label className={`flex-1 min-w-0 flex items-center gap-2 h-8 px-2 border rounded-l-sm bg-white cursor-text ${focus ? "border-[#36c] shadow-[inset_0_0_0_1px_#36c]" : "border-[#a2a9b1]"}`}>
          <Search className="size-4 shrink-0 text-[#72777d]" aria-hidden />
          <input ref={inputRef} type="search" name="search" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)}
            maxLength={250} placeholder="Search Wikipedia" aria-label="Search Wikipedia" data-testid="input-wiki-search" className="flex-1 min-w-0 bg-transparent outline-none text-[13.5px] text-[#202122] placeholder:text-[#72777d]" />
        </label>
        <button type="submit" data-testid="button-wiki-search" className="shrink-0 h-8 px-3 border border-l-0 border-[#a2a9b1] rounded-r-sm bg-[#f8f9fa] text-[13px] font-semibold text-[#202122] hover:bg-white">Search</button>
        {focus && <SuggestList text={q} onPick={go} testid="list-masthead-suggest" />}
      </form>
      <nav className="ml-auto hidden md:flex items-center gap-4 text-[13px]">
        <a href="https://donate.wikimedia.org" target="_blank" rel="noreferrer" className="text-[#36c] hover:underline">Donate</a>
        <a href={`${WIKI}/w/index.php?title=Special:CreateAccount`} target="_blank" rel="noreferrer" className="text-[#36c] hover:underline">Create account</a>
        <a href={`${WIKI}/w/index.php?title=Special:UserLogin`} target="_blank" rel="noreferrer" className="text-[#36c] hover:underline">Log in</a>
      </nav>
    </header>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse" data-testid="status-article-loading" role="status" aria-label="Loading article">
      <span className="sr-only">Loading article from English Wikipedia…</span>
      <div className="h-8 w-64 bg-[#eaecf0] rounded" />
      <div className="mt-4 h-px bg-[#c8ccd1]" />
      <div className="mt-5 space-y-2.5">{[96, 90, 99, 72, 94, 88, 60].map((w, i) => <div key={i} className="h-3 rounded bg-[#eaecf0]" style={{ width: `${w}%` }} />)}</div>
      <div className="mt-8 h-6 w-40 bg-[#eaecf0] rounded" />
      <div className="mt-4 space-y-2.5">{[92, 97, 85, 66].map((w, i) => <div key={i} className="h-3 rounded bg-[#eaecf0]" style={{ width: `${w}%` }} />)}</div>
    </div>
  );
}

function ErrorView({ title, error, onRetry, onNavigate, onSearch }: { title: string; error: unknown; onRetry: () => void; onNavigate: NavFn; onSearch: SearchFn }) {
  const { data } = useWikiSuggestions(title);
  const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 0;
  const missing = status === 404;
  const unsupported = status === 400 || status === 422;
  return (
    <div data-testid="status-article-error" role="alert" className="max-w-xl">
      <h1 className="font-wikiserif text-[28px] text-[#202122] border-b border-[#a2a9b1] pb-1">{title}</h1>
      <p className="mt-4 text-[14px] text-[#202122]" data-testid="text-article-error">
        {missing ? "No English Wikipedia article was found with this title." : unsupported ? "This page is not supported in googol. Only English Wikipedia encyclopedia articles can be read here; special pages open on Wikipedia." : status === 429 ? "Wikipedia is temporarily limiting requests. Please try again shortly." : "Wikipedia could not be reached. The article has not been replaced with sample content."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {!missing && !unsupported && <button onClick={onRetry} data-testid="button-retry" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm border border-[#a2a9b1] bg-[#f8f9fa] text-[13px] font-semibold hover:bg-white"><RotateCw className="size-3.5" />Try again</button>}
        <button onClick={() => onSearch(title.slice(0, 250))} data-testid="button-search-missing-title" className="inline-flex items-center gap-1.5 h-8 px-3 text-[13px] text-[#36c] hover:underline">Search Wikipedia instead</button>
        <a href={wikiUrl(title)} target="_blank" rel="noreferrer" data-testid="link-unavailable-source" className="inline-flex items-center gap-1.5 h-8 px-3 text-[13px] text-[#36c] hover:underline">Open on Wikipedia <ExternalLink className="size-3" /></a>
      </div>
      {data && data.length > 0 && (
        <div className="mt-6">
          <p className="text-[13px] text-[#54595d]">Did you mean:</p>
          <ul className="mt-1 list-disc pl-6">{data.slice(0, 6).map((r) => <li key={r.title}><button className="text-[#36c] hover:underline text-[14px]" onClick={() => onNavigate(r.title)}>{r.title}</button>{r.description && <span className="text-[13px] text-[#54595d]"> — {r.description}</span>}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

export function WikiPage({ title, hash, reloadTick, contentsOpen, onToggleContents, onNavigate, onSearch, onResolved, reader }: {
  title: string; hash?: string; reloadTick: number; contentsOpen: boolean; onToggleContents: () => void; onNavigate: NavFn; onSearch: SearchFn; onResolved: (t: string) => void; reader: ReaderSettings;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const q = useGetWikiArticle({ title }, { query: { queryKey: getGetWikiArticleQueryKey({ title }), enabled: !!title, staleTime: 5 * 60_000, retry: (count, error) => count < 1 && (!error.status || error.status >= 500) } });
  const data = q.data;
  const readStatus = wikiReadStatus(data, q.isError);
  const html = useMemo(() => (data ? sanitizeWiki(data.html) : ""), [data]);
  const [active, setActive] = useState("");
  const resolvedRef = useRef(onResolved); resolvedRef.current = onResolved;
  const refetchRef = useRef(q.refetch); refetchRef.current = q.refetch;

  useEffect(() => { if (data) { resolvedRef.current(data.title); document.title = `${data.title} - Wikipedia`; } }, [data]);
  useEffect(() => { if (reloadTick > 0) void refetchRef.current(); }, [reloadTick]);

  const scrollToId = (id: string, smooth = true) => {
    const root = scrollRef.current; if (!root) return false;
    const el = root.querySelector(`[id="${CSS.escape(id)}"]`) as HTMLElement | null;
    if (!el) return false;
    root.scrollTo({ top: el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 12, behavior: smooth ? "smooth" : "auto" });
    return true;
  };

  useEffect(() => {
    if (!html) { scrollRef.current?.scrollTo({ top: 0 }); return; }
    const anchor = hash ?? data?.redirectAnchor;
    if (!anchor || !scrollToId(anchor, false)) scrollRef.current?.scrollTo({ top: 0 });
  }, [html, hash, data?.redirectAnchor]);

  useEffect(() => {
    const root = scrollRef.current; if (!root || !data) return;
    const onScroll = () => {
      let cur = "";
      const top = root.getBoundingClientRect().top;
      for (const s of data.sections) {
        const el = root.querySelector(`[id="${CSS.escape(s.anchor)}"]`);
        if (el && el.getBoundingClientRect().top - top < 120) cur = s.anchor;
      }
      setActive(cur);
    };
    onScroll(); root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [data, html]);

  const handleLink = (e: MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest("a");
    if (!a || !data) return;
    const href = a.getAttribute("href"); if (!href) return;
    const k = classifyHref(href);
    const newTab = e.ctrlKey || e.metaKey || e.button === 1;
    if (k.kind === "anchor") { e.preventDefault(); scrollToId(k.id); return; }
    if (k.kind === "article") {
      e.preventDefault();
      if (normTitle(k.title) === normTitle(data.title) && !newTab) { if (k.hash) scrollToId(k.hash); return; }
      onNavigate(k.title, { newTab, hash: k.hash });
      return;
    }
    e.preventDefault(); ext(k.href);
  };

  const url = data?.url ?? wikiUrl(title);
  const shownTitle = data?.title ?? title;

  return (
    <div ref={scrollRef} className="wp h-full overflow-y-auto bg-white" data-testid="wiki-scroll">
      <Masthead onNavigate={onNavigate} onSearch={onSearch} onToggleContents={onToggleContents} />
      <div className={`wiki-layout mx-auto max-w-[1180px] px-3 sm:px-5 pb-16 ${contentsOpen ? "lg:grid lg:grid-cols-[176px_1fr] lg:gap-6" : ""}`}>
        {contentsOpen && (
          <nav aria-label="Contents" className="hidden lg:block pt-4">
            <div className="sticky top-3 max-h-[calc(100%-1rem)]">
              <div className="flex items-center justify-between pb-1.5 border-b border-[#eaecf0]">
                <span className="text-[13.5px] font-bold text-[#202122]">Contents</span>
                <button onClick={onToggleContents} className="text-[12px] text-[#36c] hover:underline" data-testid="button-hide-contents">[hide]</button>
              </div>
              <ul className="mt-1.5 text-[13px] leading-[1.25] max-h-[60vh] overflow-y-auto pr-1 [scrollbar-width:thin]">
                <li><button onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })} className={`block w-full text-left py-[5px] ${active === "" ? "font-bold text-[#202122]" : "text-[#36c]"}`}>(Top)</button></li>
                {data?.sections.filter((s) => s.level <= 3).map((s) => (
                  <li key={s.anchor}>
                    <button data-testid={`toc-${s.anchor}`} onClick={() => scrollToId(s.anchor)}
                      className={`block w-full text-left py-[5px] truncate ${s.level > 2 ? "pl-3" : ""} ${active === s.anchor ? "font-bold text-[#202122]" : "text-[#36c] hover:underline"}`}
                      dangerouslySetInnerHTML={{ __html: sanitizeWiki(s.title) }} />
                  </li>
                ))}
                {!data && q.isLoading && [1, 2, 3, 4, 5].map((i) => <li key={i} className="my-2 h-2.5 rounded bg-[#eaecf0] animate-pulse" style={{ width: `${50 + i * 8}%` }} />)}
              </ul>
            </div>
          </nav>
        )}
        <main className="min-w-0 pt-4">
          {readStatus.showError ? <ErrorView title={title} error={q.error} onRetry={() => void q.refetch()} onNavigate={onNavigate} onSearch={onSearch} /> : !data ? <Skeleton /> : (
            <article>
              {readStatus.showRefreshError && <WikiRefreshNotice fetching={q.isFetching} onRetry={() => void q.refetch()} />}
              <h1 className="font-wikiserif text-[26px] sm:text-[28.8px] leading-tight text-[#202122]" data-testid="text-article-title">{shownTitle}</h1>
              <div className="wiki-article-tabs mt-1 flex items-end justify-between border-b border-[#a2a9b1] text-[13px]">
                <div className="flex">
                  <span className="px-1.5 pb-1.5 border-b-2 border-[#202122] text-[#202122]">Article</span>
                  <a className="px-1.5 pb-1.5 ml-2 text-[#36c]" href={`${WIKI}/wiki/Talk:${encodeURIComponent(shownTitle.replace(/ /g, "_"))}`} target="_blank" rel="noreferrer">Talk</a>
                </div>
                <div className="hidden sm:flex">
                  <span className="px-1.5 pb-1.5 border-b-2 border-[#36c] text-[#202122]">Read</span>
                  <a className="px-1.5 pb-1.5 ml-2 text-[#36c]" href={`${WIKI}/w/index.php?title=${encodeURIComponent(shownTitle)}&action=edit`} target="_blank" rel="noreferrer">View source</a>
                  <a className="px-1.5 pb-1.5 ml-2 text-[#36c]" href={`${WIKI}/w/index.php?title=${encodeURIComponent(shownTitle)}&action=history`} target="_blank" rel="noreferrer">View history</a>
                  <a className="px-1.5 pb-1.5 ml-2 text-[#202122] inline-flex items-center gap-0.5" href={`${WIKI}/w/index.php?title=${encodeURIComponent(shownTitle)}&action=info`} target="_blank" rel="noreferrer">Tools <ChevronDown className="size-3.5" /></a>
                </div>
              </div>
              <p className="mt-2 text-[12.5px] text-[#54595d]">From Wikipedia, the free encyclopedia</p>
              <p className="mt-1 text-[12px] text-[#54595d]" data-testid="text-article-source">
                {normTitle(title) !== normTitle(shownTitle) && <span data-testid="text-article-redirect">Redirected from “{title}”. </span>}
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-[#36c] hover:underline" data-testid="link-original-article">Original article</a>{" · "}
                <a href={`${WIKI}/w/index.php?title=${encodeURIComponent(shownTitle)}&action=history`} target="_blank" rel="noopener noreferrer" className="text-[#36c] hover:underline" data-testid="link-article-contributors">Wikipedia contributors</a>{" · "}
                <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer" className="text-[#36c] hover:underline" data-testid="link-article-license">CC BY-SA 4.0</a>
              </p>
              {q.isFetching && <p className="mt-2 text-[12px] text-[#54595d]" role="status" data-testid="status-article-refreshing">Refreshing from Wikipedia…</p>}
              <ReaderTools title={shownTitle} reader={reader} onNavigate={onNavigate} />
              <div className="wiki-body mt-2" data-testid="wiki-content" style={{
                fontSize: { standard: 14, large: 16, larger: 18 }[reader.preferences.textSize],
                fontFamily: reader.preferences.typeface === "serif" ? "Georgia, 'Times New Roman', serif" : undefined,
              }} onClick={handleLink} onAuxClick={handleLink} dangerouslySetInnerHTML={{ __html: html }} />
              <footer className="clear-both mt-10 pt-3 border-t border-[#a2a9b1] text-[12px] text-[#54595d] leading-relaxed" data-testid="text-attribution">
                Text from the Wikipedia article <a className="text-[#36c] hover:underline" href={url} target="_blank" rel="noreferrer">{shownTitle}</a>, revision{" "}
                <a className="text-[#36c] hover:underline" href={`${WIKI}/w/index.php?title=${encodeURIComponent(shownTitle)}&oldid=${data.revisionId}`} target="_blank" rel="noreferrer" data-testid="link-revision">{data.revisionId}</a>,
                by Wikipedia contributors, available under the{" "}
                <a className="text-[#36c] hover:underline" href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">Creative Commons Attribution-ShareAlike 4.0 License</a>. Media files carry their own licences; see each file page.
              </footer>
            </article>
          )}
        </main>
      </div>
    </div>
  );
}

export function NewTabPage({ onNavigate, onSearch }: { onNavigate: NavFn; onSearch: SearchFn }) {
  const [q, setQ] = useState("");
  return (
    <div className="wp h-full overflow-y-auto bg-white grid place-items-center p-6" data-testid="page-new-tab">
      <div className="w-full max-w-md text-center -mt-16">
        <span className="mx-auto grid place-items-center size-16 rounded-full border border-[#c8ccd1] bg-[radial-gradient(circle_at_35%_30%,#fff,#e4e4e4)] font-wikiserif text-[30px] text-[#3a3a3a]">W</span>
        <p className="mt-3 font-wikiserif text-[26px] tracking-[0.06em] text-[#202122]">WIKIPEDIA</p>
        <form className="relative mt-5 flex" onSubmit={(e) => { e.preventDefault(); if (q.trim()) onSearch(q.trim()); }}>
          <input autoFocus maxLength={250} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Wikipedia" aria-label="Search Wikipedia" data-testid="input-newtab-search"
            className="min-w-0 flex-1 h-9 px-3 border border-[#a2a9b1] rounded-l-sm outline-none focus:border-[#36c] text-[14px]" />
          <button data-testid="button-newtab-search" className="h-9 px-4 border border-l-0 border-[#a2a9b1] rounded-r-sm bg-[#f8f9fa] text-[13px] font-semibold">Search</button>
          <SuggestList text={q} onPick={(t) => onNavigate(t)} testid="list-newtab-suggest" />
        </form>
        <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[13px]">
          {EXPLORE_ARTICLES.map((t) => <button key={t} data-testid={`button-explore-${t.replace(/ /g, "-").toLowerCase()}`} onClick={() => onNavigate(t)} className="text-[#36c] hover:underline">{t}</button>)}
        </div>
      </div>
    </div>
  );
}
