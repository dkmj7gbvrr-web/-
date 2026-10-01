/**
 * 新しい版が公開されていたら自動で読み込み直す。
 * GitHub Pages はページ（HTML）を約10分キャッシュし、スマホのブラウザはタブに戻ったとき
 * 保存済みの古いページを出すことがあるため、version.json をキャッシュを使わずに取りに行って比べる。
 */
declare const __BUILD_ID__: string

export async function fetchLatestBuild(): Promise<string | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const json = (await res.json()) as { build?: string }
    return json.build ?? null
  } catch {
    return null
  }
}

const TRIED_KEY = 'dopamine-rush:reloaded-for'
let latestSeen: string | null = null

/** 今動いている版と、公開中の最新版が違うか（開発サーバーでは常に false） */
export async function isOutdated(): Promise<boolean> {
  if (import.meta.env.DEV) return false
  const latest = await fetchLatestBuild()
  if (latest === null || latest === __BUILD_ID__) return false
  // 同じ最新版のために一度読み込み直しても古いままなら、もう繰り返さない（無限リロード防止）
  try {
    if (sessionStorage.getItem(TRIED_KEY) === latest) return false
  } catch {
    // sessionStorage が使えなくても判定は続ける
  }
  latestSeen = latest
  return true
}

/** 古い版なら、キャッシュに引っかからない URL で読み込み直す */
export function reloadToLatest() {
  try {
    if (latestSeen) sessionStorage.setItem(TRIED_KEY, latestSeen)
  } catch {
    // 保存できなくても読み込み直しはする
  }
  const url = new URL(window.location.href)
  url.searchParams.set('v', Date.now().toString(36))
  window.location.replace(url.toString())
}
