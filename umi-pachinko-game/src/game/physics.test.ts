import { describe, expect, it } from 'vitest'
import {
  circlesOverlap,
  createLaunchedBall,
  GRAVITY,
  integrate,
  LANE_BOTTOM_Y,
  launchSpeedFromPower,
  MAX_LAUNCH_SPEED,
  MIN_LAUNCH_SPEED,
  resolvePinCollision,
  resolveWallCollision,
  stepLaunchLane,
} from './physics'
import type { Ball } from './types'
import { queueRng } from './testUtils'

function makeBall(overrides: Partial<Ball> = {}): Ball {
  return {
    id: 1,
    pos: { x: 100, y: 100 },
    vel: { x: 0, y: 0 },
    inLaunchLane: false,
    captured: false,
    ...overrides,
  }
}

describe('integrate', () => {
  it('重力によって下向きの速度が増える', () => {
    const ball = makeBall({ vel: { x: 0, y: 0 } })
    const next = integrate(ball, 0.1)
    expect(next.vel.y).toBeCloseTo(GRAVITY * 0.1)
    expect(next.pos.y).toBeGreaterThan(ball.pos.y)
  })

  it('速度に応じて位置が移動する', () => {
    const ball = makeBall({ vel: { x: 50, y: 0 } })
    const next = integrate(ball, 0.2)
    expect(next.pos.x).toBeCloseTo(100 + 50 * 0.2)
  })
})

describe('circlesOverlap', () => {
  it('距離が半径の和より小さければ重なっている', () => {
    expect(circlesOverlap({ x: 0, y: 0 }, 5, { x: 8, y: 0 }, 5)).toBe(true)
    expect(circlesOverlap({ x: 0, y: 0 }, 5, { x: 20, y: 0 }, 5)).toBe(false)
  })
})

describe('resolvePinCollision', () => {
  it('釘に当たっていなければ null を返す', () => {
    const ball = makeBall({ pos: { x: 0, y: 0 } })
    const pin = { pos: { x: 100, y: 100 }, radius: 4 }
    expect(resolvePinCollision(ball, pin, queueRng([0.5]))).toBeNull()
  })

  it('真上から落ちてきた玉は釘の上面ではね返り、下向き速度が反転する', () => {
    const pin = { pos: { x: 100, y: 100 }, radius: 4 }
    const ball = makeBall({ pos: { x: 100, y: 91 }, vel: { x: 0, y: 200 } })
    const result = resolvePinCollision(ball, pin, queueRng([0.5]))
    expect(result).not.toBeNull()
    expect(result!.vel.y).toBeLessThan(0)
  })

  it('めり込んだ位置は釘の外側まで押し戻される', () => {
    const pin = { pos: { x: 100, y: 100 }, radius: 4 }
    const ball = makeBall({ pos: { x: 100, y: 92 }, vel: { x: 0, y: 100 } })
    const result = resolvePinCollision(ball, pin, queueRng([0.5]))
    const dist = Math.hypot(result!.pos.x - pin.pos.x, result!.pos.y - pin.pos.y)
    expect(dist).toBeCloseTo(4 + 6, 5)
  })
})

describe('resolveWallCollision', () => {
  it('左壁を超えたら押し戻され、速度が反転する', () => {
    const ball = makeBall({ pos: { x: -5, y: 50 }, vel: { x: -100, y: 0 } })
    const result = resolveWallCollision(ball, 380)
    expect(result.pos.x).toBeGreaterThanOrEqual(6)
    expect(result.vel.x).toBeGreaterThan(0)
  })

  it('右壁を超えたら押し戻され、速度が反転する', () => {
    const ball = makeBall({ pos: { x: 400, y: 50 }, vel: { x: 100, y: 0 } })
    const result = resolveWallCollision(ball, 380)
    expect(result.pos.x).toBeLessThanOrEqual(374)
    expect(result.vel.x).toBeLessThan(0)
  })

  it('壁に当たっていなければ変化しない', () => {
    const ball = makeBall({ pos: { x: 200, y: 50 }, vel: { x: 30, y: 0 } })
    const result = resolveWallCollision(ball, 380)
    expect(result).toEqual(ball)
  })
})

describe('launchSpeedFromPower', () => {
  it('パワー0で最小速度、パワー100で最大速度になる', () => {
    expect(launchSpeedFromPower(0)).toBe(MIN_LAUNCH_SPEED)
    expect(launchSpeedFromPower(100)).toBe(MAX_LAUNCH_SPEED)
  })

  it('範囲外の値はクランプされる', () => {
    expect(launchSpeedFromPower(-50)).toBe(MIN_LAUNCH_SPEED)
    expect(launchSpeedFromPower(150)).toBe(MAX_LAUNCH_SPEED)
  })
})

describe('createLaunchedBall / stepLaunchLane', () => {
  it('弱すぎる発射はレーンを登り切れずファールになる', () => {
    let ball = createLaunchedBall(1, 5) // 最弱に近い
    let result = stepLaunchLane(ball, 0.016, queueRng([0]))
    let steps = 0
    while (result.kind === 'inLane' && steps < 2000) {
      ball = result.ball
      result = stepLaunchLane(ball, 0.016, queueRng([0]))
      steps += 1
    }
    expect(result.kind).toBe('foul')
  })

  it('十分な発射強さならレーン上端を越えて盤面に進入する', () => {
    let ball = createLaunchedBall(1, 100)
    let result = stepLaunchLane(ball, 0.016, queueRng([0]))
    let steps = 0
    while (result.kind === 'inLane' && steps < 2000) {
      ball = result.ball
      result = stepLaunchLane(ball, 0.016, queueRng([0]))
      steps += 1
    }
    expect(result.kind).toBe('enteredField')
    if (result.kind === 'enteredField') {
      // 強い発射ほど左方向 (盤面中央側) へ進入速度が付く
      expect(result.ball.vel.x).toBeLessThan(0)
      expect(result.ball.inLaunchLane).toBe(false)
    }
  })

  it('ファールになった場合、ボールはレーン底部近くまで戻る', () => {
    const ball = createLaunchedBall(1, 1)
    let current = ball
    let result = stepLaunchLane(current, 0.016, queueRng([0]))
    let steps = 0
    while (result.kind === 'inLane' && steps < 2000) {
      current = result.ball
      result = stepLaunchLane(current, 0.016, queueRng([0]))
      steps += 1
    }
    expect(result.kind).toBe('foul')
    expect(current.pos.y).toBeLessThanOrEqual(LANE_BOTTOM_Y)
  })
})
