import { useRef, useState } from 'react'
import type { Recipe } from '../types'
import { exportJson, mergeImported, type Settings } from '../storage'
import { inviteLink, parseShareCode } from '../shareCode'
import type { Capacity } from '../parse/aiRecipe'

interface SyncInfo {
  status: 'off' | 'connecting' | 'live' | 'offline' | 'error'
}

function ShareSection({
  settings,
  recipeCount,
  sync,
  joinCode,
  onStart,
  onJoin,
  onLeave,
}: {
  settings: Settings
  recipeCount: number
  sync: SyncInfo
  joinCode?: string
  onStart: () => Promise<void>
  onJoin: (code: string, bringLocal: boolean) => Promise<void>
  onLeave: () => void
}) {
  const [input, setInput] = useState(joinCode ?? '')
  const [bringLocal, setBringLocal] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
      setMsg({ kind: 'ok', text: done })
    } catch (e) {
      const code = (e as { code?: string })?.code
      setMsg({
        kind: 'error',
        text:
          code === 'permission-denied'
            ? '共有レシピ帳に書き込めませんでした。Firebase のセキュリティルールが更新されていない可能性があります（README の「共有のための準備」参照）。'
            : '通信できませんでした。電波のよいところでもう一度試してください。',
      })
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    const link = inviteLink(settings.shareCode)
    try {
      if (navigator.share) {
        await navigator.share({ title: 'ホットクック野良レシピ帳', text: 'レシピ帳を一緒に使おう', url: link })
        return
      }
      await navigator.clipboard.writeText(link)
      setMsg({ kind: 'ok', text: '招待リンクをコピーしました' })
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return
      setMsg({ kind: 'error', text: `コピーできませんでした。このリンクを送ってください: ${link}` })
    }
  }

  if (settings.shareCode) {
    return (
      <div className="card stack">
        <h3>みんなで共有</h3>
        <p className="hint">
          同じ共有コードの人と、レシピの追加・編集・「作った！」がリアルタイムに同期されています。
          {sync.status === 'offline' && '（いまはオフラインです。つながると同期します）'}
        </p>
        <div className="share-code" aria-label="共有コード">
          {settings.shareCode}
        </div>
        <div className="row-buttons">
          <button className="primary" onClick={() => void copy()}>
            招待リンクを送る
          </button>
          <button
            className="ghost danger"
            onClick={() => {
              if (confirm('この端末での共有をやめますか？\n今あるレシピはこの端末に残ります。共有レシピ帳と他の人のデータは消えません。')) {
                onLeave()
                setMsg({ kind: 'ok', text: '共有をやめました。レシピはこの端末に残っています。' })
              }
            }}
          >
            共有をやめる
          </button>
        </div>
        <p className="hint">共有コード（招待リンク）を知っている人は誰でも見たり書き換えたりできます。信頼できる人にだけ送ってください。</p>
        {msg && <p className={`notice ${msg.kind}`}>{msg.text}</p>}
      </div>
    )
  }

  const parsed = parseShareCode(input)
  return (
    <div className="card stack">
      <h3>みんなで共有</h3>
      {joinCode && <p className="notice warn">招待リンクから開きました。「参加する」を押すと、この共有レシピ帳を一緒に使えます。</p>}
      <p className="hint">共有コードを使うと、家族や友だちと同じレシピ帳をリアルタイムに使えます。ログインは不要です。</p>

      {!joinCode && (
        <div className="share-option">
          <strong>新しく共有を始める</strong>
          <p className="hint">共有コードを作って、{recipeCount ? `この端末のレシピ${recipeCount}件を` : 'これから登録するレシピを'}共有レシピ帳に入れます。</p>
          <button className="primary" disabled={busy} onClick={() => void run(onStart, '共有を始めました。招待リンクを送って、一緒に使う人を招待しましょう。')}>
            共有を始める
          </button>
        </div>
      )}

      <div className="share-option">
        <strong>共有コードで参加する</strong>
        <label className="field">
          <span>共有コード（または招待リンク）</span>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="例: k7m2xq9pa4rt" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        </label>
        {recipeCount > 0 && (
          <label className="check">
            <input type="checkbox" checked={bringLocal} onChange={(e) => setBringLocal(e.target.checked)} />
            この端末のレシピ{recipeCount}件も共有レシピ帳に入れる
          </label>
        )}
        {input.trim() && !parsed && <p className="hint">共有コードは英小文字と数字で10文字以上です</p>}
        <button className="primary" disabled={busy || !parsed} onClick={() => parsed && void run(() => onJoin(parsed, bringLocal), '参加しました。')}>
          参加する
        </button>
      </div>
      {msg && <p className={`notice ${msg.kind}`}>{msg.text}</p>}
    </div>
  )
}

export function SettingsView({
  settings,
  recipes,
  onSettings,
  onReplaceRecipes,
  sync,
  joinCode,
  onStartSharing,
  onJoinSharing,
  onLeaveSharing,
}: {
  settings: Settings
  recipes: Recipe[]
  onSettings: (s: Settings) => void
  onReplaceRecipes: (recipes: Recipe[], changed: Recipe[]) => void
  sync: SyncInfo
  joinCode?: string
  onStartSharing: () => Promise<void>
  onJoinSharing: (code: string, bringLocal: boolean) => Promise<void>
  onLeaveSharing: () => void
}) {
  const [proxy, setProxy] = useState(settings.proxyUrl)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const download = () => {
    const blob = new Blob([exportJson({ recipes, settings })], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    const d = new Date()
    a.download = `hotcook-recipes-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    setMsg(`${recipes.length}件を書き出しました`)
  }

  const importFile = async (file: File) => {
    try {
      const { recipes: merged, changed, added, updated } = mergeImported(recipes, await file.text())
      onReplaceRecipes(merged, changed)
      setMsg(`読み込みました（追加 ${added}件・更新 ${updated}件）`)
    } catch (e) {
      setMsg(`読み込めませんでした: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return (
    <section className="page">
      <h2 className="page-title">設定</h2>

      <ShareSection
        settings={settings}
        recipeCount={recipes.length}
        sync={sync}
        joinCode={joinCode}
        onStart={onStartSharing}
        onJoin={onJoinSharing}
        onLeave={onLeaveSharing}
      />

      <div className="card stack">
        <h3>バックアップ・引っ越し</h3>
        <p className="hint">
          {settings.shareCode
            ? '共有中のレシピは共有レシピ帳（Firebase）に保存されています。念のため、ときどき書き出しておくと安心です。'
            : 'レシピはこの端末のブラウザの中だけに保存されています。ブラウザのデータを消すと消えるので、ときどき書き出しておくと安心です。'}
          別の端末で「読み込む」と、同じレシピが増えずにまとまります。
        </p>
        <div className="row-buttons">
          <button className="primary" onClick={download} disabled={recipes.length === 0}>
            書き出す（JSON）
          </button>
          <button className="ghost" onClick={() => fileRef.current?.click()}>
            読み込む
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importFile(f)
              e.target.value = ''
            }}
          />
        </div>
        {msg && <p className="notice ok">{msg}</p>}
      </div>

      <div className="card stack">
        <h3>お使いのホットクック</h3>
        <label className="field">
          <span>容量</span>
          <select
            value={settings.capacity}
            onChange={(e) => onSettings({ ...settings, capacity: e.target.value as Capacity })}
          >
            <option value="">指定しない</option>
            <option value="1.0L">1.0L</option>
            <option value="1.6L">1.6L</option>
            <option value="2.4L">2.4L</option>
          </select>
        </label>
        <p className="hint">
          AI チャットで画像を読み取るとき、容量ごとに時間が違うレシピは、ここで選んだ容量の分だけを書いてもらいます。この設定はこの端末だけに保存されます。
        </p>
      </div>

      <div className="card stack">
        <h3>ページ取得の中継サーバー</h3>
        <p className="hint">
          ブラウザから他のサイトのページを直接読むことはできないため、中継サーバーを経由して取得しています。
          空欄のときは無料の公開サーバーを使いますが、止まっていたりサイトに拒否されたりすることがあります。
          読み込みに失敗することが多い場合は、リポジトリの <code>hotcook-recipes/worker/cors-proxy.js</code> を Cloudflare Workers（無料枠あり）に置き、そのURLをここに入れてください。
        </p>
        <label className="field">
          <span>中継サーバーのURL</span>
          <input value={proxy} onChange={(e) => setProxy(e.target.value)} inputMode="url" placeholder="https://xxxx.workers.dev/" />
        </label>
        <div className="row-buttons end">
          <button
            className="primary"
            onClick={() => {
              onSettings({ ...settings, proxyUrl: proxy.trim() })
              setMsg('中継サーバーの設定を保存しました')
            }}
          >
            保存
          </button>
        </div>
      </div>

      <div className="card stack">
        <h3>このアプリについて</h3>
        <p className="hint">
          ホットクックのモードは、レシピ本文の「手動」「まぜる／まぜない」「◯分」「メニュー番号」などの言葉から推測して取り出しています。
          書き方によっては拾えなかったり、違うものを拾ったりするので、保存前・編集画面で直してください。
          メニュー番号は機種によって違うことがあります。
        </p>
      </div>
    </section>
  )
}
