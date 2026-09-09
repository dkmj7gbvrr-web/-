import { describe, expect, it } from 'vitest'
import { mulberry32 } from './rng'
import { compareTellTier, rollTellTier } from './gachaTell'
import type { Rarity } from './types'

const RARITIES: readonly Rarity[] = [1, 2, 3, 4, 5, 6]

describe('rollTellTier', () => {
  it('rngが0を返すとき各レアリティの最初の候補になる', () => {
    expect(rollTellTier(() => 0, 1)).toBe('low')
    expect(rollTellTier(() => 0, 5)).toBe('mid')
    expect(rollTellTier(() => 0, 6)).toBe('high')
  })

  it('rngが1未満の最大値に近いとき各レアリティの最後の候補になる', () => {
    expect(rollTellTier(() => 0.9999999, 1)).toBe('high')
    expect(rollTellTier(() => 0.9999999, 6)).toBe('legend')
  })

  it('低レアリティでも、まれに高い期待度演出（ガセ）が出うる', () => {
    const rng = mulberry32(1)
    const seen = new Set<string>()
    for (let i = 0; i < 2000; i++) seen.add(rollTellTier(rng, 1))
    expect(seen.has('high')).toBe(true)
  })

  it('高レアリティでも、まれに控えめな演出（隠れ大当たり）になりうる', () => {
    const rng = mulberry32(2)
    const seen = new Set<string>()
    for (let i = 0; i < 2000; i++) seen.add(rollTellTier(rng, 6))
    expect(seen.has('high')).toBe(true)
  })

  it('どのレアリティでも必ず何らかのTellTierを返す', () => {
    const rng = mulberry32(3)
    for (const rarity of RARITIES) {
      for (let i = 0; i < 200; i++) {
        const tier = rollTellTier(rng, rarity)
        expect(['low', 'mid', 'high', 'legend']).toContain(tier)
      }
    }
  })

  it('大量に引くと、レアリティが高いほど高い期待度演出が出やすい（分布の健全性チェック）', () => {
    const rng = mulberry32(4)
    let lowHighCount = 0
    let highHighCount = 0
    for (let i = 0; i < 3000; i++) {
      if (compareTellTier(rollTellTier(rng, 1), 'high') >= 0) lowHighCount++
      if (compareTellTier(rollTellTier(rng, 6), 'high') >= 0) highHighCount++
    }
    expect(highHighCount).toBeGreaterThan(lowHighCount)
  })
})
