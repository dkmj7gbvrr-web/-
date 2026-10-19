import { useState } from 'react'
import type { Recipe } from '../types'
import { formatDate } from '../recipeUtils'

export function RecipeDetail({
  recipe,
  onEdit,
  onDelete,
  onUpdate,
  onCooked,
}: {
  recipe: Recipe
  onEdit: () => void
  onDelete: () => void
  onUpdate: (patch: Partial<Recipe>) => void
  onCooked: (delta: number) => void
}) {
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const toggle = (i: number) =>
    setChecked((s) => {
      const n = new Set(s)
      if (n.has(i)) n.delete(i)
      else n.add(i)
      return n
    })

  return (
    <article className="page detail">
      {recipe.image && <img className="hero" src={recipe.image} alt="" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = 'none')} />}
      <h2 className="detail-title">{recipe.title}</h2>
      <div className="detail-meta">
        {recipe.url && (
          <a href={recipe.url} target="_blank" rel="noopener noreferrer">
            元のレシピを開く{recipe.source ? `（${recipe.source}）` : ''} ↗
          </a>
        )}
      </div>

      <div className="rating" role="radiogroup" aria-label="評価">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={recipe.rating === n}
            aria-label={`${n}つ星`}
            className={n <= recipe.rating ? 'star on' : 'star'}
            onClick={() => onUpdate({ rating: recipe.rating === n ? 0 : n })}
          >
            ★
          </button>
        ))}
      </div>

      <section className="card modes-card">
        <h3>ホットクックのモード</h3>
        {recipe.modes.length ? (
          <ul className="mode-list">
            {recipe.modes.map((m, i) => (
              <li key={i}>
                <span className={`badge big ${m.kind}`}>{m.label}</span>
                {m.snippet && <small className="snippet">原文: {m.snippet}</small>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">
            未設定です。
            <button className="link" onClick={onEdit}>
              編集
            </button>
            から追加できます。
          </p>
        )}
      </section>

      <section className="card">
        <h3>
          材料 {recipe.servings && <small className="servings">{recipe.servings}</small>}
        </h3>
        {recipe.ingredients.length ? (
          <ul className="ingredients">
            {recipe.ingredients.map((ing, i) =>
              /^[【[■●◆＜<]/.test(ing) ? (
                <li key={i} className="group-head">
                  {ing}
                </li>
              ) : (
                <li key={i}>
                  <label className={checked.has(i) ? 'done' : ''}>
                    <input type="checkbox" checked={checked.has(i)} onChange={() => toggle(i)} />
                    {ing}
                  </label>
                </li>
              ),
            )}
          </ul>
        ) : (
          <p className="hint">材料が登録されていません</p>
        )}
      </section>

      <section className="card">
        <h3>工程</h3>
        {recipe.steps.length ? (
          <ol className="steps">
            {recipe.steps.map((s, i) => (
              <li key={i} className={/^【.*】$/.test(s) ? 'group-head' : ''}>
                {s}
              </li>
            ))}
          </ol>
        ) : (
          <p className="hint">工程が登録されていません</p>
        )}
      </section>

      {(recipe.memo || recipe.tags.length > 0) && (
        <section className="card">
          {recipe.memo && (
            <>
              <h3>メモ</h3>
              <p className="memo">{recipe.memo}</p>
            </>
          )}
          {recipe.tags.length > 0 && (
            <div className="chips">
              {recipe.tags.map((t) => (
                <span key={t} className="chip tag static">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="card cooked">
        <div>
          <strong>作った回数 {recipe.cookedCount}回</strong>
          {recipe.lastCookedAt && <div className="hint">最後に作った日: {formatDate(recipe.lastCookedAt)}</div>}
        </div>
        <div className="row-buttons">
          {recipe.cookedCount > 0 && (
            <button className="ghost small" onClick={() => onCooked(-1)} aria-label="作った回数を1減らす">
              −1
            </button>
          )}
          <button className="primary" onClick={() => onCooked(1)}>
            作った！
          </button>
        </div>
      </section>

      <div className="row-buttons spread">
        <button
          className="danger ghost"
          onClick={() => {
            if (confirm(`「${recipe.title}」を削除しますか？`)) onDelete()
          }}
        >
          削除
        </button>
        <button className="primary" onClick={onEdit}>
          編集
        </button>
      </div>
      <p className="hint center">登録日 {formatDate(recipe.createdAt)}</p>
    </article>
  )
}
