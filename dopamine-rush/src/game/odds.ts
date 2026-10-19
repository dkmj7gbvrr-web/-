import { pickWeighted, randInt, type Rng } from './rng'

/**
 * スペック（抽選テーブル）。演出の出現率は「当否を先に決め、その後に演出を振り分ける」
 * という現行パチンコ機と同じ順序で決めている（当否が先・演出が後）。
 * 数値の設計意図は README の「設計根拠」を参照。
 */
export const SPEC = {
  /** 通常時の大当たり確率 */
  normalWinRate: 1 / 80,
  /** RUSH（ST）中の大当たり確率 */
  rushWinRate: 1 / 5,
  /** RUSH の回数（ST回数）。継続率 = 1 - (1 - rushWinRate)^rushSpins ≒ 79% */
  rushSpins: 7,
  /** 通常大当たり後の RUSH 突入率。結果前の不確実性が最大になる 50% に置く */
  rushEntryRate: 0.5,
  /** 1ラウンドでアタッカーに入る最大玉数と1玉あたりの払い出し */
  ballsPerRound: 10,
  payoutPerBall: 2,
  /** 始動口に入ったときの賞球 */
  startPocketPayout: 5,
  /** RUSH 中の始動口（電チュー）の賞球。口が広いぶん少なくして、RUSH 中に玉が増えすぎないようにする */
  rushStartPayout: 1,
  /** 保留の最大数 */
  maxHolds: 4,
  /** RUSH 中の大当たりのうち、ラッキートリガー（上位 RUSH）に突入する割合 */
  luckyTriggerRate: 0.12,
  /** ラッキートリガー（上位 RUSH）中の大当たり確率と回数。継続率 = 1 - (1 - 1/4)^9 ≒ 92% */
  ltWinRate: 1 / 4,
  ltSpins: 9,
  /** 大当たり中、規定数が入ってからアタッカーが閉じきるまでの秒数（この間の入賞がオーバー入賞） */
  attackerCloseTime: 0.15,
} as const

/** normal：通常時 / rush：RUSH / lt：ラッキートリガー（上位 RUSH） */
export type Mode = 'normal' | 'rush' | 'lt'
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
  ['normal', 0.202],
  ['super', 0.035],
  ['premium', 0.003],
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
export const ROUNDS_LT: ReadonlyArray<readonly [Rounds, number]> = [
  [8, 0.3],
  [16, 0.7],
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
/** 通常時の当たりのうち、変動開始直後に画面が落ちる「ブラックアウト」（大当たり確定）になる割合 */
export const BLACKOUT_RATE = 0.04
/**
 * RUSH 最終変動の「復活チャンス」ボタンが出る割合。
 * 最終変動は必ずリーチになり、PUSH は出さずにいったんハズレ目で止める。そのあと
 * 当たりなら LAST_CHANCE_ON_WIN の割合でボタン → 押すと復活（残りは止まった瞬間にそのまま揃う）、
 * ハズレなら LAST_CHANCE_ON_MISS の割合でボタン → 押しても復活ならず。
 */
export const LAST_CHANCE_ON_WIN = 0.7

/**
 * 演出バランス（カスタム）。抽選結果は変えず、見せ方だけを変える。
 *  - standard : 標準
 *  - sakiyomi : 先読み重視。先読みゾーンが出やすく、待っている保留が育つ。変動開始後の予告は控えめ
 *  - sakibare : 先バレ。入賞の瞬間に告知音が鳴るかどうかで「0か100か」が分かる。ほかの先読みは出ない
 */
export type Custom = 'standard' | 'sakiyomi' | 'sakibare'
export const CUSTOMS: readonly Custom[] = ['standard', 'sakiyomi', 'sakibare']
/** 先読み重視のとき、先読みゾーンの出現率を何倍にするか（当たり・ハズレとも同じ倍率なので期待度はほぼ変わらない） */
export const SAKIYOMI_ZONE_BOOST = 2.5
/** 先バレの告知音が鳴る割合（当たり / ハズレ） */
export const SAKIBARE_ON_WIN = 0.8
export const SAKIBARE_ON_MISS = 0.003
export const LAST_CHANCE_ON_MISS = 0.4

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
  /** RUSH 中の当たりで、ラッキートリガー（上位 RUSH）へ突入するか */
  luckyTrigger: boolean
  /** 変動開始直後のブラックアウト（大当たり確定） */
  blackout: boolean
  /** 保留以外の期待度サイン */
  yokoku: Yokoku
  /** 違和感演出（当たりにしか付かない。テロップは出さず、気づいた人だけが分かる） */
  iwakan: Iwakan | null
}

/**
 * 違和感演出の種類。
 *  - bigHold     : 保留アイコンがほんの少し大きい（入賞した瞬間から分かる）
 *  - silentStart : 変動中のリールの刻み音が鳴らない
 *  - reverse     : 変動開始の一瞬、図柄が逆回転する
 *  - lampOff     : 図柄パネルの枠ランプが消えている
 *  - flicker     : 変動中に盤面の釘ランプが一瞬だけ全部光る
 *  - musicStop   : RUSH 中、変動開始から BGM が一瞬止まる
 *  - charaEye    : キャラ（ポッチ）の瞳が金色に光っている
 */
export type Iwakan = 'bigHold' | 'silentStart' | 'reverse' | 'lampOff' | 'flicker' | 'musicStop' | 'charaEye'
export const IWAKAN_NORMAL: ReadonlyArray<readonly [Iwakan, number]> = [
  ['bigHold', 0.25],
  ['silentStart', 0.2],
  ['reverse', 0.2],
  ['lampOff', 0.2],
  ['flicker', 0.15],
  ['charaEye', 0.15],
]
export const IWAKAN_RUSH: ReadonlyArray<readonly [Iwakan, number]> = [
  ['musicStop', 0.35],
  ['reverse', 0.25],
  ['lampOff', 0.2],
  ['flicker', 0.2],
]
/** 当たりのうち違和感演出が付く割合（ハズレには付かない＝出たら確定） */
export const IWAKAN_RATE = { normal: 0.12, rush: 0.08 } as const

const colorIndex = (c: HoldColor) => HOLD_COLORS.indexOf(c)

/** ハズレ・リーチ時の中図柄。7割は「1コマズレ」のニアミス目にする。 */
export function nearMissCenter(target: number, rng: Rng): number {
  if (rng() < 0.7) {
    const dir = rng() < 0.5 ? -1 : 1
    return ((target - 1 + dir + SYMBOL_COUNT) % SYMBOL_COUNT) + 1
  }
  let c = target
  while (c === target) c = randInt(rng, 1, SYMBOL_COUNT)
  return c
}

export const WIN_RATE: Record<Mode, number> = {
  normal: SPEC.normalWinRate,
  rush: SPEC.rushWinRate,
  lt: SPEC.ltWinRate,
}

export function decideSpin(mode: Mode, rng: Rng): SpinOutcome {
  const win = rng() < WIN_RATE[mode]
  const tell =
    mode !== 'normal' ? 'white' : pickWeighted(win ? TELL_ON_WIN : TELL_ON_MISS, rng)
  let entryColor: HoldColor = tell
  if (colorIndex(tell) >= colorIndex('green') && rng() < HOLD_UPGRADE_RATE) {
    entryColor = HOLD_COLORS[randInt(rng, 0, colorIndex(tell) - 1)]
  }
  const reachTable =
    mode !== 'normal'
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
  const rounds = pickWeighted(mode === 'lt' ? ROUNDS_LT : mode === 'rush' ? ROUNDS_RUSH : ROUNDS_NORMAL, rng)
  const shownRounds: Rounds = rounds > 4 && rng() < UPGRADE_RATE ? 4 : rounds
  const rushEntry = mode !== 'normal' ? true : rng() < SPEC.rushEntryRate
  const luckyTrigger = win && mode === 'rush' && rng() < SPEC.luckyTriggerRate
  const blackout = win && mode === 'normal' && rng() < BLACKOUT_RATE
  const yokoku = decideYokoku(mode, win, reach, rng)
  const iwakan =
    win && rng() < (mode === 'normal' ? IWAKAN_RATE.normal : IWAKAN_RATE.rush)
      ? pickWeighted(mode === 'normal' ? IWAKAN_NORMAL : IWAKAN_RUSH, rng)
      : null

  return {
    mode,
    win,
    symbols,
    reach,
    revival,
    kakutei,
    tell,
    entryColor,
    rounds,
    shownRounds,
    rushEntry,
    luckyTrigger,
    blackout,
    yokoku,
    iwakan,
  }
}

// ---------------------------------------------------------------- 保留以外の期待度サイン（予告）

/** 色の序列：青 < 緑 < 赤 < 金 < 虹（虹は当たりでしか出ない＝確定） */
export const SIGN_COLORS = ['white', 'blue', 'green', 'red', 'gold', 'rainbow'] as const
export type SignColor = (typeof SIGN_COLORS)[number]

export interface Yokoku {
  /** ステップアップ予告の到達段階（0＝発生なし、5＝最終段階） */
  stepUp: number
  /** 擬似連の回数（1＝なし、2〜4＝NEXT で再始動した回数+1） */
  gijiren: number
  /** リーチタイトルの色（リーチ時のみ意味を持つ） */
  title: SignColor
  /** SUPER 以上のリーチで出るカットインの色（null＝出ない） */
  cutin: SignColor | null
  /** 先読みゾーン（この保留より前の変動で連続予告を出す）の対象になり得るか */
  zone: boolean
  /** ポッチ予告（変動開始時にポッチが現れる。null＝出ない） */
  pochi: PochiTell | null
}

// ---------------------------------------------------------------- ポッチ予告

/** ポッチが現れる場所：下から覗く / 盤面を横切って飛ぶ / 図柄の上に乗る / 画面いっぱいの巨大な顔 */
export const POCHI_WHERE = ['peek', 'flyby', 'onReel', 'giant'] as const
/** ポッチの行動：手（翼）を振る / 踊る / 空に向かって炎を吐く */
export const POCHI_ACTION = ['wave', 'dance', 'fire'] as const
/** ポッチの持ち物：なし / りんご / 魚 / 赤い宝石 / 王冠 / 虹色の卵 */
export const POCHI_ITEM = ['none', 'apple', 'fish', 'gem', 'crown', 'rainbowEgg'] as const
export type PochiWhere = (typeof POCHI_WHERE)[number]
export type PochiAction = (typeof POCHI_ACTION)[number]
export type PochiItem = (typeof POCHI_ITEM)[number]
export interface PochiTell {
  where: PochiWhere
  action: PochiAction
  item: PochiItem
}

/** ポッチ予告が出る割合（頻度は控えめ） */
export const POCHI_RATE: Record<YokokuCategory, number> = {
  win: 0.45,
  missSuper: 0.2,
  missNormal: 0.08,
  missNone: 0.025,
}
/** 場所・行動・持ち物は、当たりかハズレかでそれぞれ独立に選ぶ（重なるほど期待度が上がる） */
export const POCHI_WHERE_TABLE: Record<'win' | 'miss', Table<PochiWhere>> = {
  win: [['peek', 0.2], ['flyby', 0.3], ['onReel', 0.3], ['giant', 0.2]],
  miss: [['peek', 0.55], ['flyby', 0.35], ['onReel', 0.1], ['giant', 0]],
}
export const POCHI_ACTION_TABLE: Record<'win' | 'miss', Table<PochiAction>> = {
  win: [['wave', 0.25], ['dance', 0.35], ['fire', 0.4]],
  miss: [['wave', 0.6], ['dance', 0.3], ['fire', 0.1]],
}
export const POCHI_ITEM_TABLE: Record<'win' | 'miss', Table<PochiItem>> = {
  win: [['none', 0.2], ['apple', 0.15], ['fish', 0.15], ['gem', 0.2], ['crown', 0.18], ['rainbowEgg', 0.12]],
  miss: [['none', 0.5], ['apple', 0.3], ['fish', 0.14], ['gem', 0.05], ['crown', 0.01], ['rainbowEgg', 0]],
}

export function decidePochi(cat: YokokuCategory, rng: Rng): PochiTell | null {
  if (rng() >= POCHI_RATE[cat]) return null
  const k = cat === 'win' ? 'win' : 'miss'
  return {
    where: pickWeighted(POCHI_WHERE_TABLE[k], rng),
    action: pickWeighted(POCHI_ACTION_TABLE[k], rng),
    item: pickWeighted(POCHI_ITEM_TABLE[k], rng),
  }
}

type Table<T extends string | number> = ReadonlyArray<readonly [T, number]>
/** 当たり / SUPER 以上のハズレ / ノーマルリーチのハズレ / リーチなしのハズレ */
export type YokokuCategory = 'win' | 'missSuper' | 'missNormal' | 'missNone'

export const STEPUP_TABLE: Record<YokokuCategory, Table<number>> = {
  win: [[0, 0.25], [1, 0.05], [2, 0.1], [3, 0.2], [4, 0.25], [5, 0.15]],
  missSuper: [[0, 0.35], [1, 0.1], [2, 0.2], [3, 0.25], [4, 0.1], [5, 0]],
  missNormal: [[0, 0.6], [1, 0.15], [2, 0.15], [3, 0.1], [4, 0], [5, 0]],
  missNone: [[0, 0.93], [1, 0.05], [2, 0.02], [3, 0], [4, 0], [5, 0]],
}
export const GIJIREN_TABLE: Record<YokokuCategory, Table<number>> = {
  win: [[1, 0.35], [2, 0.3], [3, 0.25], [4, 0.1]],
  missSuper: [[1, 0.5], [2, 0.35], [3, 0.15], [4, 0]],
  missNormal: [[1, 0.8], [2, 0.2], [3, 0], [4, 0]],
  missNone: [[1, 1], [2, 0], [3, 0], [4, 0]],
}
export const TITLE_TABLE: Record<YokokuCategory, Table<SignColor>> = {
  win: [['white', 0.1], ['blue', 0.15], ['green', 0.2], ['red', 0.3], ['gold', 0.15], ['rainbow', 0.1]],
  missSuper: [['white', 0.3], ['blue', 0.3], ['green', 0.25], ['red', 0.13], ['gold', 0.02], ['rainbow', 0]],
  missNormal: [['white', 0.6], ['blue', 0.3], ['green', 0.1], ['red', 0], ['gold', 0], ['rainbow', 0]],
  missNone: [['white', 1], ['blue', 0], ['green', 0], ['red', 0], ['gold', 0], ['rainbow', 0]],
}
export const CUTIN_TABLE: Record<'win' | 'miss', Table<SignColor>> = {
  win: [['blue', 0.1], ['green', 0.2], ['red', 0.35], ['gold', 0.25], ['rainbow', 0.1]],
  miss: [['blue', 0.45], ['green', 0.35], ['red', 0.18], ['gold', 0.02], ['rainbow', 0]],
}
/** 先読みゾーン（連続予告）の対象になる割合 */
export const ZONE_RATE: Record<YokokuCategory, number> = {
  win: 0.45,
  missSuper: 0.2,
  missNormal: 0.05,
  missNone: 0.01,
}

export function yokokuCategory(win: boolean, reach: Reach): YokokuCategory {
  if (win) return 'win'
  if (reach === 'super' || reach === 'premium') return 'missSuper'
  if (reach === 'normal') return 'missNormal'
  return 'missNone'
}

export function decideYokoku(mode: Mode, win: boolean, reach: Reach, rng: Rng): Yokoku {
  const cat = yokokuCategory(win, reach)
  const normal = mode === 'normal'
  return {
    stepUp: normal ? pickWeighted(STEPUP_TABLE[cat], rng) : 0,
    gijiren: normal ? pickWeighted(GIJIREN_TABLE[cat], rng) : 1,
    title: pickWeighted(TITLE_TABLE[cat], rng),
    cutin: reach === 'super' || reach === 'premium' ? pickWeighted(CUTIN_TABLE[win ? 'win' : 'miss'], rng) : null,
    zone: normal && rng() < ZONE_RATE[cat],
    pochi: normal ? decidePochi(cat, rng) : null,
  }
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

/** ラッキートリガーの継続率 */
export function ltContinueRate(): number {
  return 1 - Math.pow(1 - SPEC.ltWinRate, SPEC.ltSpins)
}

/** RUSH の継続率（ST 中に1回以上当たる確率） */
export function rushContinueRate(): number {
  return 1 - Math.pow(1 - SPEC.rushWinRate, SPEC.rushSpins)
}

/**
 * リーチの「決着のさせ方」。どれも最終図柄（symbols）は変えず、見せ方だけを変える。
 *  - straight    : コマ送りでそのまま止まる
 *  - slip        : 1コマ手前で止まり、暗転の「タメ」のあと1コマすべって当たり（失敗と思わせて成功）
 *  - revival     : ハズレで止まり、暗転のあと全リールが再始動して揃う（失敗と思わせて成功）
 *  - darken      : 決着の直前に画面が真っ暗・無音になり、明けた瞬間に結果（当たりもハズレもある）
 *    ※大当たり確定の「ブラックアウト」（SpinOutcome.blackout）とは別物
 *  - fakeAlign   : 一瞬揃って光りかけたあと、1コマずれてハズレ（成功と思わせて失敗）
 *  - fakeRevival : ハズレで止まり、復活と同じ暗転のタメを見せてから、そのままハズレ
 */
export type Finale = 'straight' | 'slip' | 'revival' | 'darken' | 'fakeAlign' | 'fakeRevival'
export type FinaleTier = 'normal' | 'super'

export const FINALE_ON_WIN: Record<FinaleTier, ReadonlyArray<readonly [Finale, number]>> = {
  normal: [
    ['straight', 0.6],
    ['slip', 0.4],
  ],
  super: [
    ['straight', 0.35],
    ['slip', 0.35],
    ['darken', 0.3],
  ],
}
export const FINALE_ON_MISS: Record<FinaleTier, ReadonlyArray<readonly [Finale, number]>> = {
  normal: [
    ['straight', 0.6],
    ['fakeAlign', 0.4],
  ],
  super: [
    ['straight', 0.35],
    ['fakeAlign', 0.3],
    ['fakeRevival', 0.2],
    ['darken', 0.15],
  ],
}

/** 中図柄が「揃い目の1コマ先」なら、一度揃ってからずれる fakeAlign が使える */
export function canFakeAlign(o: SpinOutcome): boolean {
  return !o.win && o.symbols[1] === (o.symbols[0] % SYMBOL_COUNT) + 1
}

export function pickFinale(o: SpinOutcome, tier: FinaleTier, rng: Rng): Finale {
  if (o.win) return o.revival ? 'revival' : pickWeighted(FINALE_ON_WIN[tier], rng)
  const table = canFakeAlign(o) ? FINALE_ON_MISS[tier] : FINALE_ON_MISS[tier].filter(([f]) => f !== 'fakeAlign')
  return pickWeighted(table, rng)
}

/** 図柄 v の1コマ前 / 1コマ先（1〜7 で循環） */
export const prevSymbol = (v: number) => ((v - 2 + SYMBOL_COUNT) % SYMBOL_COUNT) + 1
export const nextSymbol = (v: number) => (v % SYMBOL_COUNT) + 1
