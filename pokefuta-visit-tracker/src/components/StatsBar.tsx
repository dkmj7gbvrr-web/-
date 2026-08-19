import { useMemo, useState } from "react";
import type { PokefutaEntry } from "../types";

export function StatsBar({ entries }: { entries: PokefutaEntry[] }) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const stats = useMemo(() => {
    const total = entries.length;
    const visited = entries.filter((e) => e.visit.visited).length;
    const byPrefecture = new Map<string, { total: number; visited: number }>();
    for (const e of entries) {
      const cur = byPrefecture.get(e.prefecture) ?? { total: 0, visited: 0 };
      cur.total += 1;
      if (e.visit.visited) cur.visited += 1;
      byPrefecture.set(e.prefecture, cur);
    }
    return { total, visited, byPrefecture };
  }, [entries]);

  const percent = stats.total === 0 ? 0 : Math.round((stats.visited / stats.total) * 100);

  return (
    <div className="stats-bar">
      <div className="stats-summary">
        <div className="stats-numbers">
          <strong>{stats.visited}</strong> / {stats.total} 訪問済み ({percent}%)
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>
        <button className="link-btn" onClick={() => setShowBreakdown((v) => !v)}>
          都道府県別内訳{showBreakdown ? "を隠す" : "を表示"}
        </button>
      </div>
      {showBreakdown && (
        <div className="prefecture-breakdown">
          {[...stats.byPrefecture.entries()]
            .sort((a, b) => a[0].localeCompare(b[0], "ja"))
            .map(([pref, s]) => (
              <div key={pref} className="prefecture-row">
                <span>{pref}</span>
                <span>
                  {s.visited} / {s.total}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
