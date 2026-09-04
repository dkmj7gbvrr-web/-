import { describe, expect, it } from 'vitest'
import { buildFlickerPlan } from './gachaFlicker'
import { mulberry32 } from './rng'
import type { Rarity } from './types'

describe('buildFlickerPlan', () => {
  it('最終ステップは必ずロックインで、finalRarityと一致する', () => {
    const rarities: Rarity[] = [1, 2, 3, 4, 5, 6]
    for (const rarity of rarities) {
      const plan = buildFlickerPlan(rarity, mulberry32(1))
      const last = plan[plan.length - 1]
      expect(last.isLock).toBe(true)
      expect(last.rarity).toBe(rarity)
    }
  })

  it('最終ステップ以外はロックインではない', () => {
    const plan = buildFlickerPlan(6, mulberry32(2))
    for (const step of plan.slice(0, -1)) {
      expect(step.isLock).toBe(false)
    }
  })

  it('レアリティが高いほどステップ数が多い（じっくり見せる）', () => {
    const low = buildFlickerPlan(1, mulberry32(3))
    const high = buildFlickerPlan(6, mulberry32(3))
    expect(high.length).toBeGreaterThan(low.length)
  })

  it('すべてのステップのholdMsは正の値', () => {
    const plan = buildFlickerPlan(5, mulberry32(4))
    for (const step of plan) {
      expect(step.holdMs).toBeGreaterThan(0)
    }
  })

  it('すべてのステップのrarityは1〜6の範囲', () => {
    const plan = buildFlickerPlan(4, mulberry32(5))
    for (const step of plan) {
      expect(step.rarity).toBeGreaterThanOrEqual(1)
      expect(step.rarity).toBeLessThanOrEqual(6)
    }
  })
})
