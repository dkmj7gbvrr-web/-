import { useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "./App.css";
import { useAppData } from "./hooks/useAppData";
import { MapView } from "./components/MapView";
import { ListView } from "./components/ListView";
import { StatsBar } from "./components/StatsBar";
import { EditModal } from "./components/EditModal";
import type { PokefutaEntry } from "./types";

type ViewMode = "map" | "list";
type VisitedFilter = "all" | "visited" | "unvisited";

function App() {
  const {
    entries,
    upsertEntry,
    removeEntry,
    setVisit,
    toggleVisited,
    resetToSeed,
    exportData,
    importData,
  } = useAppData();

  const [view, setView] = useState<ViewMode>("map");
  const [search, setSearch] = useState("");
  const [prefectureFilter, setPrefectureFilter] = useState("all");
  const [visitedFilter, setVisitedFilter] = useState<VisitedFilter>("all");
  const [editTarget, setEditTarget] = useState<PokefutaEntry | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [focusTarget, setFocusTarget] = useState<[number, number] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const prefectures = useMemo(
    () => [...new Set(entries.map((e) => e.prefecture))].sort((a, b) => a.localeCompare(b, "ja")),
    [entries],
  );

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (prefectureFilter !== "all" && e.prefecture !== prefectureFilter) return false;
      if (visitedFilter === "visited" && !e.visit.visited) return false;
      if (visitedFilter === "unvisited" && e.visit.visited) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const haystack = `${e.name} ${e.prefecture} ${e.city} ${e.pokemons.join(" ")}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [entries, prefectureFilter, visitedFilter, search]);

  function handleDateChange(id: string, date: string) {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    setVisit(id, { ...entry.visit, visited: true, visitedDate: date });
  }

  function handleFocus(entry: PokefutaEntry) {
    setFocusTarget([entry.lat, entry.lng]);
    setView("map");
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    const result = importData(text);
    if (!result.ok) {
      window.alert(`インポートに失敗しました: ${result.message}`);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>ポケふた訪問トラッカー</h1>
        <p className="header-sub">
          全国のポケモンマンホール「ポケふた」を地図・一覧で管理し、訪問状況と訪問日を記録できます。
        </p>
      </header>

      <div className="data-disclaimer">
        ⚠ 初期収録データはデモ用のサンプルです。座標・設置ポケモンは
        <a href="https://local.pokemon.jp/manhole/" target="_blank" rel="noreferrer">
          ポケふた公式サイト
        </a>
        で必ずご確認のうえ、「編集」機能で正しい情報に更新・追加してご利用ください。
      </div>

      <StatsBar entries={entries} />

      <div className="toolbar">
        <div className="view-switch">
          <button className={view === "map" ? "active" : ""} onClick={() => setView("map")}>
            地図
          </button>
          <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>
            一覧
          </button>
        </div>

        <input
          className="search-input"
          type="search"
          placeholder="名前・都道府県・ポケモンで検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select value={prefectureFilter} onChange={(e) => setPrefectureFilter(e.target.value)}>
          <option value="all">すべての都道府県</option>
          {prefectures.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <select
          value={visitedFilter}
          onChange={(e) => setVisitedFilter(e.target.value as VisitedFilter)}
        >
          <option value="all">すべて</option>
          <option value="visited">訪問済みのみ</option>
          <option value="unvisited">未訪問のみ</option>
        </select>

        <div className="toolbar-actions">
          <button
            onClick={() => {
              setEditTarget(null);
              setShowModal(true);
            }}
          >
            + 追加
          </button>
          <button onClick={exportData}>エクスポート</button>
          <button onClick={handleImportClick}>インポート</button>
          <button className="danger" onClick={resetToSeed}>
            リセット
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
        </div>
      </div>

      <main className="main-content">
        {view === "map" ? (
          <MapView
            entries={filteredEntries}
            focusTarget={focusTarget}
            onToggleVisited={toggleVisited}
            onEdit={(entry) => {
              setEditTarget(entry);
              setShowModal(true);
            }}
            onDateChange={handleDateChange}
          />
        ) : (
          <ListView
            entries={filteredEntries}
            onToggleVisited={toggleVisited}
            onDateChange={handleDateChange}
            onEdit={(entry) => {
              setEditTarget(entry);
              setShowModal(true);
            }}
            onRemove={removeEntry}
            onFocus={handleFocus}
          />
        )}
      </main>

      {showModal && (
        <EditModal
          initial={editTarget}
          onClose={() => setShowModal(false)}
          onSave={(entry) => {
            upsertEntry(entry);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}

export default App;
