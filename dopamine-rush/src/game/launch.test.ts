import { describe, expect, test } from 'vitest'
import { Game } from './game'
import { ENTRY_JITTER, ENTRY_MAX, ENTRY_MIN, entryForStrength, FOUL_BELOW, launch, railPosition, RAIL_Y } from './launch'
import { mulberry32 } from './rng'

describe('発射（強さ）', () => {
  test('強いほど右に入る', () => {
    let prev = -Infinity
    for (let s = FOUL_BELOW; s <= 1; s += 0.05) {
      const x = entryForStrength(s)
      expect(x).toBeGreaterThanOrEqual(prev)
      prev = x
    }
    expect(entryForStrength(1)).toBe(ENTRY_MAX)
    expect(entryForStrength(FOUL_BELOW)).toBe(ENTRY_MIN)
  })

  test('ぶれは決まった幅に収まり、レールの終点は入射位置', () => {
    const rng = mulberry32(3)
    for (let i = 0; i < 500; i++) {
      const s = FOUL_BELOW + rng() * (1 - FOUL_BELOW)
      const rb = launch(i, s, rng)
      expect(rb.foul).toBe(false)
      expect(Math.abs(rb.entryX - entryForStrength(s))).toBeLessThanOrEqual(ENTRY_JITTER + 1e-9)
      rb.t = rb.dur
      const p = railPosition(rb)
      expect(p.x).toBeCloseTo(rb.entryX, 6)
      expect(p.y).toBeCloseTo(RAIL_Y, 6)
    }
  })

  test('弱すぎる玉は盤面に届かず、持ち玉に戻る', () => {
    const events: string[] = []
    const g = new Game(mulberry32(1), (e) => events.push(e.type))
    g.strength = 0
    const before = g.balls
    g.firing = true
    g.update(1 / 60)
    expect(g.balls).toBe(before - 1)
    g.firing = false
    for (let i = 0; i < 60; i++) g.update(1 / 60)
    expect(events).toContain('foul')
    expect(g.balls).toBe(before)
    expect(g.flying.length).toBe(0)
    expect(g.rail.length).toBe(0)
  })

  test('発射した玉はレールを抜けてから盤面に入る', () => {
    const g = new Game(mulberry32(2), () => {})
    g.strength = 0.5
    g.firing = true
    g.update(1 / 60)
    g.firing = false
    expect(g.rail.length).toBe(1)
    expect(g.flying.length).toBe(0)
    for (let i = 0; i < 40 && g.rail.length > 0; i++) g.update(1 / 60)
    expect(g.rail.length).toBe(0)
    expect(g.flying.length).toBe(1)
  })
})
