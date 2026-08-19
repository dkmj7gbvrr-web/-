import { useCallback, useEffect, useState } from "react";
import { seedData } from "../data/seedData";
import type { ExportedData, Pokefuta, PokefutaEntry, VisitInfo } from "../types";

const STORAGE_KEY = "pokefuta-tracker:data:v1";
const DATA_VERSION = 1;

function withDefaultVisit(entry: Pokefuta): PokefutaEntry {
  return { ...entry, visit: { visited: false } };
}

function loadInitial(): PokefutaEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PokefutaEntry[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore, fall back to seed data
  }
  return seedData.map(withDefaultVisit);
}

export function useAppData() {
  const [entries, setEntries] = useState<PokefutaEntry[]>(loadInitial);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries]);

  const upsertEntry = useCallback((entry: Pokefuta) => {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === entry.id);
      if (idx === -1) {
        return [...prev, withDefaultVisit(entry)];
      }
      const next = [...prev];
      next[idx] = { ...entry, visit: next[idx].visit };
      return next;
    });
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const setVisit = useCallback((id: string, visit: VisitInfo) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, visit } : e)),
    );
  }, []);

  const toggleVisited = useCallback((id: string) => {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        const nowVisited = !e.visit.visited;
        return {
          ...e,
          visit: {
            ...e.visit,
            visited: nowVisited,
            visitedDate:
              nowVisited && !e.visit.visitedDate
                ? new Date().toISOString().slice(0, 10)
                : e.visit.visitedDate,
          },
        };
      }),
    );
  }, []);

  const resetToSeed = useCallback(() => {
    if (
      !window.confirm(
        "すべてのデータ(訪問記録・追加したポケふた)を初期サンプルにリセットします。よろしいですか？",
      )
    ) {
      return;
    }
    setEntries(seedData.map(withDefaultVisit));
  }, []);

  const exportData = useCallback(() => {
    const payload: ExportedData = {
      version: DATA_VERSION,
      exportedAt: new Date().toISOString(),
      entries,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pokefuta-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [entries]);

  const importData = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json) as ExportedData | PokefutaEntry[];
      const list = Array.isArray(parsed) ? parsed : parsed.entries;
      if (!Array.isArray(list)) throw new Error("invalid format");
      setEntries(list);
      return { ok: true as const };
    } catch (err) {
      return {
        ok: false as const,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }, []);

  return {
    entries,
    upsertEntry,
    removeEntry,
    setVisit,
    toggleVisited,
    resetToSeed,
    exportData,
    importData,
  };
}
