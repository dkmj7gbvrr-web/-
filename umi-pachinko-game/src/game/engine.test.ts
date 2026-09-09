import { describe, expect, it } from 'vitest'
import {
  ATTACKER_BALL_PAYOUT,
  ATTACKER_OPEN_MS,
  BONUS_FINISHED_MS,
  BONUS_OPENING_MS,
  createInitialState,
  PRIZE_POCKET_PAYOUT,
  reduce,
  ROUND_INTERVAL_MS,
  STARTING_BALL_COUNT,
} from './engine'
import { queueRng } from './testUtils'

describe('LAUNCH', () => {
  it('発射すると持ち球が1減る', () => {
    const state = createInitialState()
    const next = reduce(state, { type: 'LAUNCH' }, () => 0)
    expect(next.stats.ballCount).toBe(STARTING_BALL_COUNT - 1)
    expect(next.stats.totalLaunched).toBe(1)
  })

  it('持ち球が0のときは発射できない', () => {
    const state = { ...createInitialState(), stats: { ...createInitialState().stats, ballCount: 0 } }
    const next = reduce(state, { type: 'LAUNCH' }, () => 0)
    expect(next.stats.ballCount).toBe(0)
    expect(next.stats.totalLaunched).toBe(0)
  })
})

describe('BALL_ENTERED_PRIZE', () => {
  it('一般入賞口は玉数が払い出し分だけ増える', () => {
    const state = createInitialState()
    const next = reduce(state, { type: 'BALL_ENTERED_PRIZE' }, () => 0)
    expect(next.stats.ballCount).toBe(STARTING_BALL_COUNT + PRIZE_POCKET_PAYOUT)
  })
})

describe('大当たりからラウンド消化・確変突入までの一連の流れ', () => {
  it('始動口→リール停止→3ラウンド消化→確変モード突入まで一貫して処理できる', () => {
    let state = createInitialState()

    // 始動口に入賞: 当選 (1回目のrng) / 図柄7=奇数=確変 (2回目) / ラウンド数=3 (3回目)
    state = reduce(state, { type: 'BALL_ENTERED_START' }, queueRng([0, 0.75, 0.999]))
    expect(state.reel.spinning).toBe(true)
    expect(state.reel.isJackpot).toBe(true)
    expect(state.pendingBonus).toEqual({ totalRounds: 3, nextMode: 'kakuhen' })

    // リール演出が終わるまで進める
    state = reduce(state, { type: 'TICK', dtMs: 2600 }, () => 0)
    expect(state.reel.spinning).toBe(false)
    expect(state.bonus.phase).toBe('opening')
    expect(state.bonus.totalRounds).toBe(3)
    expect(state.stats.totalJackpots).toBe(1)

    // オープニング演出 → 1ラウンド目のアタッカーが開く
    state = reduce(state, { type: 'TICK', dtMs: BONUS_OPENING_MS }, () => 0)
    expect(state.bonus.phase).toBe('attackerOpen')
    expect(state.bonus.roundIndex).toBe(1)

    // 1ラウンド目: 3個拾う
    for (let i = 0; i < 3; i++) {
      state = reduce(state, { type: 'BALL_ENTERED_ATTACKER' }, () => 0)
    }
    expect(state.bonus.capturedThisRound).toBe(3)

    // ラウンド終了 → インターバル → 2ラウンド目開始
    state = reduce(state, { type: 'TICK', dtMs: ATTACKER_OPEN_MS }, () => 0)
    expect(state.bonus.phase).toBe('roundInterval')
    state = reduce(state, { type: 'TICK', dtMs: ROUND_INTERVAL_MS }, () => 0)
    expect(state.bonus.phase).toBe('attackerOpen')
    expect(state.bonus.roundIndex).toBe(2)
    expect(state.bonus.capturedThisRound).toBe(0)

    // 2ラウンド目: 2個拾う
    for (let i = 0; i < 2; i++) {
      state = reduce(state, { type: 'BALL_ENTERED_ATTACKER' }, () => 0)
    }
    state = reduce(state, { type: 'TICK', dtMs: ATTACKER_OPEN_MS }, () => 0)
    state = reduce(state, { type: 'TICK', dtMs: ROUND_INTERVAL_MS }, () => 0)
    expect(state.bonus.roundIndex).toBe(3)

    // 3ラウンド目 (最終ラウンド): 1個拾って終了
    state = reduce(state, { type: 'BALL_ENTERED_ATTACKER' }, () => 0)
    state = reduce(state, { type: 'TICK', dtMs: ATTACKER_OPEN_MS }, () => 0)
    expect(state.bonus.phase).toBe('finished')

    state = reduce(state, { type: 'TICK', dtMs: BONUS_FINISHED_MS }, () => 0)
    expect(state.bonus.phase).toBe('idle')
    expect(state.mode).toBe('kakuhen')
    expect(state.timeShortRemaining).toBe(Number.POSITIVE_INFINITY)
    expect(state.stats.kakuhenChain).toBe(1)

    const capturedBalls = 3 + 2 + 1
    expect(state.stats.ballCount).toBe(STARTING_BALL_COUNT + capturedBalls * ATTACKER_BALL_PAYOUT)
  })

  it('ハズレの場合はラウンドに入らず通常モードのまま', () => {
    let state = createInitialState()
    // isJackpot判定: 0.99 (>= 1/99 なのでハズレ), その後ハズレ図柄用に2値消費
    state = reduce(state, { type: 'BALL_ENTERED_START' }, queueRng([0.99, 0.1, 0.5]))
    expect(state.reel.isJackpot).toBe(false)
    state = reduce(state, { type: 'TICK', dtMs: 2600 }, () => 0)
    expect(state.bonus.phase).toBe('idle')
    expect(state.mode).toBe('normal')
  })
})

describe('BALL_ENTERED_ATTACKER', () => {
  it('大当たり中でなければ玉は払い出されない', () => {
    const state = createInitialState()
    const next = reduce(state, { type: 'BALL_ENTERED_ATTACKER' }, () => 0)
    expect(next.stats.ballCount).toBe(STARTING_BALL_COUNT)
  })
})
