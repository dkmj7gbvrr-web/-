import { useEffect, useRef, useState } from 'react'
import type { Recipe, RecipeDraft } from '../types'
import { fetchPageHtml, type FetchAttempt } from '../fetchPage'
import { parseRecipeHtml, parseRecipeText } from '../parse'
import { emptyDraft, findUrl, normalizeUrl } from '../recipeUtils'
import { RecipeEditor, type EditorValue } from './RecipeEditor'

type Tab = 'url' | 'text' | 'manual'

export function AddRecipe({
  recipes,
  proxyUrl,
  initialUrl,
  onSave,
  onCancel,
  onOpenExisting,
}: {
  recipes: Recipe[]
  proxyUrl: string
  initialUrl?: string
  onSave: (v: EditorValue) => void
  onCancel: () => void
  onOpenExisting: (id: string) => void
}) {
  const [tab, setTab] = useState<Tab>('url')
  const [url, setUrl] = useState(initialUrl ?? '')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<{ message: string; attempts?: FetchAttempt[] } | null>(null)
  const [draft, setDraft] = useState<RecipeDraft | null>(null)
  const ctlRef = useRef<AbortController | null>(null)
  const autoStarted = useRef(false)

  const duplicate = (() => {
    const u = findUrl(url)
    if (!u) return undefined
    const key = normalizeUrl(u)
    return recipes.find((r) => r.url && normalizeUrl(r.url) === key)
  })()

  const load = async () => {
    const target = findUrl(url)
    if (!target) {
      setError({ message: 'URL（https:// から始まるもの）を入れてください' })
      return
    }
    setError(null)
    ctlRef.current?.abort()
    const ctl = new AbortController()
    ctlRef.current = ctl
    try {
      const { html } = await fetchPageHtml(target, proxyUrl, ctl.signal, (via) => setBusy(`読み込み中…（${via} 経由）`))
      const d = parseRecipeHtml(html, target)
      if (!d.ingredients.length && !d.steps.length) {
        setError({ message: 'ページは開けましたが、材料・作り方を見つけられませんでした。ページの文章をコピーして「テキスト」タブに貼ると読めることがあります。' })
        setText('')
        setTab('text')
        setDraft(null)
        return
      }
      setDraft(d)
    } catch (e) {
      if (ctl.signal.aborted) return
      const attempts = (e as { attempts?: FetchAttempt[] }).attempts
      setError({
        message:
          'ページを取得できませんでした。サイト側が中継を拒否しているか、無料の中継サーバーが止まっている可能性があります。' +
          'ページの文章をコピーして「テキスト」タブに貼るか、設定で自分の中継サーバーを登録してください。',
        attempts,
      })
    } finally {
      if (ctlRef.current === ctl) setBusy(null)
    }
  }

  // 共有メニューから URL 付きで開かれたときは、そのまま読み込みを始める
  useEffect(() => {
    if (initialUrl && !autoStarted.current) {
      autoStarted.current = true
      void load()
    }
    return () => ctlRef.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const parseText = () => {
    if (!text.trim()) return
    const d = parseRecipeText(text, findUrl(url) ?? findUrl(text) ?? '')
    setError(null)
    setDraft(d)
  }

  if (draft) {
    return (
      <section className="page">
        <div className={`notice ${draft.method === 'jsonld' ? 'ok' : 'warn'}`}>
          {draft.method === 'jsonld'
            ? 'ページに埋め込まれたレシピ情報から読み取りました。'
            : draft.method === 'heuristic'
              ? '「材料」「作り方」の見出しから推測して読み取りました。間違いがないか確認してください。'
              : ''}
          {draft.modes.length === 0 && draft.method !== 'manual' && ' ホットクックのモードは見つからなかったので、手で追加してください。'}
        </div>
        <RecipeEditor initial={draft} submitLabel="保存する" onSubmit={onSave} onCancel={() => setDraft(null)} />
      </section>
    )
  }

  return (
    <section className="page">
      <h2 className="page-title">レシピを追加</h2>
      <div className="tabs" role="tablist">
        {(
          [
            ['url', 'URLから'],
            ['text', 'テキストから'],
            ['manual', '手入力'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'tab active' : 'tab'} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'url' && (
        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault()
            void load()
          }}
        >
          <label className="field">
            <span>レシピページのURL</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              type="text"
              inputMode="url"
              autoFocus={!initialUrl}
              placeholder="https://… を貼り付け"
            />
          </label>
          {duplicate && (
            <p className="notice warn">
              このURLは登録済みです：
              <button type="button" className="link" onClick={() => onOpenExisting(duplicate.id)}>
                {duplicate.title}
              </button>
            </p>
          )}
          <div className="row-buttons end">
            {busy && (
              <button type="button" className="ghost" onClick={() => ctlRef.current?.abort()}>
                やめる
              </button>
            )}
            <button type="submit" className="primary" disabled={!!busy}>
              {busy ?? '読み込む'}
            </button>
          </div>
          <p className="hint">料理名・材料・工程・ホットクックのモードを自動で取り出します。読み取った内容は保存前に直せます。</p>
        </form>
      )}

      {tab === 'text' && (
        <div className="card stack">
          <label className="field">
            <span>レシピの文章を貼り付け</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              placeholder={'ページを全選択してコピー → ここに貼り付け\n（Instagram・YouTube の説明欄、メモ帳の文章でもOK）'}
            />
          </label>
          <label className="field">
            <span>元レシピのURL（任意）</span>
            <input value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" placeholder="https://" />
          </label>
          <div className="row-buttons end">
            <button className="primary" onClick={parseText} disabled={!text.trim()}>
              読み取る
            </button>
          </div>
        </div>
      )}

      {tab === 'manual' && (
        <RecipeEditor initial={emptyDraft(findUrl(url) ?? '')} submitLabel="保存する" onSubmit={onSave} onCancel={onCancel} />
      )}

      {error && (
        <div className="notice error">
          <p>{error.message}</p>
          {error.attempts && (
            <details>
              <summary>詳細</summary>
              <ul>
                {error.attempts.map((a, i) => (
                  <li key={i}>
                    {a.via}: {a.error ?? 'OK'}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  )
}
