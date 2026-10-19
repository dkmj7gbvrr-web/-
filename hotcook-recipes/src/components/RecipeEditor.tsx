import { useState } from 'react'
import type { HotcookMode, RecipeDraft } from '../types'
import { extractModes } from '../parse/mode'

export interface EditorValue extends RecipeDraft {
  tags?: string[]
  memo?: string
}

const lines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean)

export function RecipeEditor({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: EditorValue
  submitLabel: string
  onSubmit: (v: EditorValue) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(initial.title)
  const [url, setUrl] = useState(initial.url)
  const [image, setImage] = useState(initial.image ?? '')
  const [servings, setServings] = useState(initial.servings ?? '')
  const [ingredients, setIngredients] = useState(initial.ingredients.join('\n'))
  const [steps, setSteps] = useState(initial.steps.join('\n'))
  const [modes, setModes] = useState<HotcookMode[]>(initial.modes)
  const [tags, setTags] = useState((initial.tags ?? []).join(' '))
  const [memo, setMemo] = useState(initial.memo ?? '')
  const [reextractNote, setReextractNote] = useState('')

  const updateMode = (i: number, label: string) =>
    setModes((ms) => ms.map((m, j) => (j === i ? { ...m, label } : m)))

  const reextract = () => {
    const found = extractModes([...lines(steps), memo])
    const known = new Set(modes.map((m) => m.label))
    const fresh = found.filter((m) => !known.has(m.label))
    setModes((ms) => [...ms, ...fresh])
    setReextractNote(fresh.length ? `${fresh.length}件追加しました` : '手順から新しいモードは見つかりませんでした')
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...initial,
      title: title.trim(),
      url: url.trim(),
      image: image.trim() || undefined,
      servings: servings.trim() || undefined,
      ingredients: lines(ingredients),
      steps: lines(steps),
      modes: modes.filter((m) => m.label.trim()).map((m) => ({ ...m, label: m.label.trim() })),
      tags: Array.from(new Set(tags.split(/[\s,、，#＃]+/).map((t) => t.trim()).filter(Boolean))),
      memo: memo.trim(),
    })
  }

  return (
    <form className="editor" onSubmit={submit}>
      <label className="field">
        <span>料理名</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例: 無水カレー" required />
      </label>

      <fieldset className="field modes-edit">
        <legend>ホットクックのモード</legend>
        {modes.length === 0 && <p className="hint">見つかりませんでした。下の「＋追加」で書き足せます（例: 手動 › 煮物を作る（まぜる） 30分）。</p>}
        {modes.map((m, i) => (
          <div key={i} className="mode-row">
            <input value={m.label} onChange={(e) => updateMode(i, e.target.value)} aria-label={`モード${i + 1}`} />
            <button type="button" className="icon-btn" onClick={() => setModes((ms) => ms.filter((_, j) => j !== i))} aria-label="このモードを削除">
              ×
            </button>
            {m.snippet && <small className="snippet">原文: {m.snippet}</small>}
          </div>
        ))}
        <div className="row-buttons">
          <button type="button" className="ghost" onClick={() => setModes((ms) => [...ms, { kind: 'other', label: '' }])}>
            ＋追加
          </button>
          <button type="button" className="ghost" onClick={reextract}>
            手順から探し直す
          </button>
        </div>
        {reextractNote && <p className="hint">{reextractNote}</p>}
      </fieldset>

      <label className="field">
        <span>材料（1行に1つ）</span>
        <textarea value={ingredients} onChange={(e) => setIngredients(e.target.value)} rows={Math.min(14, Math.max(4, initial.ingredients.length + 1))} />
      </label>
      <label className="field">
        <span>分量</span>
        <input value={servings} onChange={(e) => setServings(e.target.value)} placeholder="例: 2〜3人分" />
      </label>
      <label className="field">
        <span>工程（1行に1手順）</span>
        <textarea value={steps} onChange={(e) => setSteps(e.target.value)} rows={Math.min(16, Math.max(4, initial.steps.length + 2))} />
      </label>
      <label className="field">
        <span>タグ（スペース区切り）</span>
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="例: 鶏肉 作り置き 子ども好き" />
      </label>
      <label className="field">
        <span>メモ</span>
        <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={3} placeholder="例: 水は半分でOK。KN-HW16Gなら加熱は35分" />
      </label>
      <label className="field">
        <span>元レシピのURL</span>
        <input value={url} onChange={(e) => setUrl(e.target.value)} type="url" inputMode="url" placeholder="https://" />
      </label>
      <label className="field">
        <span>画像URL</span>
        <input value={image} onChange={(e) => setImage(e.target.value)} inputMode="url" placeholder="（なくてもOK）" />
      </label>

      <div className="sticky-actions">
        <button type="button" className="ghost" onClick={onCancel}>
          キャンセル
        </button>
        <button type="submit" className="primary">
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
