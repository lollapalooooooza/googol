import { useEffect, useState, type ReactNode } from "react";
import { useSearchWiki, getSearchWikiQueryKey } from "@workspace/api-client-react";

export function useDebounced(v: string, ms = 220) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

export function useWikiSuggestions(text: string, enabled = true) {
  const input = text.trim();
  const q = useDebounced(input);
  const on = enabled && q.length > 0 && q.length <= 250 && !/^https?:/i.test(q);
  const result = useSearchWiki({ q }, { query: { queryKey: getSearchWikiQueryKey({ q }), enabled: on, staleTime: 60_000, retry: false } });
  const current = q === input && on;
  return {
    ...result,
    // Never offer results for the previous query during the debounce interval.
    data: current ? result.data : undefined,
    isFetching: input.length > 0 && (q !== input || (on && result.isFetching)),
    isError: current && result.isError,
  };
}

export function SuggestList({ text, onPick, header, testid }: { text: string; onPick: (title: string) => void; header?: ReactNode; testid: string }) {
  const { data, isFetching, isError, error, refetch } = useWikiSuggestions(text);
  if (!text.trim() || /^https?:/i.test(text.trim())) return null;
  return (
    <ul aria-label="Wikipedia suggestions" aria-live="polite" aria-busy={isFetching} data-testid={testid} className="absolute left-0 right-0 top-full mt-1 z-50 max-h-[45vh] overflow-y-auto rounded-md border border-[#c8ccd1] bg-[#fdfdfc] shadow-[0_6px_20px_-8px_rgba(0,0,0,.25)] py-1 text-left">
      {header}
      {text.trim().length > 250 && <li data-testid={`${testid}-invalid`} className="px-3 py-2 text-[13px] text-[#a33]">Use 250 characters or fewer.</li>}
      {isError && <li className="px-3 py-2 text-[13px] text-[#a33]" data-testid={`${testid}-error`}>{error?.status === 429 ? "Wikipedia is limiting requests. Please try again shortly." : "Search is unavailable right now."} <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => void refetch()} className="text-[#36c] underline" data-testid={`${testid}-retry`}>Try again</button></li>}
      {!isError && isFetching && !data && <li className="px-3 py-2 text-[13px] text-[#72777d]" data-testid={`${testid}-loading`}>Searching Wikipedia…</li>}
      {!isError && data?.length === 0 && <li className="px-3 py-2 text-[13px] text-[#72777d]" data-testid={`${testid}-empty`}>No matching Wikipedia articles.</li>}
      {!isError && data?.slice(0, 8).map((r, i) => (
        <li key={r.title}>
          <button type="button" data-testid={`${testid}-${i}`} onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(r.title)}
            className="w-full px-3 py-1.5 text-left hover:bg-[#eaecf0] focus:bg-[#eaecf0] outline-none">
            <div className="text-[13.5px] text-[#202122]">{r.title}</div>
            {r.description && <div className="text-[12px] text-[#54595d] truncate">{decodeWikiText(r.description)}</div>}
          </button>
        </li>
      ))}
    </ul>
  );
}

export const decodeWikiText = (text: string) =>
  new DOMParser().parseFromString(text, "text/html").documentElement.textContent ?? "";
