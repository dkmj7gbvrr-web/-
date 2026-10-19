/**
 * レシピページの HTML を取ってくる。
 * ブラウザは他サイトのページを直接読めない（CORS）ので、中継サーバー（プロキシ）を経由する。
 * 設定で自分のプロキシ（worker/cors-proxy.js を Cloudflare Workers に置いたもの）を
 * 指定していればそれを最優先し、無ければ公開の無料プロキシを順に試す。
 * 無料プロキシは提供元の都合で止まったり、取得先サイトに拒否されたりすることがある。
 */

const PUBLIC_PROXIES: { name: string; build: (url: string) => string }[] = [
  { name: 'allorigins', build: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` },
  { name: 'codetabs', build: (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}` },
  { name: 'corsproxy.io', build: (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}` },
]

const TIMEOUT_MS = 15000

/** 設定値「https://xxx.workers.dev/?url={url}」または「https://xxx.workers.dev/」から URL を組み立てる */
export function buildCustomProxyUrl(template: string, target: string): string {
  const t = template.trim()
  if (t.includes('{url}')) return t.replace('{url}', encodeURIComponent(target))
  const sep = t.includes('?') ? '&' : '?'
  return `${t}${sep}url=${encodeURIComponent(target)}`
}

/** HTML の meta から文字コードを読む（Shift_JIS / EUC-JP の古いブログ向け） */
function sniffCharset(head: string): string | undefined {
  const m = head.match(/<meta[^>]+charset\s*=\s*["']?\s*([\w-]+)/i)
  return m?.[1]?.toLowerCase()
}

async function decode(res: Response): Promise<string> {
  const buf = await res.arrayBuffer()
  const headerCharset = res.headers.get('content-type')?.match(/charset=([\w-]+)/i)?.[1]?.toLowerCase()
  const asUtf8 = new TextDecoder('utf-8').decode(buf)
  const charset = headerCharset && headerCharset !== 'utf-8' ? headerCharset : sniffCharset(asUtf8.slice(0, 4000))
  if (charset && !['utf-8', 'utf8'].includes(charset)) {
    try {
      return new TextDecoder(charset).decode(buf)
    } catch {
      // 知らない文字コード名なら UTF-8 のまま
    }
  }
  return asUtf8
}

async function tryFetch(url: string, signal: AbortSignal): Promise<string> {
  const ctl = new AbortController()
  const onAbort = () => ctl.abort()
  signal.addEventListener('abort', onAbort)
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctl.signal, credentials: 'omit', redirect: 'follow' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await decode(res)
    if (html.length < 300 || !/<html|<body|<head|<meta/i.test(html)) throw new Error('HTMLではない応答')
    return html
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', onAbort)
  }
}

export interface FetchAttempt {
  via: string
  error?: string
}

export async function fetchPageHtml(
  target: string,
  customProxy: string,
  signal: AbortSignal,
  onProgress?: (via: string) => void,
): Promise<{ html: string; via: string; attempts: FetchAttempt[] }> {
  const routes: { name: string; url: string }[] = []
  if (customProxy.trim()) routes.push({ name: '自分のプロキシ', url: buildCustomProxyUrl(customProxy, target) })
  for (const p of PUBLIC_PROXIES) routes.push({ name: p.name, url: p.build(target) })

  const attempts: FetchAttempt[] = []
  for (const r of routes) {
    if (signal.aborted) break
    onProgress?.(r.name)
    try {
      const html = await tryFetch(r.url, signal)
      attempts.push({ via: r.name })
      return { html, via: r.name, attempts }
    } catch (e) {
      attempts.push({ via: r.name, error: e instanceof Error ? e.message : String(e) })
    }
  }
  const err = new Error('ページを取得できませんでした') as Error & { attempts: FetchAttempt[] }
  err.attempts = attempts
  throw err
}
