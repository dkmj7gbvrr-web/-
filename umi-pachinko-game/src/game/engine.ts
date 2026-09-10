import { MAX_HOLDS, ODDS, TIME_SHORT_STARTS_ON_NORMAL_WIN, rollStartOutcome } from './odds'
import type { BonusState, GameState, HoldEntry, ReachTier, ReelState, Rng, StartOutcome } from './types'

export const STARTING_BALL_COUNT = 500
export const PRIZE_POCKET_PAYOUT = 4
export const ATTACKER_BALL_PAYOUT = 15
export const ATTACKER_CAPTURE_LIMIT = 10
export const ATTACKER_OPEN_MS = 29500
export const ROUND_INTERVAL_MS = 1500
export const BONUS_OPENING_MS = 1600
export const BONUS_FINISHED_MS = 1600
export const REEL_SPIN_NORMAL_MS = 2600
export const REEL_SPIN_TIME_SHORT_MS = 900

/** リーチ演出の格による変動時間の延長。格が上がるほど「待たされる」実感を強める。 */
export const REACH_EXTENSION_MS: Record<ReachTier, number> = {
  none: 0,
  normal: 900,
  super: 1900,
  premium: 3200,
}

const MAX_LOG_LENGTH = 30

export type GameAction =
  | { type: 'LAUNCH' }
  | { type: 'BALL_ENTERED_START' }
  | { type: 'BALL_ENTERED_PRIZE' }
  | { type: 'BALL_ENTERED_ATTACKER' }
  | { type: 'TICK'; dtMs: number }

function pushLog(state: GameState, message: string): GameState {
  const log = [...state.log, message]
  if (log.length > MAX_LOG_LENGTH) log.shift()
  return { ...state, log }
}

export function createInitialReel(): ReelState {
  return {
    spinning: false,
    stoppedCount: 0,
    elapsedMs: 0,
    durationMs: REEL_SPIN_NORMAL_MS,
    outcome: null,
  }
}

export function createInitialBonus(): BonusState {
  return {
    phase: 'idle',
    roundIndex: 0,
    totalRounds: 0,
    capturedThisRound: 0,
    capturedTotal: 0,
    phaseElapsedMs: 0,
    nextMode: 'normal',
  }
}

export function createInitialState(): GameState {
  return {
    mode: 'normal',
    timeShortRemaining: 0,
    reel: createInitialReel(),
    bonus: createInitialBonus(),
    holds: [],
    stats: {
      ballCount: STARTING_BALL_COUNT,
      totalLaunched: 0,
      totalStarts: 0,
      totalJackpots: 0,
      kakuhenChain: 0,
    },
    log: ['ゲームを開始しました。持ち球 ' + STARTING_BALL_COUNT + ' 玉。'],
  }
}

function isBonusActive(state: GameState): boolean {
  return state.bonus.phase !== 'idle' && state.bonus.phase !== 'finished'
}

/** 時短中・確変中 (timeShortRemaining は Infinity) のどちらでも変動を速くする。 */
function hasSpeedBoost(timeShortRemaining: number): boolean {
  return timeShortRemaining > 0
}

function startSpin(outcome: StartOutcome, timeShortActive: boolean): ReelState {
  const baseDuration = timeShortActive ? REEL_SPIN_TIME_SHORT_MS : REEL_SPIN_NORMAL_MS
  return {
    spinning: true,
    stoppedCount: 0,
    elapsedMs: 0,
    durationMs: baseDuration + REACH_EXTENSION_MS[outcome.reachTier],
    outcome,
  }
}

/** 保留の先頭を取り出して次の変動を始める。保留が無ければ何もしない (リール停止のまま)。 */
function shiftHoldIntoSpin(state: GameState): GameState {
  if (state.holds.length === 0) return state
  const [next, ...rest] = state.holds
  const timeShortActive = hasSpeedBoost(state.timeShortRemaining)
  const nextState: GameState = {
    ...state,
    holds: rest,
    reel: startSpin(next, timeShortActive),
  }
  return pushLog(nextState, `保留を消化して変動開始 (残り保留 ${rest.length})`)
}

function reduceLaunch(state: GameState): GameState {
  if (state.stats.ballCount <= 0) return state
  return {
    ...state,
    stats: {
      ...state.stats,
      ballCount: state.stats.ballCount - 1,
      totalLaunched: state.stats.totalLaunched + 1,
    },
  }
}

function reduceBallEnteredStart(state: GameState, rng: Rng): GameState {
  // 大当たり中は電動チューリップが閉じるため入賞しない (実機同様、物理層でも玉を素通りさせている)
  if (isBonusActive(state)) return state

  const totalStarts = state.stats.totalStarts + 1
  const timeShortActiveBeforeThisStart = hasSpeedBoost(state.timeShortRemaining)

  let timeShortRemaining = state.timeShortRemaining
  let timeShortJustEnded = false
  if (Number.isFinite(timeShortRemaining) && timeShortRemaining > 0) {
    timeShortRemaining -= 1
    if (timeShortRemaining === 0) timeShortJustEnded = true
  }

  const outcome = rollStartOutcome(state.mode, rng)

  let nextState: GameState = {
    ...state,
    timeShortRemaining,
    stats: { ...state.stats, totalStarts },
  }

  if (state.reel.spinning) {
    if (nextState.holds.length < MAX_HOLDS) {
      const hold: HoldEntry = { id: totalStarts, ...outcome }
      nextState = { ...nextState, holds: [...nextState.holds, hold] }
      nextState = pushLog(nextState, `始動口に入賞 (保留 ${nextState.holds.length}/${MAX_HOLDS})`)
    } else {
      nextState = pushLog(nextState, '保留がいっぱいのため、抽選されずに玉が落ちました。')
    }
  } else {
    nextState = { ...nextState, reel: startSpin(outcome, timeShortActiveBeforeThisStart) }
    nextState = pushLog(nextState, `始動口に入賞 (通算 ${totalStarts} 回転)`)
  }

  if (timeShortJustEnded) {
    nextState = pushLog(nextState, '時短が終了し、通常の抽選確率に戻りました。')
  }
  return nextState
}

function reduceBallEnteredPrize(state: GameState): GameState {
  return {
    ...state,
    stats: {
      ...state.stats,
      ballCount: state.stats.ballCount + PRIZE_POCKET_PAYOUT,
    },
  }
}

function reduceBallEnteredAttacker(state: GameState): GameState {
  if (state.bonus.phase !== 'attackerOpen') return state
  if (state.bonus.capturedThisRound >= ATTACKER_CAPTURE_LIMIT) return state

  return {
    ...state,
    stats: {
      ...state.stats,
      ballCount: state.stats.ballCount + ATTACKER_BALL_PAYOUT,
    },
    bonus: {
      ...state.bonus,
      capturedThisRound: state.bonus.capturedThisRound + 1,
      capturedTotal: state.bonus.capturedTotal + 1,
    },
  }
}

function tickReel(state: GameState, dtMs: number): GameState {
  if (!state.reel.spinning || !state.reel.outcome) return state
  const elapsedMs = state.reel.elapsedMs + dtMs
  const duration = state.reel.durationMs
  const stopThresholds = [duration * 0.4, duration * 0.7, duration]
  const stoppedCount = stopThresholds.filter((t) => elapsedMs >= t).length

  if (elapsedMs < duration) {
    return { ...state, reel: { ...state.reel, elapsedMs, stoppedCount } }
  }

  // 演出終了。結果を確定する。
  const outcome = state.reel.outcome
  let nextState: GameState = {
    ...state,
    reel: { ...state.reel, elapsedMs, stoppedCount: 3, spinning: false },
  }

  if (outcome.isJackpot) {
    nextState = {
      ...nextState,
      stats: { ...nextState.stats, totalJackpots: nextState.stats.totalJackpots + 1 },
      bonus: {
        phase: 'opening',
        roundIndex: 1,
        totalRounds: outcome.totalRounds,
        capturedThisRound: 0,
        capturedTotal: 0,
        phaseElapsedMs: 0,
        nextMode: outcome.nextMode,
      },
    }
    nextState = pushLog(
      nextState,
      `大当たり！ ${outcome.totalRounds}ラウンド (${outcome.nextMode === 'kakuhen' ? '確率変動' : '通常'})`,
    )
    // 大当たり中は保留を消化しない (ラウンド終了後に持ち越す)
  } else {
    nextState = pushLog(nextState, outcome.reachTier !== 'none' ? 'リーチ外れ' : 'ハズレ')
    nextState = shiftHoldIntoSpin(nextState)
  }

  return nextState
}

function tickBonus(state: GameState, dtMs: number): GameState {
  const bonus = state.bonus
  if (bonus.phase === 'idle') return state

  const phaseElapsedMs = bonus.phaseElapsedMs + dtMs

  if (bonus.phase === 'finished') {
    return { ...state, bonus: { ...bonus, phaseElapsedMs } }
  }

  if (bonus.phase === 'opening') {
    if (phaseElapsedMs >= BONUS_OPENING_MS) {
      return {
        ...state,
        bonus: { ...bonus, phase: 'attackerOpen', phaseElapsedMs: 0 },
      }
    }
    return { ...state, bonus: { ...bonus, phaseElapsedMs } }
  }

  if (bonus.phase === 'attackerOpen') {
    const shouldClose =
      phaseElapsedMs >= ATTACKER_OPEN_MS || bonus.capturedThisRound >= ATTACKER_CAPTURE_LIMIT
    if (shouldClose) {
      const isLastRound = bonus.roundIndex >= bonus.totalRounds
      if (isLastRound) {
        return {
          ...state,
          bonus: { ...bonus, phase: 'finished', phaseElapsedMs: 0 },
        }
      }
      return {
        ...state,
        bonus: { ...bonus, phase: 'roundInterval', phaseElapsedMs: 0 },
      }
    }
    return { ...state, bonus: { ...bonus, phaseElapsedMs } }
  }

  if (bonus.phase === 'roundInterval') {
    if (phaseElapsedMs >= ROUND_INTERVAL_MS) {
      return {
        ...state,
        bonus: {
          ...bonus,
          phase: 'attackerOpen',
          roundIndex: bonus.roundIndex + 1,
          capturedThisRound: 0,
          phaseElapsedMs: 0,
        },
      }
    }
    return { ...state, bonus: { ...bonus, phaseElapsedMs } }
  }

  return state
}

function finalizeBonusIfDone(state: GameState): GameState {
  if (state.bonus.phase !== 'finished') return state
  if (state.bonus.phaseElapsedMs < BONUS_FINISHED_MS) return state

  const nextMode = state.bonus.nextMode
  const timeShortRemaining: number =
    nextMode === 'kakuhen' ? Number.POSITIVE_INFINITY : TIME_SHORT_STARTS_ON_NORMAL_WIN
  const kakuhenChain =
    nextMode === 'kakuhen' ? state.stats.kakuhenChain + 1 : 0

  let nextState: GameState = {
    ...state,
    mode: nextMode,
    timeShortRemaining,
    bonus: createInitialBonus(),
    stats: { ...state.stats, kakuhenChain },
  }
  nextState = pushLog(
    nextState,
    nextMode === 'kakuhen'
      ? `確率変動突入 (連チャン ${kakuhenChain} 回目) 次回まで確率アップ！`
      : `時短突入 (残り ${TIME_SHORT_STARTS_ON_NORMAL_WIN} 回転)`,
  )
  // ラウンド中に貯まった保留があれば、営業再開と同時に消化を始める
  nextState = shiftHoldIntoSpin(nextState)
  return nextState
}

export function reduce(state: GameState, action: GameAction, rng: Rng): GameState {
  switch (action.type) {
    case 'LAUNCH':
      return reduceLaunch(state)
    case 'BALL_ENTERED_START':
      return reduceBallEnteredStart(state, rng)
    case 'BALL_ENTERED_PRIZE':
      return reduceBallEnteredPrize(state)
    case 'BALL_ENTERED_ATTACKER':
      return reduceBallEnteredAttacker(state)
    case 'TICK': {
      // リール停止でボーナスが新規開始した場合、その分の dt を二重に消費しないよう
      // 「このtickの開始時点で既にボーナス中だったか」で tickBonus の適用有無を分ける
      const wasBonusActiveBeforeTick = state.bonus.phase !== 'idle'
      let next = tickReel(state, action.dtMs)
      if (wasBonusActiveBeforeTick) {
        next = tickBonus(next, action.dtMs)
      }
      next = finalizeBonusIfDone(next)
      return next
    }
    default:
      return state
  }
}

export const ODDS_FOR_DISPLAY = ODDS
