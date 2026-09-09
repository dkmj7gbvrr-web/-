import type { Ball, Pin, Rng, Vec2 } from './types'
import { BALL_RADIUS, LAUNCH_LANE_WIDTH, PLAYFIELD_HEIGHT, PLAYFIELD_WIDTH } from './types'

export const GRAVITY = 620 // px/s^2
export const PIN_RESTITUTION = 0.62
export const WALL_RESTITUTION = 0.55
export const MAX_SPEED = 520

/** 発射レーンはハンドルで蹴り出されたあと、釘盤より緩やかな摩擦で減速しながら上昇する。 */
export const LANE_DECEL = 260 // px/s^2
export const LANE_X = PLAYFIELD_WIDTH - LAUNCH_LANE_WIDTH / 2
export const LANE_TOP_Y = 55
export const LANE_BOTTOM_Y = PLAYFIELD_HEIGHT - 20
export const MIN_LAUNCH_SPEED = 250
export const MAX_LAUNCH_SPEED = 650

/** ハンドルの発射強さ (0-100) から玉の初速を求める。 */
export function launchSpeedFromPower(power: number): number {
  const clamped = Math.max(0, Math.min(100, power))
  return MIN_LAUNCH_SPEED + (clamped / 100) * (MAX_LAUNCH_SPEED - MIN_LAUNCH_SPEED)
}

/** ハンドルを弾いた瞬間の玉を、発射レーンの起点に生成する。 */
export function createLaunchedBall(id: number, power: number): Ball {
  return {
    id,
    pos: { x: LANE_X, y: LANE_BOTTOM_Y },
    vel: { x: 0, y: -launchSpeedFromPower(power) },
    inLaunchLane: true,
    captured: false,
  }
}

export type LaneStepResult =
  | { kind: 'inLane'; ball: Ball }
  | { kind: 'enteredField'; ball: Ball }
  | { kind: 'foul' }

/**
 * 発射レーン内の玉を1ステップ進める。弱すぎる発射は天井まで届かず戻ってくる「ファール」になり、
 * 十分な勢いがあれば釘盤の上端から盤面へ進入する（強く弾くほど左寄りへ飛び込む）。
 */
export function stepLaunchLane(ball: Ball, dtSeconds: number, rng: Rng): LaneStepResult {
  const vy = ball.vel.y + LANE_DECEL * dtSeconds
  const y = ball.pos.y + vy * dtSeconds

  if (y <= LANE_TOP_Y && vy < 0) {
    const overshoot = Math.abs(vy)
    const vx = -(overshoot * 0.55 + rng() * 20)
    return {
      kind: 'enteredField',
      ball: {
        ...ball,
        pos: { x: LANE_X, y: LANE_TOP_Y },
        vel: { x: vx, y: vy },
        inLaunchLane: false,
      },
    }
  }

  if (y >= LANE_BOTTOM_Y && vy >= 0) {
    return { kind: 'foul' }
  }

  return {
    kind: 'inLane',
    ball: { ...ball, pos: { x: LANE_X, y }, vel: { x: 0, y: vy } },
  }
}

function length(v: Vec2): number {
  return Math.hypot(v.x, v.y)
}

function clampSpeed(vel: Vec2): Vec2 {
  const speed = length(vel)
  if (speed <= MAX_SPEED) return vel
  const scale = MAX_SPEED / speed
  return { x: vel.x * scale, y: vel.y * scale }
}

/** 重力・速度による単純な運動を1ステップ進める（純粋関数）。 */
export function integrate(ball: Ball, dtSeconds: number): Ball {
  const vel = { x: ball.vel.x, y: ball.vel.y + GRAVITY * dtSeconds }
  const pos = {
    x: ball.pos.x + vel.x * dtSeconds,
    y: ball.pos.y + vel.y * dtSeconds,
  }
  return { ...ball, pos, vel: clampSpeed(vel) }
}

export function circlesOverlap(a: Vec2, ra: number, b: Vec2, rb: number): boolean {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const rSum = ra + rb
  return dx * dx + dy * dy < rSum * rSum
}

/**
 * 釘 (円形の静的障害物) との衝突を解決する。当たっていなければ null。
 * 反射に加えて実機のような不規則な跳ね方を再現するため、接線方向へわずかなランダム性を与える。
 */
export function resolvePinCollision(ball: Ball, pin: Pin, rng: Rng): Ball | null {
  const dx = ball.pos.x - pin.pos.x
  const dy = ball.pos.y - pin.pos.y
  const dist = Math.hypot(dx, dy)
  const minDist = BALL_RADIUS + pin.radius
  if (dist >= minDist || dist === 0) return null

  const nx = dx / dist
  const ny = dy / dist

  // めり込み分を押し戻す
  const pushed = {
    x: pin.pos.x + nx * minDist,
    y: pin.pos.y + ny * minDist,
  }

  const vDotN = ball.vel.x * nx + ball.vel.y * ny
  let vel = {
    x: ball.vel.x - (1 + PIN_RESTITUTION) * vDotN * nx,
    y: ball.vel.y - (1 + PIN_RESTITUTION) * vDotN * ny,
  }

  // 接線方向のジッターで「釘に当たると予測できない方向に散る」実機の挙動を近似する
  const jitter = (rng() - 0.5) * 60
  vel = { x: vel.x - ny * jitter, y: vel.y + nx * jitter }

  return { ...ball, pos: pushed, vel: clampSpeed(vel) }
}

/** 盤面左右の壁との衝突を解決する。 */
export function resolveWallCollision(ball: Ball, fieldWidth: number = PLAYFIELD_WIDTH): Ball {
  let { x, y } = ball.pos
  let { x: vx, y: vy } = ball.vel
  const minX = BALL_RADIUS
  const maxX = fieldWidth - BALL_RADIUS

  if (x < minX) {
    x = minX
    vx = -vx * WALL_RESTITUTION
  } else if (x > maxX) {
    x = maxX
    vx = -vx * WALL_RESTITUTION
  }

  return { ...ball, pos: { x, y }, vel: { x: vx, y: vy } }
}
