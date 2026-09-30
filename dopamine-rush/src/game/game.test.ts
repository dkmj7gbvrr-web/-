import { describe, expect, test } from 'vitest'
import { Game, type GameEvent } from './game'
import { SYMBOL_COUNT } from './odds'
import { mulberry32 } from './rng'

/** 押しっぱなしで遊び続けるプレイヤーを seconds 秒シミュレートする */
function simulate(seed: number, seconds: number, onEvent?: (g: Game, e: GameEvent) => void) {
  const events: GameEvent[] = []
  const g: Game = new Game(mulberry32(seed), (e) => {
    events.push(e)
    onEvent?.(g, e)
  })
  const dt = 1 / 60
  for (let i = 0; i < seconds * 60; i++) {
    g.aimX = 225 + Math.sin(i * dt * 0.7) * 150
    if (g.pushPending) g.push()
    if (g.needsRefill) g.refill()
    if (g.scene === 'play') g.firing = true
    g.update(dt)
    expect(g.balls).toBeGreaterThanOrEqual(0)
  }
  return { g, events }
}

const shownSymbol = (pos: number) => ((((Math.round(pos) % SYMBOL_COUNT) + SYMBOL_COUNT) % SYMBOL_COUNT) + 1)

describe('Game', () => {
  test('変動終了時に止まっている図柄は抽選結果と一致する', () => {
    let checked = 0
    simulate(11, 240, (g, e) => {
      if (e.type === 'jackpot' || e.type === 'miss') {
        const o = e.type === 'jackpot' ? e.outcome : null
        const reels = g.reels.map((r) => shownSymbol(r.pos))
        if (o) expect(reels).toEqual(o.symbols)
        else expect(reels[0]).toBe(reels[2])
        checked++
      }
    })
    expect(checked).toBeGreaterThan(5)
  }, 30000)

  test('大当たり → ラウンド消化 → 突入チャレンジ → RUSH/通常 の一連が回る', () => {
    const { events, g } = simulate(3, 600)
    const types = events.map((e) => e.type)
    expect(types).toContain('jackpot')
    expect(types).toContain('roundStart')
    expect(types).toContain('attackerIn')
    expect(types).toContain('feverEnd')
    expect(types).toContain('challengeResult')
    expect(types).toContain('rushStart')
    // ラウンド数は最終ラウンド数（昇格込み）と一致して終わる
    let rounds = 0
    let expected = 0
    for (const e of events) {
      if (e.type === 'jackpot') {
        rounds = 0
        expected = e.outcome.rounds
      }
      if (e.type === 'roundStart') rounds++
      if (e.type === 'feverEnd') expect(rounds).toBe(expected)
    }
    expect(['play', 'fever', 'jackpotIntro', 'challenge', 'rushIntro', 'rushEnd']).toContain(g.scene)
  }, 60000)

  test('保留は最大4個まで', () => {
    simulate(5, 120, (g) => {
      expect(g.holds.length).toBeLessThanOrEqual(4)
    })
  }, 30000)

  test('玉が尽きたら無料補給できる', () => {
    const g = new Game(mulberry32(1), () => {})
    g.balls = 0
    expect(g.needsRefill).toBe(true)
    g.refill()
    expect(g.balls).toBeGreaterThan(0)
  })
})
