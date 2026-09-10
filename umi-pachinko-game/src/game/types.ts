/** 乱数生成器。テスト時は決定的な値を注入できるようにインターフェース化する。 */
export type Rng = () => number

export type GameMode = 'normal' | 'kakuhen'

export interface Vec2 {
  x: number
  y: number
}

export interface Ball {
  id: number
  pos: Vec2
  vel: Vec2
  /** true の間はまだ発射レーンを上昇中で、盤面の釘とは衝突しない */
  inLaunchLane: boolean
  captured: boolean
}

export type ReelSymbol = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export interface ReelState {
  spinning: boolean
  /** 停止済みのリール数 (0-3)。左→右→中の順に停止する。 */
  stoppedCount: number
  elapsedMs: number
  durationMs: number
  /** 抽選で事前に決まっている結果。停止演出が終わると公開される。 */
  result: [ReelSymbol, ReelSymbol, ReelSymbol] | null
  isJackpot: boolean
}

export type BonusPhase = 'idle' | 'opening' | 'attackerOpen' | 'roundInterval' | 'finished'

export interface BonusState {
  phase: BonusPhase
  roundIndex: number
  totalRounds: number
  capturedThisRound: number
  capturedTotal: number
  phaseElapsedMs: number
  /** 大当たり終了後に突入するモード (奇数図柄なら確変) */
  nextMode: GameMode
}

export interface GameStats {
  ballCount: number
  totalLaunched: number
  totalStarts: number
  totalJackpots: number
  kakuhenChain: number
}

export interface GameState {
  mode: GameMode
  /** 時短残り回転数。0 は時短なし。Infinity は次回大当たりまで継続 (確変中はこちら)。 */
  timeShortRemaining: number
  reel: ReelState
  bonus: BonusState
  /** 抽選時点で大当たりが確定した際、リール演出が終わるまで保持しておく結果 */
  pendingBonus: { totalRounds: number; nextMode: GameMode } | null
  stats: GameStats
  log: string[]
}

export interface Pin {
  pos: Vec2
  radius: number
}

export interface Pocket {
  id: string
  pos: Vec2
  radius: number
  kind: 'start' | 'prize' | 'attacker' | 'out'
}

export const PLAYFIELD_WIDTH = 380
export const PLAYFIELD_HEIGHT = 640
export const LAUNCH_LANE_WIDTH = 34
export const BALL_RADIUS = 6
export const PIN_RADIUS = 4
