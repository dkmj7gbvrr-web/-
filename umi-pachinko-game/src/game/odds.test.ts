import { describe, expect, it } from 'vitest'
import {
  drawReachTier,
  drawRoundCount,
  drawTellTier,
  isJackpot,
  isKakuhenSymbol,
  rollStartOutcome,
  ROUND_TABLE,
} from './odds'
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
    const validRounds = new Set(ROUND_TABLE.map((r) => r.value))
    for (const v of [0, 0.1, 0.3, 0.5, 0.7, 0.85, 0.95, 0.999]) {
      expect(validRounds.has(drawRoundCount(queueRng([v])))).toBe(true)
    }
  })
})

describe('drawReachTier', () => {
  it('大当たり時はプレミアリーチも出る (rng=0)', () => {
    expect(drawReachTier(true, queueRng([0]))).toBe('premium')
  })

  it('ハズレ時はプレミアリーチが出ない (rng=0 でも super どまり)', () => {
    expect(drawReachTier(false, queueRng([0]))).toBe('super')
    expect(drawReachTier(false, queueRng([0.999]))).toBe('normal')
  })
})

describe('drawTellTier', () => {
  it('大当たり時は rng=0 でレインボー保留になる', () => {
    expect(drawTellTier(true, queueRng([0]))).toBe('rainbow')
  })

  it('ハズレでも稀にレインボー保留(ガセ先読み)が出ることがある', () => {
    expect(drawTellTier(false, queueRng([0]))).toBe('white')
    expect(drawTellTier(false, queueRng([0.999]))).toBe('rainbow')
  })
})

describe('rollStartOutcome', () => {
  it('当選時: 3つ揃った図柄・確定したラウンド数とネクストモードを返す', () => {
    // isJackpot->当選(0) / symbol=7(奇数=確変, 0.75*10=7) / rounds=16R(0) / reach=premium(0) / tell=rainbow(0)
    const outcome = rollStartOutcome('normal', queueRng([0, 0.75, 0, 0, 0]))
    expect(outcome.isJackpot).toBe(true)
    expect(outcome.result).toEqual([7, 7, 7])
    expect(outcome.nextMode).toBe('kakuhen')
    expect(outcome.totalRounds).toBe(16)
    expect(outcome.reachTier).toBe('premium')
    expect(outcome.tell).toBe('rainbow')
  })

  it('ハズレ・リーチなし: 3つとも異なる図柄で reachTier は none', () => {
    // isJackpot->ハズレ(0.99) / hasReach->false(0.99) / a,b,c / tell
    const outcome = rollStartOutcome('normal', queueRng([0.99, 0.99, 0.1, 0.5, 0.9, 0]))
    expect(outcome.isJackpot).toBe(false)
    expect(outcome.reachTier).toBe('none')
    expect(outcome.result[0]).not.toBe(outcome.result[1])
  })

  it('ハズレ・リーチあり: 前後2つが揃い、最後だけ外れる', () => {
    // isJackpot->ハズレ(0.99) / hasReach->true(0) / a,c / reachTier / tell
    const outcome = rollStartOutcome('normal', queueRng([0.99, 0, 0.3, 0.3, 0, 0]))
    expect(outcome.isJackpot).toBe(false)
    expect(outcome.result[0]).toBe(outcome.result[1])
    expect(outcome.result[2]).not.toBe(outcome.result[0])
    expect(outcome.reachTier).not.toBe('none')
  })
})
