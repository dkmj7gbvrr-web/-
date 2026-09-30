import { OWNER_PASSPHRASE_SHA256 } from './config'

const KEY = 'dopamine-rush:owner'

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * このブラウザがオーナーとして登録されているかを判定する。
 * URL の ?owner= を読んだら、合言葉がアドレスバーや履歴に残らないよう URL から消す。
 *
 * 注意：ブラウザだけで完結する仕組みなので、本格的な認証ではない。
 * 合言葉を知っている人は誰でもオーナー扱いになる。
 */
export async function resolveOwner(): Promise<boolean> {
  const url = new URL(window.location.href)
  const param = url.searchParams.get('owner')
  if (param !== null) {
    url.searchParams.delete('owner')
    window.history.replaceState(null, '', url.toString())
    try {
      if (param === 'off') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, param)
    } catch {
      // 保存できない環境では、このページを開いている間だけ有効
      if (param !== 'off') return (await sha256Hex(param)) === OWNER_PASSPHRASE_SHA256
    }
  }
  let stored: string | null = null
  try {
    stored = localStorage.getItem(KEY)
  } catch {
    return false
  }
  if (!stored || !crypto?.subtle) return false
  return (await sha256Hex(stored)) === OWNER_PASSPHRASE_SHA256
}
