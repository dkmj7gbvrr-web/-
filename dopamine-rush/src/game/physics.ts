import type { Rng } from './rng'

/** 論理座標系（キャンバスはこのサイズを画面に合わせて拡大縮小する） */
export const W = 450
export const H = 800
export const BOARD_TOP = 262
export const BOARD_BOTTOM = 748
export const WALL_L = 14
export const WALL_R = W - 14
export const BALL_R = 6
export const PEG_R = 4.5
export const GRAVITY = 1150
const MAX_SPEED = 950
const RESTITUTION = 0.52

export interface Ball {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  /** この玉がこれまでに釘に当たった回数（音程を上げていくのに使う） */
  hits: number
  /** 大当たり中に自動で降ってくる無料の玉 */
  free: boolean
  trail: Array<{ x: number; y: number }>
}

export interface Peg {
  x: number
  y: number
  /** 光っている残り時間（秒） */
  glow: number
  gold: boolean
}

export function createPegs(): Peg[] {
  const pegs: Peg[] = []
  const rows = 13
  const spacingX = 34
  const top = BOARD_TOP + 34
  const spacingY = (BOARD_BOTTOM - 40 - top) / (rows - 1)
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : spacingX / 2
    for (let x = WALL_L + 20 + offset; x <= WALL_R - 16; x += spacingX) {
      pegs.push({ x, y: top + r * spacingY, glow: 0, gold: false })
    }
  }
  return pegs
}

export function spawnBall(id: number, x: number, rng: Rng, free = false): Ball {
  return {
    id,
    x: Math.min(WALL_R - BALL_R, Math.max(WALL_L + BALL_R, x)),
    y: BOARD_TOP - 4,
    vx: (rng() - 0.5) * 60,
    vy: 40,
    hits: 0,
    free,
    trail: [],
  }
}

/**
 * 玉を dt 秒進める。衝突した釘のインデックスを返す。
 * 釘との衝突は円同士の反射＋わずかなランダム成分で「毎回違う跳ね方」にしている。
 */
export function stepBall(ball: Ball, pegs: Peg[], dt: number, rng: Rng): number[] {
  const hits: number[] = []
  ball.vy += GRAVITY * dt
  const speed = Math.hypot(ball.vx, ball.vy)
  if (speed > MAX_SPEED) {
    ball.vx *= MAX_SPEED / speed
    ball.vy *= MAX_SPEED / speed
  }
  ball.x += ball.vx * dt
  ball.y += ball.vy * dt

  if (ball.x < WALL_L + BALL_R) {
    ball.x = WALL_L + BALL_R
    ball.vx = Math.abs(ball.vx) * RESTITUTION
  } else if (ball.x > WALL_R - BALL_R) {
    ball.x = WALL_R - BALL_R
    ball.vx = -Math.abs(ball.vx) * RESTITUTION
  }

  const minDist = BALL_R + PEG_R
  for (let i = 0; i < pegs.length; i++) {
    const p = pegs[i]
    const dx = ball.x - p.x
    const dy = ball.y - p.y
    if (Math.abs(dx) > minDist || Math.abs(dy) > minDist) continue
    const d2 = dx * dx + dy * dy
    if (d2 >= minDist * minDist || d2 === 0) continue
    const d = Math.sqrt(d2)
    const nx = dx / d
    const ny = dy / d
    // 押し出し
    ball.x = p.x + nx * minDist
    ball.y = p.y + ny * minDist
    const vn = ball.vx * nx + ball.vy * ny
    if (vn < 0) {
      ball.vx -= (1 + RESTITUTION) * vn * nx
      ball.vy -= (1 + RESTITUTION) * vn * ny
      // 真上に乗って止まらないよう、横方向に小さく揺らす
      ball.vx += (rng() - 0.5) * 70
      hits.push(i)
    }
  }
  return hits
}

/** 玉が盤面の底（入賞判定ライン）に達したか */
export function reachedBottom(ball: Ball): boolean {
  return ball.y >= BOARD_BOTTOM
}
