import { useCallback, useEffect, useRef, useState } from 'react'
import type { Recipe } from './types'
import { load, requestPersistence, save, type StoreData } from './storage'
import { draftToRecipe, findUrl } from './recipeUtils'
import { RecipeList } from './components/RecipeList'
import { RecipeDetail } from './components/RecipeDetail'
import { AddRecipe } from './components/AddRecipe'
import { RecipeEditor, type EditorValue } from './components/RecipeEditor'
import { SettingsView } from './components/SettingsView'
import { isOutdated, reloadToLatest } from './version'
import { generateShareCode, parseShareCode } from './shareCode'
import type { SyncErrorKind } from './sync'

type SyncModule = typeof import('./sync')
type SyncStatus = { status: 'off' | 'connecting' | 'live' | 'offline' | 'error'; error?: SyncErrorKind }

let syncModule: Promise<SyncModule> | null = null
/** Firebase の SDK は共有を使うときだけ読み込む */
function loadSync(): Promise<SyncModule> {
  syncModule ??= import('./sync')
  return syncModule
}

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

/** 招待リンク（?join=共有コード）から開かれたら、コードを取り出して設定画面へ */
function takeJoinCode(): string | undefined {
  const params = new URLSearchParams(window.location.search)
  if (!params.has('join')) return undefined
  const code = parseShareCode(params.get('join') ?? '') ?? undefined
  params.delete('join')
  const qs = params.toString()
  history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}#/settings`)
  return code
}

// モジュール読み込み時に1回だけ取り出す（React の再描画のたびに読まないように）
const initialSharedUrl = takeSharedUrl()
const initialJoinCode = takeJoinCode()

export default function App() {
  const [data, setData] = useState<StoreData>(load)
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))
  // 共有された URL は最初の「追加」画面で1回だけ使う（あとで追加画面を開き直したときに再利用しない）
  const [sharedUrl, setSharedUrl] = useState(initialSharedUrl)
  const [joinCode, setJoinCode] = useState(initialJoinCode)
  const [saveFailed, setSaveFailed] = useState(false)
  const [sync, setSync] = useState<SyncStatus>({ status: 'off' })
  const [writeError, setWriteError] = useState<SyncErrorKind | null>(null)
  const shareCode = data.settings.shareCode
  const recipesRef = useRef(data.recipes)
  recipesRef.current = data.recipes
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
    if (joinCode && route.name !== 'settings') setJoinCode(undefined)
  }, [route.name, sharedUrl, joinCode])

  // 共有コードがあれば Firestore の内容を購読し、届いたものを一覧にする
  useEffect(() => {
    if (!shareCode) {
      setSync({ status: 'off' })
      return
    }
    let cancelled = false
    let unsubscribe: (() => void) | undefined
    setSync({ status: 'connecting' })
    setWriteError(null)
    loadSync()
      .then((m) => {
        if (cancelled) return
        unsubscribe = m.subscribeRecipes(
          shareCode,
          (recipes, fromCache) => {
            // オフラインで開いたとき、空の手元キャッシュで控えの一覧を消さない
            if (fromCache && recipes.length === 0 && recipesRef.current.length > 0) {
              setSync({ status: 'offline' })
              return
            }
            setData((d) => (d.settings.shareCode === shareCode ? { ...d, recipes } : d))
            setSync({ status: fromCache ? 'offline' : 'live' })
          },
          (e) => setSync({ status: 'error', error: m.classifyError(e) }),
        )
      })
      .catch(() => {
        if (!cancelled) setSync({ status: 'error', error: 'network' })
      })
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [shareCode])

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

  /** 共有中なら Firestore にも書く。画面は先に手元で更新し、届いた内容で上書きされる */
  const remote = (fn: (m: SyncModule, code: string) => Promise<void>) => {
    if (!shareCode) return
    const code = shareCode
    loadSync()
      .then((m) => fn(m, code).catch((e) => setWriteError(m.classifyError(e))))
      .catch(() => setWriteError('network'))
  }

  const addRecipe = (r: Recipe) => {
    setRecipes((rs) => [r, ...rs])
    remote((m, code) => m.putRecipe(code, r))
  }

  const updateRecipe = (id: string, patch: Partial<Recipe>) => {
    const full = { ...patch, updatedAt: new Date().toISOString() }
    setRecipes((rs) => rs.map((r) => (r.id === id ? { ...r, ...full } : r)))
    remote((m, code) => m.patchRecipe(code, id, full))
  }

  const cooked = (id: string, delta: number) => {
    const lastCookedAt = delta > 0 ? new Date().toISOString() : undefined
    setRecipes((rs) =>
      rs.map((r) => (r.id === id ? { ...r, cookedCount: Math.max(0, r.cookedCount + delta), lastCookedAt: lastCookedAt ?? r.lastCookedAt } : r)),
    )
    remote((m, code) => m.bumpCooked(code, id, delta, lastCookedAt))
  }

  const deleteRecipe = (id: string) => {
    setRecipes((rs) => rs.filter((r) => r.id !== id))
    remote((m, code) => m.removeRecipe(code, id))
  }

  /** JSON の読み込み結果を反映する（共有中は増えた・新しくなったものだけ書く） */
  const replaceRecipes = (recipes: Recipe[], changed: Recipe[]) => {
    setRecipes(() => recipes)
    if (changed.length) remote((m, code) => m.putRecipes(code, changed))
  }

  const startSharing = async () => {
    const m = await loadSync()
    const code = generateShareCode()
    await m.checkAccess(code)
    await m.putRecipes(code, recipesRef.current)
    setData((d) => ({ ...d, settings: { ...d.settings, shareCode: code } }))
  }

  const joinSharing = async (code: string, bringLocal: boolean) => {
    const m = await loadSync()
    await m.checkAccess(code)
    if (bringLocal && recipesRef.current.length) await m.putRecipes(code, recipesRef.current)
    else setRecipes(() => [])
    setJoinCode(undefined)
    setData((d) => ({ ...d, settings: { ...d.settings, shareCode: code } }))
  }

  // 共有をやめても、最後に受け取ったレシピはこの端末に残す
  const leaveSharing = () => setData((d) => ({ ...d, settings: { ...d.settings, shareCode: '' } }))

  const addFromEditor = (v: EditorValue) => {
    const r = draftToRecipe(v, { tags: v.tags ?? [], memo: v.memo ?? '' })
    addRecipe(r)
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
        onReplaceRecipes={replaceRecipes}
        sync={sync}
        joinCode={joinCode}
        onStartSharing={startSharing}
        onJoinSharing={joinSharing}
        onLeaveSharing={leaveSharing}
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
          deleteRecipe(current.id)
          go('', true)
        }}
        onUpdate={(patch) => updateRecipe(current.id, patch)}
        onCooked={(delta) => cooked(current.id, delta)}
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
            {shareCode && (
              <span className={`sync-pill ${sync.status}`} title="共有コードでリアルタイム同期しています">
                {sync.status === 'live' ? '共有中' : sync.status === 'connecting' ? '接続中…' : sync.status === 'offline' ? 'オフライン' : '同期エラー'}
              </span>
            )}
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
      {shareCode && (sync.status === 'error' || writeError) && (
        <div className="banner error">
          {(sync.error ?? writeError) === 'permission'
            ? '共有レシピ帳にアクセスできませんでした。Firebase のセキュリティルールが更新されていない可能性があります（README の「共有のための準備」参照）。'
            : (sync.error ?? writeError) === 'network'
              ? '通信できませんでした。つながると自動で同期します。'
              : '同期中にエラーが起きました。ページを開き直してみてください。'}
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
