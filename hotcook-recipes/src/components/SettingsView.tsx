import { useRef, useState } from 'react'
import type { Recipe } from '../types'
import { exportJson, mergeImported, type Settings } from '../storage'

export function SettingsView({
  settings,
  recipes,
  onSettings,
  onReplaceRecipes,
}: {
  settings: Settings
  recipes: Recipe[]
  onSettings: (s: Settings) => void
  onReplaceRecipes: (r: Recipe[]) => void
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
      const [merged, added, updated] = mergeImported(recipes, await file.text())
      onReplaceRecipes(merged)
      setMsg(`読み込みました（追加 ${added}件・更新 ${updated}件）`)
    } catch (e) {
      setMsg(`読み込めませんでした: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return (
    <section className="page">
      <h2 className="page-title">設定</h2>

      <div className="card stack">
        <h3>バックアップ・引っ越し</h3>
        <p className="hint">
          レシピはこの端末のブラウザの中だけに保存されています。ブラウザのデータを消すと消えるので、ときどき書き出しておくと安心です。
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
