import { W, WALL_L, WALL_R } from './physics'

export type PocketKind = 'start' | 'bonus' | 'attacker' | 'out'

export interface PocketHit {
  kind: PocketKind
  /** 払い出し玉数（start / attacker の払い出しは呼び出し側で扱う） */
  payout: number
}

export type BoardPhase = 'normal' | 'fever' | 'rush'

/** 始動口は盤面下部を左右にゆっくり往復する。狙って落とせる＝自分で操作している感覚を残す。 */
export const START_PERIOD = 4.6
export function startPocket(phase: BoardPhase, t: number): { x: number; w: number } {
  const w = phase === 'rush' ? 110 : 48
  const amp = phase === 'rush' ? 80 : 120
  return { x: W / 2 + Math.sin((t / START_PERIOD) * Math.PI * 2) * amp, w }
}

/** 常設の小当たりポケット（こまめに小さな報酬を返す） */
export const BONUS_POCKETS: ReadonlyArray<{ x0: number; x1: number; payout: number }> = [
  { x0: WALL_L, x1: WALL_L + 42, payout: 4 },
  { x0: WALL_R - 42, x1: WALL_R, payout: 4 },
  { x0: 128, x1: 152, payout: 2 },
  { x0: 298, x1: 322, payout: 2 },
]

export const ATTACKER = { x0: 80, x1: W - 80 }

export function classifyPocket(x: number, phase: BoardPhase, t: number): PocketHit {
  if (phase === 'fever') {
    if (x >= ATTACKER.x0 && x <= ATTACKER.x1) return { kind: 'attacker', payout: 0 }
    return { kind: 'out', payout: 0 }
  }
  const sp = startPocket(phase, t)
  if (Math.abs(x - sp.x) <= sp.w / 2) return { kind: 'start', payout: 0 }
  for (const b of BONUS_POCKETS) {
    if (x >= b.x0 && x <= b.x1) return { kind: 'bonus', payout: b.payout }
  }
  return { kind: 'out', payout: 0 }
}
