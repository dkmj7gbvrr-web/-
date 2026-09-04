import { describe, expect, it } from 'vitest'
import { MONSTERS } from './monsters'
import type { MonsterDef } from './types'

describe('MONSTERS', () => {
  it('全モンスターがリーダースキル名とアクティブスキルを持つ', () => {
    for (const m of MONSTERS) {
      expect(m.leaderSkill.name.length).toBeGreaterThan(0)
      expect(m.activeSkill.name.length).toBeGreaterThan(0)
      expect(m.activeSkill.maxCooldown).toBeGreaterThan(0)
    }
  })

  it('同じ属性内では、レアリティが高いほどスキルのクールタイムが短いか同じ', () => {
    const byElement = new Map<string, MonsterDef[]>()
    for (const m of MONSTERS) {
      const list = byElement.get(m.element) ?? []
      list.push(m)
      byElement.set(m.element, list)
    }
    for (const list of byElement.values()) {
      const sorted = [...list].sort((a, b) => a.rarity - b.rarity)
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].activeSkill.maxCooldown).toBeLessThanOrEqual(sorted[i - 1].activeSkill.maxCooldown)
      }
    }
  })

  it('ダメージ・回復スキルの数値はレアリティが高いほど大きい', () => {
    const byElement = new Map<string, MonsterDef[]>()
    for (const m of MONSTERS) {
      const list = byElement.get(m.element) ?? []
      list.push(m)
      byElement.set(m.element, list)
    }
    for (const list of byElement.values()) {
      const sorted = [...list].sort((a, b) => a.rarity - b.rarity)
      for (let i = 1; i < sorted.length; i++) {
        const prevEffect = sorted[i - 1].activeSkill.effect
        const nextEffect = sorted[i].activeSkill.effect
        if (prevEffect.kind === 'damage' && nextEffect.kind === 'damage') {
          expect(nextEffect.amount).toBeGreaterThan(prevEffect.amount)
        }
        if (prevEffect.kind === 'heal' && nextEffect.kind === 'heal') {
          expect(nextEffect.amount).toBeGreaterThan(prevEffect.amount)
        }
        if (prevEffect.kind === 'boost' && nextEffect.kind === 'boost') {
          expect(nextEffect.multiplier).toBeGreaterThan(prevEffect.multiplier)
        }
      }
    }
  })
})
