import type { GameMode, Rng } from './types'

/**
 * 大当たり確率。実機 (海系スペックでは通常 1/319.7・確変 1/79.9 前後が一般的) をそのまま使うと
 * ブラウザゲームとして遊ぶには試行回数が多すぎるため、「確変は通常の約4倍当たりやすい」という
 * 実機共通の比率は保ちつつ、遊びやすいよう確率自体は調整している。
 */
export const ODDS: Record<GameMode, number> = {
  normal: 1 / 99,
  kakuhen: 1 / 40,
}

export const TIME_SHORT_STARTS_ON_NORMAL_WIN = 100

export interface RoundSpec {
  rounds: number
  weight: number
}

/** ラウンド数抽選テーブル。多くの海系機種と同様、16Rが最も出やすい配分にしてある。 */
export const ROUND_TABLE: RoundSpec[] = [
  { rounds: 16, weight: 70 },
  { rounds: 10, weight: 15 },
  { rounds: 5, weight: 10 },
  { rounds: 3, weight: 5 },
]

export function isJackpot(mode: GameMode, rng: Rng): boolean {
  return rng() < ODDS[mode]
}

/** 大当たり図柄 (0-9) を抽選する。奇数図柄=確変、偶数図柄=通常(時短のみ)。 */
export function drawJackpotSymbol(rng: Rng): number {
  return Math.floor(rng() * 10)
}

export function isKakuhenSymbol(symbol: number): boolean {
  return symbol % 2 === 1
}

export function drawRoundCount(rng: Rng): number {
  const totalWeight = ROUND_TABLE.reduce((sum, spec) => sum + spec.weight, 0)
  let r = rng() * totalWeight
  for (const spec of ROUND_TABLE) {
    if (r < spec.weight) return spec.rounds
    r -= spec.weight
  }
  return ROUND_TABLE[0].rounds
}

export function defaultRng(): Rng {
  return Math.random
}
