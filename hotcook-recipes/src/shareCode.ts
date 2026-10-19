/** 共有コードまわり（Firebase に依存しない部分。テストしやすいよう sync.ts から分けている） */

// 読み間違えやすい文字（0/o, 1/l/i）を除いた小文字と数字
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
export const CODE_LENGTH = 12

export function generateShareCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

/** 入力された共有コード（または招待リンク）からコードを取り出す。使えない形なら null */
export function parseShareCode(input: string): string | null {
  const s = input.trim()
  const fromLink = s.match(/[?&]join=([^&#\s]+)/)?.[1]
  const code = (fromLink ? decodeURIComponent(fromLink) : s).toLowerCase().replace(/[\s-]/g, '')
  // docs/firestore.rules の条件（10〜64文字）に合わせる
  return /^[a-z0-9]{10,64}$/.test(code) ? code : null
}

export function inviteLink(code: string): string {
  const url = new URL(window.location.href)
  url.search = `?join=${encodeURIComponent(code)}`
  url.hash = ''
  return url.toString()
}
