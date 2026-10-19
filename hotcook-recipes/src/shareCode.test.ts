import { describe, expect, it } from 'vitest'
import { CODE_LENGTH, generateShareCode, parseShareCode } from './shareCode'

describe('shareCode', () => {
  it('生成したコードはルールの条件（英小文字と数字10〜64文字）を満たし、毎回違う', () => {
    const codes = new Set(Array.from({ length: 200 }, generateShareCode))
    expect(codes.size).toBe(200)
    for (const c of codes) {
      expect(c).toHaveLength(CODE_LENGTH)
      expect(c).toMatch(/^[a-z0-9]{10,64}$/)
      expect(parseShareCode(c)).toBe(c)
    }
  })

  it('招待リンク・大文字・空白入りの入力からコードを取り出す', () => {
    expect(parseShareCode('https://example.github.io/-/hotcook-recipes/?join=k7m2xq9pa4rt')).toBe('k7m2xq9pa4rt')
    expect(parseShareCode('  K7M2 XQ9P A4RT ')).toBe('k7m2xq9pa4rt')
  })

  it('短すぎる・使えない文字を含むコードは受け付けない', () => {
    expect(parseShareCode('abc123')).toBeNull()
    expect(parseShareCode('../households/x')).toBeNull()
    expect(parseShareCode('')).toBeNull()
  })
})
