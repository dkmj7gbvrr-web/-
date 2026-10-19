import { useCallback, useEffect, useState } from 'react'
import type { Recipe } from './types'
import { load, requestPersistence, save, type StoreData } from './storage'
import { draftToRecipe, findUrl } from './recipeUtils'
import { RecipeList } from './components/RecipeList'
import { RecipeDetail } from './components/RecipeDetail'
import { AddRecipe } from './components/AddRecipe'
import { RecipeEditor, type EditorValue } from './components/RecipeEditor'
import { SettingsView } from './components/SettingsView'
import { isOutdated, reloadToLatest } from './version'

type Route = { name: 'list' } | { name: 'add' } | { name: 'settings' } | { name: 'detail'; id: string } | { name: 'edit'; id: string }

function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, '')
  if (h === 'add') return { name: 'add' }
  if (h === 'settings') return { name: 'settings' }
  const m = h.match(/^r\/([^/]+)(\/edit)?$/)
  if (m) return m[2] ? { name: 'edit', id: decodeURIComponent(m[1]) } : { name: 'detail', id: decodeURIComponent(m[1]) }
  return { name: 'list' }
}

function go(path: string, replace = false) {
  const hash = `#/${path}`
  if (replace) history.replaceState(null, '', hash)
  else history.pushState(null, '', hash)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

/** 共有メニュー（Android の共有先・PWA の share_target）から渡された URL を取り出し、アドレスバーから消す */
function takeSharedUrl(): string | undefined {
  const params = new URLSearchParams(window.location.search)
  const shared = findUrl([params.get('url'), params.get('text'), params.get('title')].filter(Boolean).join(' '))
  if (params.has('url') || params.has('text') || params.has('title')) {
    params.delete('url')
    params.delete('text')
    params.delete('title')
    const qs = params.toString()
    history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${shared ? '#/add' : window.location.hash}`)
  }
  return shared
}

// モジュール読み込み時に1回だけ取り出す（React の再描画のたびに読まないように）
const initialSharedUrl = takeSharedUrl()

export default function App() {
  const [data, setData] = useState<StoreData>(load)
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))
  // 共有された URL は最初の「追加」画面で1回だけ使う（あとで追加画面を開き直したときに再利用しない）
  const [sharedUrl, setSharedUrl] = useState(initialSharedUrl)
  const [saveFailed, setSaveFailed] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash(window.location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHash)
    window.addEventListener('popstate', onHash)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('popstate', onHash)
    }
  }, [])

  useEffect(() => {
    if (sharedUrl && route.name !== 'add') setSharedUrl(undefined)
  }, [route.name, sharedUrl])

  useEffect(() => {
    setSaveFailed(!save(data))
  }, [data])

  useEffect(() => {
    if (data.recipes.length > 0) void requestPersistence()
  }, [data.recipes.length])

  // 入力途中の画面では勝手に読み込み直さず、バナーで知らせる
  const editing = route.name === 'add' || route.name === 'edit'
  useEffect(() => {
    const check = async () => {
      if (!(await isOutdated())) return
      if (editing) setUpdateReady(true)
      else reloadToLatest()
    }
    void check()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [editing])

  const setRecipes = useCallback((fn: (rs: Recipe[]) => Recipe[]) => setData((d) => ({ ...d, recipes: fn(d.recipes) })), [])

  const updateRecipe = (id: string, patch: Partial<Recipe>) =>
    setRecipes((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r)))

  const addFromEditor = (v: EditorValue) => {
    const r = draftToRecipe(v, { tags: v.tags ?? [], memo: v.memo ?? '' })
    setRecipes((rs) => [r, ...rs])
    go(`r/${encodeURIComponent(r.id)}`, true)
  }

  const current = route.name === 'detail' || route.name === 'edit' ? data.recipes.find((r) => r.id === route.id) : undefined

  let body: React.ReactNode
  if (route.name === 'add') {
    body = (
      <AddRecipe
        recipes={data.recipes}
        proxyUrl={data.settings.proxyUrl}
        initialUrl={sharedUrl}
        onSave={addFromEditor}
        onCancel={() => history.back()}
        onOpenExisting={(id) => go(`r/${encodeURIComponent(id)}`, true)}
      />
    )
  } else if (route.name === 'settings') {
    body = (
      <SettingsView
        settings={data.settings}
        recipes={data.recipes}
        onSettings={(settings) => setData((d) => ({ ...d, settings }))}
        onReplaceRecipes={(recipes) => setData((d) => ({ ...d, recipes }))}
      />
    )
  } else if ((route.name === 'detail' || route.name === 'edit') && !current) {
    body = (
      <section className="page empty">
        <p>レシピが見つかりません（削除された可能性があります）</p>
        <button className="primary" onClick={() => go('', true)}>
          一覧へ
        </button>
      </section>
    )
  } else if (route.name === 'detail' && current) {
    body = (
      <RecipeDetail
        recipe={current}
        onEdit={() => go(`r/${encodeURIComponent(current.id)}/edit`)}
        onDelete={() => {
          setRecipes((rs) => rs.filter((r) => r.id !== current.id))
          go('', true)
        }}
        onUpdate={(patch) => updateRecipe(current.id, patch)}
      />
    )
  } else if (route.name === 'edit' && current) {
    body = (
      <section className="page">
        <h2 className="page-title">編集</h2>
        <RecipeEditor
          initial={{ ...current, method: 'manual' }}
          submitLabel="保存する"
          onSubmit={(v) => {
            updateRecipe(current.id, {
              title: v.title || current.title,
              url: v.url,
              image: v.image,
              servings: v.servings,
              ingredients: v.ingredients,
              steps: v.steps,
              modes: v.modes,
              tags: v.tags ?? [],
              memo: v.memo ?? '',
            })
            history.back()
          }}
          onCancel={() => history.back()}
        />
      </section>
    )
  } else {
    body = <RecipeList recipes={data.recipes} onOpen={(id) => go(`r/${encodeURIComponent(id)}`)} onAdd={() => go('add')} />
  }

  return (
    <div className="app">
      <header className="topbar">
        {route.name === 'list' ? (
          <h1 className="brand">
            <span aria-hidden>🍲</span> ホットクック野良レシピ帳
          </h1>
        ) : (
          <button className="back" onClick={() => (history.length > 1 ? history.back() : go('', true))} aria-label="戻る">
            ‹ 戻る
          </button>
        )}
        <div className="topbar-actions">
          {route.name === 'list' && (
            <button className="icon-btn" onClick={() => go('settings')} aria-label="設定">
              ⚙
            </button>
          )}
        </div>
      </header>

      {updateReady && (
        <div className="banner">
          新しい版があります。
          <button className="link" onClick={reloadToLatest}>
            今すぐ更新
          </button>
          （入力中の内容は消えます）
        </div>
      )}
      {saveFailed && <div className="banner error">この端末に保存できませんでした（プライベートブラウズ中や容量不足の可能性）。設定から書き出しておいてください。</div>}

      <main>{body}</main>

      {route.name === 'list' && data.recipes.length > 0 && (
        <button className="fab" onClick={() => go('add')} aria-label="レシピを追加">
          ＋
        </button>
      )}
    </div>
  )
}
