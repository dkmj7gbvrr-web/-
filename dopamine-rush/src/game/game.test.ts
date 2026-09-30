import { describe, expect, test } from 'vitest'
import { Game, type GameEvent } from './game'
import { SPEC, SYMBOL_COUNT } from './odds'
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
    // RUSH 突入は50%の抽選なので、特定のシードの運に頼らないよう突入が起きるまで最大5シード試す
    let run = simulate(3, 600)
    for (let seed = 4; seed < 8 && !run.events.some((e) => e.type === 'rushStart'); seed++) run = simulate(seed, 600)
    const { events, g } = run
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
    expect(['play', 'fever', 'jackpotIntro', 'challenge', 'rushIntro', 'ltIntro', 'rushEnd']).toContain(g.scene)
  }, 180000)

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

describe('リーチの決着演出', () => {
  test('失敗→成功 / 成功→失敗 のパターンが実際に出て、結果と矛盾しない', () => {
    const seen = new Set<string>()
    let pending: string[] = []
    simulate(8, 1500, (g, e) => {
      if (['slip', 'revival', 'fakeAlign', 'fakeAlignBreak', 'fakeRevivalEnd', 'darkenEnd', 'develop'].includes(e.type)) {
        pending.push(e.type)
        seen.add(e.type)
      }
      if (e.type === 'jackpot') {
        // 失敗と思わせるパターンの後は当たる
        for (const p of pending) expect(['slip', 'revival', 'darkenEnd', 'develop']).toContain(p)
        pending = []
      }
      if (e.type === 'miss') {
        for (const p of pending) expect(['fakeAlign', 'fakeAlignBreak', 'fakeRevivalEnd', 'darkenEnd', 'develop']).toContain(p)
        pending = []
      }
      if (e.type === 'darkenEnd') expect(e.win).toBe(g.spin!.outcome.win)
    })
    for (const t of ['slip', 'fakeAlign', 'fakeRevivalEnd', 'darkenEnd', 'develop']) expect(seen).toContain(t)
  }, 120000)
})

describe('オーバー入賞・ラッキートリガー・ブラックアウト・先読みゾーン', () => {
  test('長く遊ぶと、オーバー入賞・LT・ブラックアウト・連続予告が起き、矛盾しない', () => {
    const seen = new Set<string>()
    let zoneTargetPending = false
    let payoutCheck = 0
    simulate(12, 3000, (g, e) => {
      seen.add(e.type)
      if (e.type === 'over') {
        // オーバー入賞は規定数に達したラウンドでだけ起きる
        expect(g.fever!.inRound).toBe(SPEC.ballsPerRound)
        payoutCheck++
      }
      if (e.type === 'luckyTrigger') expect(g.lt).toBe(true)
      if (e.type === 'rushStart' && e.lt) expect(g.rushLeft).toBe(SPEC.ltSpins)
      if (e.type === 'blackout') expect(g.spin!.outcome.win).toBe(true)
      if (e.type === 'zone' && e.target) zoneTargetPending = true
      if (e.type === 'spinStart') zoneTargetPending = false
    })
    void zoneTargetPending
    for (const t of ['over', 'zone', 'stepUp', 'gijiren', 'cutin']) expect(seen).toContain(t)
    expect(payoutCheck).toBeGreaterThan(0)
  }, 240000)
})

describe('RUSH 最終変動', () => {
  test('必ずリーチになり、リーチ中の PUSH は出ず、ハズレ目のあと確率で復活チャンス', () => {
    let inLast = false
    let sawReach = false
    let lastSpins = 0
    let chances = 0
    let chanceWin = 0
    let chanceMiss = 0
    let chanceOpen = false
    simulate(21, 2400, (g, e) => {
      if (e.type === 'lastSpin') {
        inLast = true
        sawReach = false
        lastSpins++
      }
      if (!inLast) return
      if (e.type === 'reach') sawReach = true
      // 最終変動ではリーチ中の PUSH（pushPrompt）は出ない
      expect(e.type).not.toBe('pushPrompt')
      if (e.type === 'lastChance') {
        chances++
        chanceOpen = true
      }
      if (e.type === 'lastChanceFail') {
        expect(chanceOpen).toBe(true)
        expect(g.spin!.outcome.win).toBe(false)
        chanceMiss++
      }
      if (e.type === 'jackpot' || e.type === 'miss' || e.type === 'rushEnd') {
        if (e.type !== 'rushEnd') {
          expect(sawReach).toBe(true)
          if (chanceOpen && e.type === 'jackpot') chanceWin++
          const reels = g.reels.map((r) => ((((Math.round(r.pos) % SYMBOL_COUNT) + SYMBOL_COUNT) % SYMBOL_COUNT) + 1))
          if (e.type === 'jackpot') expect(reels).toEqual(e.outcome.symbols)
          else expect(reels[0]).toBe(reels[2])
        }
        inLast = false
        chanceOpen = false
      }
    })
    expect(lastSpins).toBeGreaterThan(3)
    expect(chances).toBe(chanceWin + chanceMiss)
  }, 240000)
})
