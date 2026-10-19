import { useEffect, useRef, useState } from 'react'
import type { Recipe, RecipeDraft } from '../types'
import { fetchPageHtml, type FetchAttempt } from '../fetchPage'
import { parseRecipeHtml, parseRecipeText } from '../parse'
import { emptyDraft, findUrl, normalizeUrl } from '../recipeUtils'
import { recognizeImages } from '../ocr'
import { CLAUDE_NEW_SESSION_URL, CLAUDE_SESSION_URL, claudePrompt, isMasterCode } from '../claudeLink'
import { RecipeEditor, type EditorValue } from './RecipeEditor'

type Tab = 'url' | 'image' | 'text' | 'manual'

export function AddRecipe({
  recipes,
  proxyUrl,
  shareCode,
  initialUrl,
  onSave,
  onCancel,
  onOpenExisting,
}: {
  recipes: Recipe[]
  proxyUrl: string
  shareCode: string
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
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [ocrBusy, setOcrBusy] = useState<string | null>(null)
  const [fromImage, setFromImage] = useState(false)
  const [isMaster, setIsMaster] = useState(false)
  const [claudeNote, setClaudeNote] = useState('')

  // マスタのレシピ帳（共有コードがハッシュと一致）のときだけ「Claude で登録」を出す
  useEffect(() => {
    let cancelled = false
    isMasterCode(shareCode)
      .then((ok) => !cancelled && setIsMaster(ok))
      .catch(() => !cancelled && setIsMaster(false))
    return () => {
      cancelled = true
    }
  }, [shareCode])

  const openClaude = (target: string) => {
    // コピーはこのページにフォーカスがあるうちに始め、そのあと同じクリックの中で新しいタブを開く
    // （先にタブを開くとフォーカスが移ってコピーが失敗し、await 後に開くとポップアップとして止められる）
    const text = claudePrompt(shareCode, findUrl(url))
    const copied = navigator.clipboard?.writeText(text) ?? Promise.reject(new Error('clipboard unavailable'))
    window.open(target, '_blank', 'noopener')
    copied
      .then(() => setClaudeNote('依頼文をコピーしました。チャットに貼り付けて、続けてスクショを貼ってください。'))
      .catch(() => setClaudeNote(`チャットにこう書いてください：${text}`))
  }
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

  const parseText = (source = text, viaImage = false) => {
    if (!source.trim()) return
    const d = parseRecipeText(source, findUrl(url) ?? findUrl(source) ?? '')
    setError(null)
    setFromImage(viaImage)
    setDraft(d)
  }

  // 選んだ画像のプレビュー（URL は使い終わったら解放する）
  useEffect(() => {
    const urls = images.map((f) => URL.createObjectURL(f))
    setPreviews(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [images])

  const readImages = async () => {
    if (!images.length) return
    setError(null)
    try {
      const recognized = await recognizeImages(images, ({ index, total, phase, ratio }) => {
        const n = total > 1 ? `${index + 1}/${total}枚目 ` : ''
        setOcrBusy(phase === 'loading' ? '読み取りの準備中…（初回は数MBのデータを読み込みます）' : `文字を読み取り中… ${n}${Math.round(ratio * 100)}%`)
      })
      if (!recognized.trim()) {
        setError({ message: '画像から文字を読み取れませんでした。文字がはっきり写っている画像で試してください。' })
        return
      }
      // 読み取った文字は「テキストから」タブにも入れておき、直してから読み直せるようにする
      setText(recognized)
      setTab('text')
      parseText(recognized, true)
    } catch {
      setError({ message: '文字の読み取りに失敗しました。通信状態を確認して、もう一度試してください。' })
    } finally {
      setOcrBusy(null)
    }
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
          {fromImage && ' 画像の文字読み取りは誤字が出やすいので、特に分量と時間を確認してください。'}
          {draft.modes.length === 0 && draft.method !== 'manual' && ' ホットクックのモードは見つからなかったので、手で追加してください。'}
        </div>
        <RecipeEditor initial={draft} submitLabel="保存する" onSubmit={onSave} onCancel={() => setDraft(null)} />
      </section>
    )
  }

  return (
    <section className="page">
      <h2 className="page-title">レシピを追加</h2>
      {isMaster && (
        <div className="card stack claude-card">
          <strong>🤖 Claude で登録</strong>
          <p className="hint">
            Claude のチャットを開きます。依頼文（共有コード入り）をコピーするので、チャットに貼り付けてからスクショを貼ってください。
            Claude が読み取って、このレシピ帳に直接登録します。
          </p>
          <div className="row-buttons">
            <button className="primary" onClick={() => openClaude(CLAUDE_SESSION_URL)}>
              Claude のチャットを開く
            </button>
            <button className="ghost small" onClick={() => openClaude(CLAUDE_NEW_SESSION_URL)}>
              新しいチャットで
            </button>
          </div>
          {claudeNote && <p className="notice ok">{claudeNote}</p>}
          <p className="hint">「新しいチャットで」のときは、リポジトリ dkmj7gbvrr-web/- を選んでから貼ってください。</p>
        </div>
      )}
      <div className="tabs" role="tablist">
        {(
          [
            ['url', 'URL'],
            ['image', '画像'],
            ['text', 'テキスト'],
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

      {tab === 'image' && (
        <div className="card stack">
          <label className="file-pick">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                setImages(Array.from(e.target.files ?? []))
                e.target.value = ''
              }}
            />
            <span className="file-pick-button">📷 スクリーンショットを選ぶ</span>
            <span className="hint">{images.length ? `${images.length}枚選択中` : '複数枚まとめて選べます'}</span>
          </label>
          {previews.length > 0 && (
            <div className="image-previews">
              {previews.map((src, i) => (
                <figure key={src}>
                  <img src={src} alt={`${i + 1}枚目`} />
                  <figcaption>{i + 1}</figcaption>
                </figure>
              ))}
            </div>
          )}
          <div className="row-buttons end">
            {images.length > 0 && !ocrBusy && (
              <button className="ghost" onClick={() => setImages([])}>
                選び直す
              </button>
            )}
            <button className="primary" onClick={() => void readImages()} disabled={!images.length || !!ocrBusy}>
              {ocrBusy ?? (images.length > 1 ? `${images.length}枚を読み取る` : '読み取る')}
            </button>
          </div>
          <p className="hint">
            レシピが複数枚にまたがるときは、上から順にまとめて選んでください（選んだ順につなげて読みます）。
            文字の読み取りはこの端末の中だけで行い、画像はどこにも送りません。
          </p>
        </div>
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
            <button className="primary" onClick={() => parseText()} disabled={!text.trim()}>
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
