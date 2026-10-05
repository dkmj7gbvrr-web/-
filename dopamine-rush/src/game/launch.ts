import { BOARD_TOP, WALL_R } from './physics'
import type { Rng } from './rng'

/**
 * 発射レール：玉は左端のレールを駆け上がり、左上の弧を回って盤面の上を右へ走り、
 * 発射の強さで決まる位置から盤面へ落ちる（パチンコのストロークと同じ考え方）。
 */
export const RAIL_X = 7
export const RAIL_BOTTOM = 790
export const RAIL_TOP = BOARD_TOP + 26
export const RAIL_R = 30
export const RAIL_Y = BOARD_TOP - 4
const ARC_CX = RAIL_X + RAIL_R
const VERTICAL = RAIL_BOTTOM - RAIL_TOP
const ARC = (Math.PI / 2) * RAIL_R

/** これより弱いと盤面まで届かず戻ってくる（ファール：玉は返ってくる） */
export const FOUL_BELOW = 0.08
/** 同じ強さでも毎回わずかにぶれる（手打ちの揺らぎ） */
export const ENTRY_JITTER = 14
/** 強さ 0〜1 の範囲で最も左 / 最も右に入る位置 */
export const ENTRY_MIN = ARC_CX + ENTRY_JITTER
export const ENTRY_MAX = WALL_R - 26
const RAIL_SPEED = 2300
const FOUL_TIME = 0.55

export interface RailBall {
  id: number
  /** 発射してからの経過秒 */
  t: number
  dur: number
  entryX: number
  /** 届かずに戻ってくる玉か / 戻る玉がどこまで上がるか（0〜1） */
  foul: boolean
  rise: number
}

/** 強さから狙いの入射位置（ぶれなし） */
export function entryForStrength(strength: number): number {
  const k = Math.min(1, Math.max(0, (strength - FOUL_BELOW) / (1 - FOUL_BELOW)))
  return ENTRY_MIN + (ENTRY_MAX - ENTRY_MIN) * k
}

export function launch(id: number, strength: number, rng: Rng): RailBall {
  if (strength < FOUL_BELOW) {
    return { id, t: 0, dur: FOUL_TIME, entryX: RAIL_X, foul: true, rise: 0.25 + 0.6 * (strength / FOUL_BELOW) }
  }
  const x = entryForStrength(strength) + (rng() * 2 - 1) * ENTRY_JITTER
  const entryX = Math.min(ENTRY_MAX + ENTRY_JITTER, Math.max(ENTRY_MIN - ENTRY_JITTER, x))
  const length = VERTICAL + ARC + (entryX - ARC_CX)
  return { id, t: 0, dur: length / RAIL_SPEED, entryX, foul: false, rise: 1 }
}

/** レール上の距離 d の点 */
function pointAt(d: number): { x: number; y: number } {
  if (d <= VERTICAL) return { x: RAIL_X, y: RAIL_BOTTOM - d }
  d -= VERTICAL
  if (d <= ARC) {
    const a = Math.PI + (d / RAIL_R)
    return { x: ARC_CX + Math.cos(a) * RAIL_R, y: RAIL_TOP + Math.sin(a) * RAIL_R }
  }
  return { x: ARC_CX + (d - ARC), y: RAIL_Y }
}

/** 描画用：レール上の玉の現在位置 */
export function railPosition(rb: RailBall): { x: number; y: number } {
  const u = Math.min(1, rb.t / rb.dur)
  if (rb.foul) return pointAt(VERTICAL * rb.rise * Math.sin(Math.PI * u))
  // 打ち出しは一番速く、上の弧を回ってから少しだけ減速する
  const eased = 1 - (1 - u) * (1 - u) * 0.35 - (1 - u) * 0.65
  return pointAt((VERTICAL + ARC + (rb.entryX - ARC_CX)) * eased)
}

/** 盤面へ入る瞬間の横向きの勢い（強いほど右へ流れる） */
export function entryVx(strength: number, rng: Rng): number {
  return 40 + strength * 90 + (rng() - 0.5) * 40
}
