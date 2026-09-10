import { describe, expect, it } from 'vitest'
import { drawRoundCount, isJackpot, isKakuhenSymbol, ROUND_TABLE } from './odds'
import { queueRng } from './testUtils'

describe('isJackpot', () => {
  it('rng が確率未満なら当選、以上ならハズレになる', () => {
    expect(isJackpot('normal', queueRng([0]))).toBe(true)
    expect(isJackpot('normal', queueRng([0.999999]))).toBe(false)
  })

  it('確変中は通常より当たりやすい', () => {
    const value = 0.02 // normal(1/99≈0.0101) 未満ではないが kakuhen(1/40=0.025) 未満
    expect(isJackpot('normal', queueRng([value]))).toBe(false)
    expect(isJackpot('kakuhen', queueRng([value]))).toBe(true)
  })
})

describe('isKakuhenSymbol', () => {
  it('奇数図柄は確変、偶数図柄は通常', () => {
    expect(isKakuhenSymbol(7)).toBe(true)
    expect(isKakuhenSymbol(4)).toBe(false)
    expect(isKakuhenSymbol(0)).toBe(false)
    expect(isKakuhenSymbol(9)).toBe(true)
  })
})

describe('drawRoundCount', () => {
  it('累積ウェイトの先頭 (16R) が rng=0 で選ばれる', () => {
    expect(drawRoundCount(queueRng([0]))).toBe(16)
  })

  it('rng がほぼ1に近いと最後のテーブル項目 (3R) が選ばれる', () => {
    expect(drawRoundCount(queueRng([0.9999]))).toBe(3)
  })

  it('返り値は必ずテーブルに定義されたラウンド数のいずれか', () => {
    const validRounds = new Set(ROUND_TABLE.map((r) => r.rounds))
    for (const v of [0, 0.1, 0.3, 0.5, 0.7, 0.85, 0.95, 0.999]) {
      expect(validRounds.has(drawRoundCount(queueRng([v])))).toBe(true)
    }
  })
})
