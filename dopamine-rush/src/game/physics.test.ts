import { describe, expect, test } from 'vitest'
import { BALL_R, createPegs, PEG_R, reachedBottom, spawnBall, stepBall, WALL_L, WALL_R } from './physics'
import { classifyPocket, startPocket } from './pockets'
import { mulberry32 } from './rng'

describe('physics', () => {
  test('玉は壁の外に出ず、最終的に盤面の底へ到達する', () => {
    const rng = mulberry32(1)
    const pegs = createPegs()
    for (let n = 0; n < 200; n++) {
      const b = spawnBall(n, 20 + rng() * 410, rng)
      let steps = 0
      while (!reachedBottom(b) && steps < 60 * 4 * 20) {
        stepBall(b, pegs, 1 / 240, rng)
        expect(b.x).toBeGreaterThanOrEqual(WALL_L + BALL_R - 1e-6)
        expect(b.x).toBeLessThanOrEqual(WALL_R - BALL_R + 1e-6)
        steps++
      }
      expect(reachedBottom(b)).toBe(true)
    }
  })

  test('釘に当たると押し出され、ヒットが報告される', () => {
    const rng = mulberry32(2)
    const pegs = createPegs()
    const p = pegs[5]
    const b = spawnBall(1, p.x, rng)
    b.x = p.x + 1
    b.y = p.y - (BALL_R + PEG_R) + 1
    b.vx = 0
    b.vy = 200
    const hits = stepBall(b, pegs, 1 / 240, rng)
    expect(hits).toContain(5)
    expect(Math.hypot(b.x - p.x, b.y - p.y)).toBeGreaterThanOrEqual(BALL_R + PEG_R - 1e-6)
    expect(b.vy).toBeLessThan(200)
  })
})

describe('pockets', () => {
  test('始動口は中央に固定され、中心に落ちれば start', () => {
    const sp = startPocket('normal')
    expect(sp.x).toBe(225)
    expect(classifyPocket(sp.x, 'normal').kind).toBe('start')
    expect(startPocket('rush').x).toBe(225)
    expect(startPocket('rush').w).toBeGreaterThan(sp.w)
  })
  test('大当たり中は中央がアタッカー、端はアウト', () => {
    expect(classifyPocket(225, 'fever').kind).toBe('attacker')
    expect(classifyPocket(20, 'fever').kind).toBe('out')
  })
})
