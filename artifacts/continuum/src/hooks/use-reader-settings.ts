import { useCallback, useEffect, useRef, useState } from "react";

export type ReadingPreferences = {
  textSize: "standard" | "large" | "larger";
  typeface: "sans" | "serif";
};

const DEFAULTS: ReadingPreferences = { textSize: "standard", typeface: "sans" };
const isPreferences = (v: unknown): v is ReadingPreferences => {
  if (!v || typeof v !== "object") return false;
  const p = v as Partial<ReadingPreferences>;
  return ["standard", "large", "larger"].includes(p.textSize ?? "") && ["sans", "serif"].includes(p.typeface ?? "");
};
const isBookmarks = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((t) => typeof t === "string" && t.trim().length > 0 && t.length <= 250);

function useSavedSetting<T>(key: string, fallback: T, valid: (v: unknown) => v is T) {
  const [initial] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return { value: fallback, error: "" };
      const value: unknown = JSON.parse(raw);
      if (!valid(value)) throw new Error("Invalid saved setting");
      return { value, error: "" };
    } catch {
      return { value: fallback, error: "Saved reading data could not be read. Changes will apply for this visit." };
    }
  });
  const [value, setValue] = useState(initial.value);
  const [error, setError] = useState(initial.error);
  const edited = useRef(false);
  const update = useCallback((next: T | ((previous: T) => T)) => {
    edited.current = true;
    setValue(next);
  }, []);
  useEffect(() => {
    // Do not overwrite unreadable saved data just by opening the reader.
    if (!edited.current) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
      setError("");
    } catch {
      setError("Changes apply for this visit, but could not be saved. Browser storage may be unavailable or full.");
    }
  }, [key, value]);
  return { value, update, error };
}

export function useReaderSettings() {
  const saved = useSavedSetting("continuum.bookmarks.v1", [] as string[], isBookmarks);
  const reading = useSavedSetting("continuum.reading.v1", DEFAULTS, isPreferences);
  return {
    bookmarks: saved.value,
    toggleBookmark: (title: string) => saved.update((titles) =>
      titles.includes(title) ? titles.filter((t) => t !== title) : [...titles, title]),
    preferences: reading.value,
    setPreferences: reading.update,
    storageError: saved.error || reading.error,
  };
}

export type ReaderSettings = ReturnType<typeof useReaderSettings>;
