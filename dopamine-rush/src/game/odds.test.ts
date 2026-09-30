import { describe, expect, test } from 'vitest'
import {
  decideSpin,
  HOLD_COLORS,
  reliability,
  REACH_ON_MISS,
  REACH_ON_WIN,
  rushContinueRate,
  SPEC,
  TELL_ON_MISS,
  TELL_ON_WIN,
} from './odds'
import { mulberry32 } from './rng'

const idx = (c: (typeof HOLD_COLORS)[number]) => HOLD_COLORS.indexOf(c)

describe('decideSpin', () => {
  test('表示図柄は当否・リーチと常に矛盾しない', () => {
    const rng = mulberry32(42)
    for (let i = 0; i < 20000; i++) {
      const o = decideSpin(i % 3 === 0 ? 'rush' : 'normal', rng)
      const [l, c, r] = o.symbols
      if (o.win) {
        expect(l === c && c === r).toBe(true)
      } else if (o.reach !== 'none') {
        expect(l).toBe(r)
        expect(c).not.toBe(l)
      } else {
        expect(l).not.toBe(r)
      }
      for (const s of o.symbols) expect(s >= 1 && s <= 7).toBe(true)
      expect(idx(o.entryColor)).toBeLessThanOrEqual(idx(o.tell))
      expect(o.shownRounds).toBeLessThanOrEqual(o.rounds)
      if (o.revival) expect(o.win && (o.reach === 'super' || o.reach === 'premium')).toBe(true)
    }
  })

  test('大当たり確率が仕様どおり（大数の法則で近似）', () => {
    const rng = mulberry32(7)
    const n = 200000
    let wins = 0
    for (let i = 0; i < n; i++) if (decideSpin('normal', rng).win) wins++
    expect(wins / n).toBeCloseTo(SPEC.normalWinRate, 2)
  })

  test('虹保留はハズレでは絶対に出ない（確定演出）', () => {
    const rng = mulberry32(99)
    for (let i = 0; i < 100000; i++) {
      const o = decideSpin('normal', rng)
      if (o.tell === 'rainbow') expect(o.win).toBe(true)
    }
  })

  test('ハズレ時のリーチ（ニアミス）は約2〜3割', () => {
    const rng = mulberry32(5)
    let miss = 0
    let reach = 0
    for (let i = 0; i < 100000; i++) {
      const o = decideSpin('normal', rng)
      if (o.win) continue
      miss++
      if (o.reach !== 'none') reach++
    }
    expect(reach / miss).toBeGreaterThan(0.2)
    expect(reach / miss).toBeLessThan(0.3)
  })
})

describe('期待度（信頼度）', () => {
  test('保留色は白→青→緑→赤→金→虹の順に単調に期待度が上がる', () => {
    const rel = HOLD_COLORS.map((c) => reliability(c, TELL_ON_WIN, TELL_ON_MISS, SPEC.normalWinRate))
    for (let i = 1; i < rel.length; i++) expect(rel[i]).toBeGreaterThan(rel[i - 1])
    expect(rel[rel.length - 1]).toBe(1)
  })

  test('リーチの格が上がるほど期待度が上がる', () => {
    const rel = (['none', 'normal', 'super', 'premium'] as const).map((r) =>
      reliability(r, REACH_ON_WIN, REACH_ON_MISS, SPEC.normalWinRate),
    )
    for (let i = 1; i < rel.length; i++) expect(rel[i]).toBeGreaterThan(rel[i - 1])
    // スーパーは「当たるかどうか分からない」帯に置く
    expect(rel[2]).toBeGreaterThan(0.15)
    expect(rel[2]).toBeLessThan(0.5)
  })

  test('RUSH 継続率は約79%', () => {
    expect(rushContinueRate()).toBeCloseTo(0.79, 2)
  })
})
