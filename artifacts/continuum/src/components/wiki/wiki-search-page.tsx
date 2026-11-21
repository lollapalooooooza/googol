import { useEffect, useRef } from "react";
import { getSearchWikiQueryKey, useSearchWiki } from "@workspace/api-client-react";
import { ExternalLink, RotateCw } from "lucide-react";
import { wikiSearchUrl, wikiUrl } from "@/lib/wiki";
import { Masthead, type NavFn, type SearchFn } from "./wiki-page";
import { decodeWikiText } from "./search-suggest";
import { wikiReadStatus } from "./wiki-read-status";
import { WikiRefreshNotice } from "./wiki-refresh-notice";

export function WikiSearchPage({ query, reloadTick, onNavigate, onSearch, onToggleContents }: {
  query: string; reloadTick: number; onNavigate: NavFn; onSearch: SearchFn; onToggleContents: () => void;
}) {
  const result = useSearchWiki({ q: query }, { query: {
    queryKey: getSearchWikiQueryKey({ q: query }),
    staleTime: 60_000,
    retry: false,
  } });
  const refetchRef = useRef(result.refetch); refetchRef.current = result.refetch;
  const readStatus = wikiReadStatus(result.data, result.isError);
  useEffect(() => { document.title = `${query} — Wikipedia search`; }, [query]);
  useEffect(() => { if (reloadTick > 0) void refetchRef.current(); }, [reloadTick]);

  return (
    <div className="wp h-full overflow-y-auto bg-white" data-testid="page-wiki-search">
      <Masthead onNavigate={onNavigate} onSearch={onSearch} onToggleContents={onToggleContents} searchQuery={query} />
      <main className="mx-auto max-w-[900px] px-5 pt-4 pb-16">
        <h1 className="font-wikiserif text-[28px] text-[#202122] border-b border-[#a2a9b1] pb-1">Search results</h1>
        <p className="mt-3 text-[14px] text-[#54595d]" data-testid="text-search-query">English Wikipedia articles matching “{query}”</p>
        {readStatus.showRefreshError && <div className="mt-4"><WikiRefreshNotice search fetching={result.isFetching} onRetry={() => void result.refetch()} /></div>}
        <div aria-live="polite" aria-busy={result.isFetching}>
          {readStatus.showError ? (
            <div className="mt-5 text-[14px]" role="alert" data-testid="status-search-error">
              <p>{result.error?.status === 429 ? "Wikipedia is temporarily limiting requests. Please try again shortly." : "Wikipedia search could not be reached. No results have been substituted."}</p>
              <button type="button" onClick={() => void result.refetch()} className="mt-3 inline-flex items-center gap-1.5 px-3 h-8 border border-[#a2a9b1] bg-[#f8f9fa] rounded-sm text-[13px]" data-testid="button-retry-search"><RotateCw className="size-3.5" />Try again</button>
            </div>
          ) : !result.data ? (
            <p className="mt-5 text-[14px] text-[#54595d]" role="status" data-testid="status-search-loading">Searching Wikipedia…</p>
          ) : result.data.length === 0 ? (
            <div className="mt-5 text-[14px]" data-testid="status-search-empty">
              <p>No matching Wikipedia articles were found.</p>
              <p className="mt-1 text-[#54595d]">Try a different spelling or a broader topic.</p>
            </div>
          ) : (
            <ul className="mt-5 space-y-5" data-testid="list-search-results">
              {result.data.map((article, index) => (
                <li key={article.title}>
                  <a href={wikiUrl(article.title)} onClick={(event) => {
                    event.preventDefault();
                    onNavigate(article.title, { newTab: event.ctrlKey || event.metaKey });
                  }} className="text-[#36c] hover:underline font-wikiserif text-[20px]" data-testid={`link-search-result-${index}`}>{article.title}</a>
                  {article.description && <p className="mt-1 text-[14px] text-[#202122] leading-relaxed">{decodeWikiText(article.description)}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-8 pt-3 border-t border-[#eaecf0] text-[12px] text-[#54595d]" data-testid="text-search-attribution">
          Results supplied by English Wikipedia.{" "}
          <a href={wikiSearchUrl(query)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#36c] hover:underline" data-testid="link-search-source">Continue search on Wikipedia <ExternalLink className="size-3" /></a>
        </p>
      </main>
    </div>
  );
}
