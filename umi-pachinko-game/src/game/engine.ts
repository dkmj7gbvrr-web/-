import {
  ODDS,
  TIME_SHORT_STARTS_ON_NORMAL_WIN,
  drawJackpotSymbol,
  drawRoundCount,
  isJackpot,
  isKakuhenSymbol,
} from './odds'
import type { BonusState, GameMode, GameState, ReelState, ReelSymbol, Rng } from './types'

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
    result: null,
    isJackpot: false,
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
    pendingBonus: null,
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
  // 大当たり中・抽選中は始動口に入っても新しい抽選は始まらない (実機同様、保留は無いシンプル仕様)
  if (isBonusActive(state) || state.reel.spinning) return state

  const totalStarts = state.stats.totalStarts + 1
  let timeShortRemaining = state.timeShortRemaining
  let timeShortJustEnded = false
  if (Number.isFinite(timeShortRemaining) && timeShortRemaining > 0) {
    timeShortRemaining -= 1
    if (timeShortRemaining === 0) timeShortJustEnded = true
  }

  const won = isJackpot(state.mode, rng)
  let pendingBonus: GameState['pendingBonus'] = null
  let result: ReelState['result']

  if (won) {
    const symbol = drawJackpotSymbol(rng) as ReelSymbol
    const nextMode: GameMode = isKakuhenSymbol(symbol) ? 'kakuhen' : 'normal'
    const totalRounds = drawRoundCount(rng)
    pendingBonus = { totalRounds, nextMode }
    result = [symbol, symbol, symbol]
  } else {
    // ハズレ図柄: 3つ揃わないよう先頭2つと異なる値を選ぶ
    const a = Math.floor(rng() * 10) as ReelSymbol
    let b = Math.floor(rng() * 10) as ReelSymbol
    if (b === a) b = ((b + 1) % 10) as ReelSymbol
    let c = Math.floor(rng() * 10) as ReelSymbol
    if (c === a) c = ((c + 5) % 10) as ReelSymbol
    result = [a, b, c]
  }

  const durationMs = Number.isFinite(state.timeShortRemaining) && state.timeShortRemaining > 0
    ? REEL_SPIN_TIME_SHORT_MS
    : REEL_SPIN_NORMAL_MS

  let nextState: GameState = {
    ...state,
    timeShortRemaining,
    pendingBonus,
    stats: { ...state.stats, totalStarts },
    reel: {
      spinning: true,
      stoppedCount: 0,
      elapsedMs: 0,
      durationMs,
      result,
      isJackpot: won,
    },
  }

  nextState = pushLog(nextState, `始動口に入賞 (通算 ${totalStarts} 回転)`)
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
  if (!state.reel.spinning) return state
  const elapsedMs = state.reel.elapsedMs + dtMs
  const duration = state.reel.durationMs
  const stopThresholds = [duration * 0.4, duration * 0.7, duration]
  const stoppedCount = stopThresholds.filter((t) => elapsedMs >= t).length

  if (elapsedMs < duration) {
    return { ...state, reel: { ...state.reel, elapsedMs, stoppedCount } }
  }

  // 演出終了。結果を確定する。
  const won = state.reel.isJackpot
  let nextState: GameState = {
    ...state,
    reel: { ...state.reel, elapsedMs, stoppedCount: 3, spinning: false },
  }

  if (won && state.pendingBonus) {
    const { totalRounds, nextMode } = state.pendingBonus
    nextState = {
      ...nextState,
      pendingBonus: null,
      stats: { ...nextState.stats, totalJackpots: nextState.stats.totalJackpots + 1 },
      bonus: {
        phase: 'opening',
        roundIndex: 1,
        totalRounds,
        capturedThisRound: 0,
        capturedTotal: 0,
        phaseElapsedMs: 0,
        nextMode,
      },
    }
    nextState = pushLog(
      nextState,
      `大当たり！ ${totalRounds}ラウンド (${nextMode === 'kakuhen' ? '確率変動' : '通常'})`,
    )
  } else if (!state.reel.result || state.reel.result[0] !== state.reel.result[1]) {
    nextState = pushLog(nextState, 'ハズレ')
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
