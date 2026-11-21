import { RotateCw } from "lucide-react";

export function WikiRefreshNotice({ search = false, fetching, onRetry }: {
  search?: boolean; fetching: boolean; onRetry: () => void;
}) {
  return (
    <div role="status" data-testid={search ? "status-search-refresh-error" : "status-article-refresh-error"}
      className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-sm border border-[#e4dcc5] bg-[#fbf8ee] px-3 py-2 text-[13px] text-[#61583f]">
      <p className="flex-1 min-w-[180px]">
        Couldn’t refresh {search ? "these results" : "this article"}. Showing the last loaded Wikipedia {search ? "results" : "version"}.
      </p>
      <button type="button" disabled={fetching} onClick={onRetry}
        data-testid={search ? "button-retry-search-refresh" : "button-retry-article-refresh"}
        className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-semibold text-[#36c] hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#36c] disabled:opacity-50">
        <RotateCw className={`size-3.5 ${fetching ? "animate-spin motion-reduce:animate-none" : ""}`} />
        {fetching ? "Retrying…" : "Try again"}
      </button>
    </div>
  );
}
