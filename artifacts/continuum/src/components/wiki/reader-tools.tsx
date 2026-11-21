import { Bookmark, BookMarked, Type } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ReaderSettings } from "@/hooks/use-reader-settings";
import type { NavFn } from "./wiki-page";
import { useState } from "react";

const control = "inline-flex items-center gap-1.5 rounded px-2 py-1 text-[12px] text-[#36c] hover:bg-[#eaecf0] focus-visible:outline-2 focus-visible:outline-[#36c]";

export function ReaderTools({ title, reader, onNavigate }: { title: string; reader: ReaderSettings; onNavigate: NavFn }) {
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const saved = reader.bookmarks.includes(title);
  return (
    <div className="my-1">
      <div className="flex flex-wrap items-center gap-1" aria-label="Reading controls" role="group">
        <button className={control} aria-label={saved ? "Saved article, remove bookmark" : "Save article bookmark"} aria-pressed={saved}
          data-testid="button-bookmark" onClick={() => reader.toggleBookmark(title)}>
          <Bookmark className="size-3.5" fill={saved ? "currentColor" : "none"} />{saved ? "Saved" : "Save"}
        </button>
        <Popover open={bookmarksOpen} onOpenChange={setBookmarksOpen}>
          <PopoverTrigger className={control} data-testid="button-bookmarks"><BookMarked className="size-3.5" />Bookmarks</PopoverTrigger>
          <PopoverContent align="start" aria-label="Bookmarks" className="max-w-[calc(100vw-24px)] bg-white text-[#202122]">
            <h2 className="text-sm font-semibold">Bookmarks</h2>
            {reader.bookmarks.length === 0 ? <p className="mt-2 text-sm">No saved articles yet.</p> :
              <ul className="mt-2 max-h-[40vh] overflow-y-auto text-sm">
                {reader.bookmarks.map((t) => <li key={t} className="flex items-center gap-2 py-1">
                  <button className="min-w-0 flex-1 break-words text-left text-[#36c] hover:underline"
                    onClick={() => { onNavigate(t); setBookmarksOpen(false); }}>{t}</button>
                  <button className="shrink-0 rounded px-1 text-xs text-[#54595d] hover:bg-[#eaecf0]" aria-label={`Remove ${t} bookmark`}
                    onClick={() => reader.toggleBookmark(t)}>Remove</button>
                </li>)}
              </ul>}
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger className={control} data-testid="button-reading"><Type className="size-3.5" />Reading</PopoverTrigger>
          <PopoverContent align="start" aria-label="Reading preferences" className="max-w-[calc(100vw-24px)] bg-white text-[#202122]">
            <h2 className="text-sm font-semibold">Reading preferences</h2>
            <fieldset className="mt-3">
              <legend className="text-xs font-semibold">Text size</legend>
              <div className="mt-1 flex flex-wrap gap-3">
                {(["standard", "large", "larger"] as const).map((size) => <label key={size} className="flex items-center gap-1 text-sm">
                  <input type="radio" name="text-size" value={size} checked={reader.preferences.textSize === size}
                    onChange={() => reader.setPreferences({ ...reader.preferences, textSize: size })} />
                  {size[0].toUpperCase() + size.slice(1)}
                </label>)}
              </div>
            </fieldset>
            <fieldset className="mt-3">
              <legend className="text-xs font-semibold">Typeface</legend>
              <div className="mt-1 flex gap-3">
                {(["sans", "serif"] as const).map((typeface) => <label key={typeface} className="flex items-center gap-1 text-sm">
                  <input type="radio" name="typeface" value={typeface} checked={reader.preferences.typeface === typeface}
                    onChange={() => reader.setPreferences({ ...reader.preferences, typeface })} />
                  {typeface === "sans" ? "Sans serif" : "Serif"}
                </label>)}
              </div>
            </fieldset>
          </PopoverContent>
        </Popover>
      </div>
      {reader.storageError && <p role="status" className="mt-1 text-xs text-[#8b351a]">{reader.storageError}</p>}
    </div>
  );
}
