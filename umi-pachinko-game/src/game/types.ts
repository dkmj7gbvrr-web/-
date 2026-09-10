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

/** 保留球の色による期待度演出 (先読み)。実際の結果と完全には一致しない (ガセ・隠れ大当たりあり)。 */
export type TellTier = 'white' | 'blue' | 'green' | 'red' | 'rainbow'

/** リーチ演出の格。ノーマル/スーパー/プレミアと格が上がるほど大当たり期待度が高い。 */
export type ReachTier = 'none' | 'normal' | 'super' | 'premium'

/** 始動口に入賞した瞬間に確定する抽選結果一式。保留中でも変わらない。 */
export interface StartOutcome {
  isJackpot: boolean
  result: [ReelSymbol, ReelSymbol, ReelSymbol]
  reachTier: ReachTier
  tell: TellTier
  /** 大当たり時のみ意味を持つ (ハズレ時は 'normal' / 0 が入る) */
  nextMode: GameMode
  totalRounds: number
}

/** 保留 (まだ変動を開始していない始動口入賞)。先読み演出用に tell 色を保持する。 */
export interface HoldEntry extends StartOutcome {
  id: number
}

export interface ReelState {
  spinning: boolean
  /** 停止済みのリール数 (0-3)。左→右→中の順に停止する。 */
  stoppedCount: number
  elapsedMs: number
  durationMs: number
  /** 現在変動中の抽選結果。変動していない間は null。 */
  outcome: StartOutcome | null
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
  /** 保留 (最大 MAX_HOLDS 個)。先頭が次に変動を始める保留。 */
  holds: HoldEntry[]
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
