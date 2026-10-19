/**
 * ホットクック野良レシピ帳 用の中継サーバー（Cloudflare Workers）。
 * ブラウザから直接読めないレシピページを取ってきて、CORS ヘッダーを付けて返す。
 *
 * 使い方: Cloudflare のダッシュボードで Worker を新規作成 → このファイルの中身を貼り付けてデプロイ
 *        → 表示された https://xxxx.workers.dev/ をアプリの「設定 › 中継サーバーのURL」に入れる。
 *
 * 誰でも使える「開いた中継サーバー」にならないよう、ALLOWED_ORIGINS のページからの要求だけに応える。
 * 自分でアプリを別の場所に置いた場合は、そのオリジンを足すこと。
 */
const ALLOWED_ORIGINS = ['https://dkmj7gbvrr-web.github.io', 'http://localhost:5173', 'http://localhost:4173']
const MAX_BYTES = 5 * 1024 * 1024

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') ?? ''
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      Vary: 'Origin',
    }
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors })
    if (!ALLOWED_ORIGINS.includes(origin)) return new Response('forbidden origin', { status: 403, headers: cors })
    if (request.method !== 'GET') return new Response('method not allowed', { status: 405, headers: cors })

    const target = new URL(request.url).searchParams.get('url')
    let url
    try {
      url = new URL(target ?? '')
    } catch {
      return new Response('bad url', { status: 400, headers: cors })
    }
    if (!['http:', 'https:'].includes(url.protocol)) return new Response('bad url', { status: 400, headers: cors })

    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HotcookRecipeNote/1.0)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.5',
      },
      redirect: 'follow',
    })
    const type = res.headers.get('Content-Type') ?? 'text/html'
    if (!/html|xml|text/i.test(type)) return new Response('not html', { status: 415, headers: cors })
    const body = await res.arrayBuffer()
    if (body.byteLength > MAX_BYTES) return new Response('too large', { status: 413, headers: cors })
    return new Response(body, { status: res.status, headers: { ...cors, 'Content-Type': type } })
  },
}
