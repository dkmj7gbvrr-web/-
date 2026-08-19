import type { PokefutaEntry } from "../types";

interface ListViewProps {
  entries: PokefutaEntry[];
  onToggleVisited: (id: string) => void;
  onDateChange: (id: string, date: string) => void;
  onEdit: (entry: PokefutaEntry) => void;
  onRemove: (id: string) => void;
  onFocus: (entry: PokefutaEntry) => void;
}

export function ListView({
  entries,
  onToggleVisited,
  onDateChange,
  onEdit,
  onRemove,
  onFocus,
}: ListViewProps) {
  if (entries.length === 0) {
    return <p className="empty-state">条件に一致するポケふたがありません。</p>;
  }

  return (
    <div className="list-view">
      <table>
        <thead>
          <tr>
            <th>訪問</th>
            <th>名前</th>
            <th>都道府県</th>
            <th>市区町村</th>
            <th>ポケモン</th>
            <th>訪問日</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className={entry.visit.visited ? "row-visited" : ""}>
              <td>
                <input
                  type="checkbox"
                  checked={entry.visit.visited}
                  onChange={() => onToggleVisited(entry.id)}
                  aria-label={`${entry.name}を訪問済みにする`}
                />
              </td>
              <td>
                <button className="link-btn" onClick={() => onFocus(entry)}>
                  {entry.name}
                </button>
                {!entry.verified && <span className="badge-unverified">未確認</span>}
              </td>
              <td>{entry.prefecture}</td>
              <td>{entry.city}</td>
              <td>{entry.pokemons.join(" / ") || "-"}</td>
              <td>
                {entry.visit.visited ? (
                  <input
                    type="date"
                    value={entry.visit.visitedDate ?? ""}
                    onChange={(e) => onDateChange(entry.id, e.target.value)}
                  />
                ) : (
                  "-"
                )}
              </td>
              <td className="row-actions">
                <button onClick={() => onEdit(entry)}>編集</button>
                <button
                  className="danger"
                  onClick={() => {
                    if (window.confirm(`「${entry.name}」を削除しますか？`)) {
                      onRemove(entry.id);
                    }
                  }}
                >
                  削除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
