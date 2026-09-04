import { describe, expect, it } from 'vitest'
import { mulberry32 } from './rng'
import { MULTI_PULL_COUNT, PITY_THRESHOLD, RARITY_RATES, multiPull, rollRarity, rollRarityAtLeast, singlePull } from './gacha'

describe('RARITY_RATES', () => {
  it('合計が100%になる', () => {
    const total = Object.values(RARITY_RATES).reduce((a, b) => a + b, 0)
    expect(total).toBe(100)
  })
})

describe('rollRarity', () => {
  it('rngが0を返すとき最初のレアリティ(1)になる', () => {
    expect(rollRarity(() => 0)).toBe(1)
  })

  it('rngが1未満の最大値に近いとき最高レアリティ(6)になる', () => {
    expect(rollRarity(() => 0.9999999)).toBe(6)
  })

  it('多数回引くと低レアリティの方が多く出る（分布の健全性チェック）', () => {
    const rng = mulberry32(12345)
    const counts: Record<number, number> = {}
    for (let i = 0; i < 5000; i++) {
      const r = rollRarity(rng)
      counts[r] = (counts[r] ?? 0) + 1
    }
    expect(counts[1]).toBeGreaterThan(counts[6] ?? 0)
    expect(counts[1]).toBeGreaterThan(0)
  })
})

describe('rollRarityAtLeast', () => {
  it('指定したレアリティ未満は絶対に出ない', () => {
    const rng = mulberry32(999)
    for (let i = 0; i < 500; i++) {
      expect(rollRarityAtLeast(rng, 4)).toBeGreaterThanOrEqual(4)
    }
  })

  it('最低ラインちょうどのレアリティも出うる', () => {
    const rng = mulberry32(1)
    const results = new Set<number>()
    for (let i = 0; i < 200; i++) results.add(rollRarityAtLeast(rng, 5))
    expect(results.has(5)).toBe(true)
  })
})

describe('multiPull', () => {
  it('10連では必ず1体以上4★以上を含む', () => {
    for (let seed = 0; seed < 50; seed++) {
      const rng = mulberry32(seed)
      const { pulls } = multiPull(rng, MULTI_PULL_COUNT)
      expect(pulls.length).toBe(10)
      expect(pulls.some((p) => p.monster.rarity >= 4)).toBe(true)
    }
  })

  it('天井カウントが閾値に達すると次の1回は5★以上が確定する', () => {
    const rng = mulberry32(42)
    const { pulls, nextPityCount } = multiPull(rng, 1, PITY_THRESHOLD - 1)
    expect(pulls[0].pityTriggered).toBe(true)
    expect(pulls[0].monster.rarity).toBeGreaterThanOrEqual(5)
    expect(nextPityCount).toBe(0)
  })

  it('5★以上を引くと天井カウントがリセットされる', () => {
    const rng = mulberry32(7)
    const { pulls, nextPityCount } = multiPull(rng, 1, PITY_THRESHOLD - 1)
    if (pulls[0].monster.rarity >= 5) {
      expect(nextPityCount).toBe(0)
    }
  })

  it('天井に達していなければカウントが積み上がる', () => {
    const rng = mulberry32(3)
    const { nextPityCount } = multiPull(rng, 1, 0)
    expect(nextPityCount).toBeGreaterThanOrEqual(0)
    expect(nextPityCount).toBeLessThan(PITY_THRESHOLD)
  })
})

describe('singlePull', () => {
  it('常にMONSTERSの中から1体を返す', () => {
    const rng = mulberry32(555)
    const monster = singlePull(rng)
    expect(monster).toBeDefined()
    expect(monster.rarity).toBeGreaterThanOrEqual(1)
  })
})
