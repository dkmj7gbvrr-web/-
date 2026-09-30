import { pickWeighted, randInt, type Rng } from './rng'

/**
 * スペック（抽選テーブル）。演出の出現率は「当否を先に決め、その後に演出を振り分ける」
 * という現行パチンコ機と同じ順序で決めている（当否が先・演出が後）。
 * 数値の設計意図は README の「設計根拠」を参照。
 */
export const SPEC = {
  /** 通常時の大当たり確率 */
  normalWinRate: 1 / 25,
  /** RUSH（ST）中の大当たり確率 */
  rushWinRate: 1 / 5,
  /** RUSH の回数（ST回数）。継続率 = 1 - (1 - rushWinRate)^rushSpins ≒ 79% */
  rushSpins: 7,
  /** 通常大当たり後の RUSH 突入率。結果前の不確実性が最大になる 50% に置く */
  rushEntryRate: 0.5,
  /** 1ラウンドでアタッカーに入る最大玉数と1玉あたりの払い出し */
  ballsPerRound: 10,
  payoutPerBall: 10,
  /** 始動口に入ったときの賞球 */
  startPocketPayout: 3,
  /** 保留の最大数 */
  maxHolds: 4,
} as const

export type Mode = 'normal' | 'rush'
export const HOLD_COLORS = ['white', 'blue', 'green', 'red', 'gold', 'rainbow'] as const
export type HoldColor = (typeof HOLD_COLORS)[number]
export type Reach = 'none' | 'normal' | 'super' | 'premium'
export type Rounds = 4 | 8 | 16

/** 保留色の出現率（当たり時 / ハズレ時）。虹はハズレでは出ない＝確定。 */
export const TELL_ON_WIN: ReadonlyArray<readonly [HoldColor, number]> = [
  ['white', 0.2],
  ['blue', 0.14],
  ['green', 0.16],
  ['red', 0.24],
  ['gold', 0.16],
  ['rainbow', 0.1],
]
export const TELL_ON_MISS: ReadonlyArray<readonly [HoldColor, number]> = [
  ['white', 0.83],
  ['blue', 0.11],
  ['green', 0.045],
  ['red', 0.012],
  ['gold', 0.003],
  ['rainbow', 0],
]

/**
 * リーチ種別の出現率。ハズレ時のリーチ（＝ニアミス）はおよそ2〜3割に収める。
 * 当たり時の 'none' は前触れなしの「突然当たり」＝予測誤差が最大になる当たり方。
 */
export const REACH_ON_WIN: ReadonlyArray<readonly [Reach, number]> = [
  ['none', 0.06],
  ['normal', 0.14],
  ['super', 0.52],
  ['premium', 0.28],
]
export const REACH_ON_MISS: ReadonlyArray<readonly [Reach, number]> = [
  ['none', 0.76],
  ['normal', 0.17],
  ['super', 0.065],
  ['premium', 0.005],
]
export const RUSH_REACH_ON_WIN: ReadonlyArray<readonly [Reach, number]> = [
  ['none', 0.45],
  ['normal', 0.2],
  ['super', 0.35],
]
export const RUSH_REACH_ON_MISS: ReadonlyArray<readonly [Reach, number]> = [
  ['none', 0.7],
  ['normal', 0.22],
  ['super', 0.08],
]

export const ROUNDS_NORMAL: ReadonlyArray<readonly [Rounds, number]> = [
  [4, 0.45],
  [8, 0.35],
  [16, 0.2],
]
export const ROUNDS_RUSH: ReadonlyArray<readonly [Rounds, number]> = [
  [4, 0.3],
  [8, 0.4],
  [16, 0.3],
]

/** 最終ラウンドが4Rより多いとき、最初は4Rと見せて途中で「昇格」させる割合 */
export const UPGRADE_RATE = 0.4
/** スーパー以上のリーチで当たるとき、一度ハズレ目を見せてから復活させる割合 */
export const REVIVAL_RATE = 0.22
/** 当たり時に変動開始の瞬間「確定フラッシュ」を出す割合 */
export const KAKUTEI_FLASH_RATE = 0.05
/** 保留が入った瞬間は本来より低い色で見せ、変動開始時に「保留変化」させる割合 */
export const HOLD_UPGRADE_RATE = 0.45

export const SYMBOL_COUNT = 7

export interface SpinOutcome {
  mode: Mode
  win: boolean
  /** 最終停止図柄 [左, 中, 右]（1〜7） */
  symbols: [number, number, number]
  reach: Reach
  /** 当たりのとき、中図柄が一度ハズレ目で止まってから復活する */
  revival: boolean
  /** 変動開始時の確定フラッシュ */
  kakutei: boolean
  /** 本当の保留色（期待度） */
  tell: HoldColor
  /** 入賞直後に見せる保留色（tell 以下）。変動開始時に tell へ変化する */
  entryColor: HoldColor
  /** 大当たりのラウンド数（最終）と、最初に表示するラウンド数 */
  rounds: Rounds
  shownRounds: Rounds
  /** 通常時の大当たりの場合、RUSH 突入チャレンジに成功するか */
  rushEntry: boolean
}

const colorIndex = (c: HoldColor) => HOLD_COLORS.indexOf(c)

/** ハズレ・リーチ時の中図柄。7割は「1コマズレ」のニアミス目にする。 */
function nearMissCenter(target: number, rng: Rng): number {
  if (rng() < 0.7) {
    const dir = rng() < 0.5 ? -1 : 1
    return ((target - 1 + dir + SYMBOL_COUNT) % SYMBOL_COUNT) + 1
  }
  let c = target
  while (c === target) c = randInt(rng, 1, SYMBOL_COUNT)
  return c
}

export function decideSpin(mode: Mode, rng: Rng): SpinOutcome {
  const win = rng() < (mode === 'rush' ? SPEC.rushWinRate : SPEC.normalWinRate)
  const tell =
    mode === 'rush' ? 'white' : pickWeighted(win ? TELL_ON_WIN : TELL_ON_MISS, rng)
  let entryColor: HoldColor = tell
  if (colorIndex(tell) >= colorIndex('green') && rng() < HOLD_UPGRADE_RATE) {
    entryColor = HOLD_COLORS[randInt(rng, 0, colorIndex(tell) - 1)]
  }
  const reachTable =
    mode === 'rush'
      ? win
        ? RUSH_REACH_ON_WIN
        : RUSH_REACH_ON_MISS
      : win
        ? REACH_ON_WIN
        : REACH_ON_MISS
  const reach = pickWeighted(reachTable, rng)

  let symbols: [number, number, number]
  if (win) {
    const s = randInt(rng, 1, SYMBOL_COUNT)
    symbols = [s, s, s]
  } else if (reach !== 'none') {
    const s = randInt(rng, 1, SYMBOL_COUNT)
    symbols = [s, nearMissCenter(s, rng), s]
  } else {
    const l = randInt(rng, 1, SYMBOL_COUNT)
    let r = l
    while (r === l) r = randInt(rng, 1, SYMBOL_COUNT)
    symbols = [l, randInt(rng, 1, SYMBOL_COUNT), r]
  }

  const revival = win && (reach === 'super' || reach === 'premium') && rng() < REVIVAL_RATE
  const kakutei = win && mode === 'normal' && rng() < KAKUTEI_FLASH_RATE
  const rounds = pickWeighted(mode === 'rush' ? ROUNDS_RUSH : ROUNDS_NORMAL, rng)
  const shownRounds: Rounds = rounds > 4 && rng() < UPGRADE_RATE ? 4 : rounds
  const rushEntry = mode === 'rush' ? true : rng() < SPEC.rushEntryRate

  return { mode, win, symbols, reach, revival, kakutei, tell, entryColor, rounds, shownRounds, rushEntry }
}

/** ベイズの定理で「その演出が出たときの大当たり期待度」を計算する。 */
export function reliability<T extends string | number>(
  value: T,
  winTable: ReadonlyArray<readonly [T, number]>,
  missTable: ReadonlyArray<readonly [T, number]>,
  winRate: number,
): number {
  const norm = (t: ReadonlyArray<readonly [T, number]>) => {
    const total = t.reduce((s, [, w]) => s + w, 0)
    return (t.find(([v]) => v === value)?.[1] ?? 0) / total
  }
  const pw = norm(winTable) * winRate
  const pm = norm(missTable) * (1 - winRate)
  return pw + pm === 0 ? 0 : pw / (pw + pm)
}

/** RUSH の継続率（ST 中に1回以上当たる確率） */
export function rushContinueRate(): number {
  return 1 - Math.pow(1 - SPEC.rushWinRate, SPEC.rushSpins)
}
