import type { GameMode, ReachTier, ReelSymbol, Rng, StartOutcome, TellTier } from './types'

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

/** 保留は最大4個まで貯められる (実機の一般的な仕様と同じ)。 */
export const MAX_HOLDS = 4

/** ハズレのうち、リーチ(前後2つの図柄が揃った状態で最後の1つを待つ演出)になる割合。 */
export const REACH_RATE_ON_MISS = 0.28

interface WeightedOption<T> {
  value: T
  weight: number
}

function pickWeighted<T>(table: WeightedOption<T>[], rng: Rng): T {
  const totalWeight = table.reduce((sum, spec) => sum + spec.weight, 0)
  let r = rng() * totalWeight
  for (const spec of table) {
    if (r < spec.weight) return spec.value
    r -= spec.weight
  }
  return table[0].value
}

/** ラウンド数抽選テーブル。多くの海系機種と同様、16Rが最も出やすい配分にしてある。 */
export const ROUND_TABLE: WeightedOption<number>[] = [
  { value: 16, weight: 70 },
  { value: 10, weight: 15 },
  { value: 5, weight: 10 },
  { value: 3, weight: 5 },
]

/** 大当たり時のリーチ格抽選テーブル。格が上がるほど大当たり期待度が高い。 */
const REACH_TABLE_ON_WIN: WeightedOption<ReachTier>[] = [
  { value: 'premium', weight: 20 },
  { value: 'super', weight: 40 },
  { value: 'normal', weight: 40 },
]

/** ハズレ時のリーチ格抽選テーブル。プレミアはハズレでは出さず「格上=ほぼ勝ち」を保つ。 */
const REACH_TABLE_ON_MISS: WeightedOption<ReachTier>[] = [
  { value: 'super', weight: 25 },
  { value: 'normal', weight: 75 },
]

/** 保留の色 (先読み) 抽選テーブル。大当たりでも低い色が出ることがある「隠れ大当たり」。 */
const TELL_TABLE_ON_WIN: WeightedOption<TellTier>[] = [
  { value: 'rainbow', weight: 10 },
  { value: 'red', weight: 35 },
  { value: 'green', weight: 35 },
  { value: 'blue', weight: 15 },
  { value: 'white', weight: 5 },
]

/** ハズレでも稀に高い色が出る「ガセ先読み」。色は結果を保証しない。 */
const TELL_TABLE_ON_MISS: WeightedOption<TellTier>[] = [
  { value: 'white', weight: 80 },
  { value: 'blue', weight: 12 },
  { value: 'green', weight: 5 },
  { value: 'red', weight: 2.5 },
  { value: 'rainbow', weight: 0.5 },
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
  return pickWeighted(ROUND_TABLE, rng)
}

export function drawReachTier(isJackpotResult: boolean, rng: Rng): ReachTier {
  return pickWeighted(isJackpotResult ? REACH_TABLE_ON_WIN : REACH_TABLE_ON_MISS, rng)
}

export function drawTellTier(isJackpotResult: boolean, rng: Rng): TellTier {
  return pickWeighted(isJackpotResult ? TELL_TABLE_ON_WIN : TELL_TABLE_ON_MISS, rng)
}

function drawMissSymbols(hasReach: boolean, rng: Rng): [ReelSymbol, ReelSymbol, ReelSymbol] {
  const a = Math.floor(rng() * 10) as ReelSymbol
  if (hasReach) {
    // リーチ: 前後2つを揃え、最後の1つだけ外す
    let c = Math.floor(rng() * 10) as ReelSymbol
    if (c === a) c = ((c + 5) % 10) as ReelSymbol
    return [a, a, c]
  }
  let b = Math.floor(rng() * 10) as ReelSymbol
  if (b === a) b = ((b + 1) % 10) as ReelSymbol
  let c = Math.floor(rng() * 10) as ReelSymbol
  if (c === a) c = ((c + 5) % 10) as ReelSymbol
  return [a, b, c]
}

/**
 * 始動口に入賞した瞬間に、抽選結果一式を確定する。保留中でもこの結果は変わらない
 * (先読み演出は、保留の時点で確定しているこの結果を tell 色として先出しするもの)。
 */
export function rollStartOutcome(mode: GameMode, rng: Rng): StartOutcome {
  const won = isJackpot(mode, rng)

  if (won) {
    const symbol = drawJackpotSymbol(rng) as ReelSymbol
    const nextMode: GameMode = isKakuhenSymbol(symbol) ? 'kakuhen' : 'normal'
    const totalRounds = drawRoundCount(rng)
    const reachTier = drawReachTier(true, rng)
    const tell = drawTellTier(true, rng)
    return {
      isJackpot: true,
      result: [symbol, symbol, symbol],
      reachTier,
      tell,
      nextMode,
      totalRounds,
    }
  }

  const hasReach = rng() < REACH_RATE_ON_MISS
  const result = drawMissSymbols(hasReach, rng)
  const reachTier = hasReach ? drawReachTier(false, rng) : 'none'
  const tell = drawTellTier(false, rng)
  return { isJackpot: false, result, reachTier, tell, nextMode: 'normal', totalRounds: 0 }
}

export function defaultRng(): Rng {
  return Math.random
}
