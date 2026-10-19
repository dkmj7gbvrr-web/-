import { useMemo, useState } from 'react'
import type { Recipe } from '../types'
import { matchesQuery, recipeGroups, sortRecipes, type SortKey } from '../recipeUtils'

const SORTS: [SortKey, string][] = [
  ['new', '登録が新しい順'],
  ['recent', '最近作った順'],
  ['cooked', 'よく作る順'],
  ['rating', '評価が高い順'],
  ['name', '名前順'],
]

function readPref<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T | null) ?? fallback
  } catch {
    return fallback
  }
}

function writePref(key: string, v: string) {
  try {
    localStorage.setItem(key, v)
  } catch {
    // 保存できなくても動作は続ける
  }
}

/** 画像が無い・読めない（リンク切れ、直リンク禁止）ときは鍋の絵にする */
function Thumb({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className="thumb-placeholder" aria-hidden>
        🍲
      </div>
    )
  }
  return <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
}

export function RecipeList({ recipes, onOpen, onAdd }: { recipes: Recipe[]; onOpen: (id: string) => void; onAdd: () => void }) {
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<string>('')
  const [tag, setTag] = useState<string>('')
  const [sort, setSort] = useState<SortKey>(() => readPref<SortKey>('hotcook-recipes:sort', 'new'))

  const groups = useMemo(() => {
    const count = new Map<string, number>()
    for (const r of recipes) for (const g of recipeGroups(r)) count.set(g, (count.get(g) ?? 0) + 1)
    return Array.from(count.entries()).sort((a, b) => b[1] - a[1])
  }, [recipes])

  const tags = useMemo(() => {
    const count = new Map<string, number>()
    for (const r of recipes) for (const t of r.tags) count.set(t, (count.get(t) ?? 0) + 1)
    return Array.from(count.entries()).sort((a, b) => b[1] - a[1])
  }, [recipes])

  const shown = useMemo(
    () =>
      sortRecipes(
        recipes.filter((r) => matchesQuery(r, q) && (!group || recipeGroups(r).includes(group)) && (!tag || r.tags.includes(tag))),
        sort,
      ),
    [recipes, q, group, tag, sort],
  )

  if (recipes.length === 0) {
    return (
      <section className="page empty">
        <div className="empty-icon" aria-hidden>
          🍲
        </div>
        <h2>まだレシピがありません</h2>
        <p>気になるホットクックのレシピのURLを貼ると、料理名・材料・工程・使うモードをまとめて保存できます。</p>
        <button className="primary big" onClick={onAdd}>
          ＋ 最初のレシピを追加
        </button>
      </section>
    )
  }

  return (
    <section className="page">
      <div className="toolbar">
        <input className="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="料理名・材料で検索" />
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as SortKey)
            writePref('hotcook-recipes:sort', e.target.value)
          }}
          aria-label="並び順"
        >
          {SORTS.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="chips" aria-label="モードで絞り込み">
        <button className={!group ? 'chip active' : 'chip'} onClick={() => setGroup('')}>
          すべて {recipes.length}
        </button>
        {groups.map(([g, n]) => (
          <button key={g} className={group === g ? 'chip active' : 'chip'} onClick={() => setGroup(group === g ? '' : g)}>
            {g} {n}
          </button>
        ))}
      </div>
      {tags.length > 0 && (
        <div className="chips tags" aria-label="タグで絞り込み">
          {tags.map(([t, n]) => (
            <button key={t} className={tag === t ? 'chip tag active' : 'chip tag'} onClick={() => setTag(tag === t ? '' : t)}>
              #{t} {n}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 && <p className="hint center">条件に合うレシピがありません</p>}
      <ul className="cards">
        {shown.map((r) => (
          <li key={r.id}>
            <button className="recipe-card" onClick={() => onOpen(r.id)}>
              <Thumb src={r.image} />
              <div className="card-body">
                <div className="card-title">{r.title}</div>
                <div className="mode-badges">
                  {r.modes.length ? (
                    r.modes.slice(0, 2).map((m, i) => (
                      <span key={i} className={`badge ${m.kind}`}>
                        {m.label}
                      </span>
                    ))
                  ) : (
                    <span className="badge none">モード未設定</span>
                  )}
                  {r.modes.length > 2 && <span className="badge more">+{r.modes.length - 2}</span>}
                </div>
                <div className="card-sub">
                  {r.ingredients
                    .filter((i) => !/^[【[■●◆]/.test(i))
                    .slice(0, 5)
                    .map((i) => i.split(/[\s　…・:：]+/)[0])
                    .join('・')}
                </div>
                <div className="card-meta">
                  {r.rating > 0 && <span className="stars">{'★'.repeat(r.rating)}</span>}
                  {r.cookedCount > 0 && <span>作った {r.cookedCount}回</span>}
                  {r.source && <span className="source">{r.source}</span>}
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
