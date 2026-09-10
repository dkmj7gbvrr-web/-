import { describe, expect, it } from 'vitest'
import {
  ATTACKER_BALL_PAYOUT,
  ATTACKER_OPEN_MS,
  BONUS_FINISHED_MS,
  BONUS_OPENING_MS,
  createInitialState,
  PRIZE_POCKET_PAYOUT,
  REACH_EXTENSION_MS,
  reduce,
  REEL_SPIN_NORMAL_MS,
  REEL_SPIN_TIME_SHORT_MS,
  ROUND_INTERVAL_MS,
  STARTING_BALL_COUNT,
} from './engine'
import { MAX_HOLDS } from './odds'
import { queueRng } from './testUtils'

// 当選: isJackpot(win) / symbol=7(奇数=確変) / rounds=3 / reachTier=normal / tell=green
const WIN_KAKUHEN_3R_RNG = () => queueRng([0, 0.75, 0.999, 0.9, 0.5])
const WIN_DURATION = REEL_SPIN_NORMAL_MS + REACH_EXTENSION_MS.normal

// ハズレ・リーチなし: isJackpot(miss) / hasReach(false) / a,b,c / tell
const MISS_NO_REACH_RNG = () => queueRng([0.99, 0.99, 0.1, 0.5, 0.9, 0.5])
const MISS_DURATION = REEL_SPIN_NORMAL_MS + REACH_EXTENSION_MS.none

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

    state = reduce(state, { type: 'BALL_ENTERED_START' }, WIN_KAKUHEN_3R_RNG())
    expect(state.reel.spinning).toBe(true)
    expect(state.reel.outcome?.isJackpot).toBe(true)
    expect(state.reel.outcome?.totalRounds).toBe(3)
    expect(state.reel.outcome?.nextMode).toBe('kakuhen')
    expect(state.reel.durationMs).toBe(WIN_DURATION)

    // リール演出が終わるまで進める
    state = reduce(state, { type: 'TICK', dtMs: WIN_DURATION }, () => 0)
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
    state = reduce(state, { type: 'BALL_ENTERED_START' }, MISS_NO_REACH_RNG())
    expect(state.reel.outcome?.isJackpot).toBe(false)
    state = reduce(state, { type: 'TICK', dtMs: MISS_DURATION }, () => 0)
    expect(state.bonus.phase).toBe('idle')
    expect(state.mode).toBe('normal')
  })
})

describe('保留 (先読み用のホールドキュー)', () => {
  it('変動中に始動口へ入ると保留として積まれ、ラウンド数などは即座に確定している', () => {
    let state = createInitialState()
    state = reduce(state, { type: 'BALL_ENTERED_START' }, WIN_KAKUHEN_3R_RNG())
    expect(state.holds).toHaveLength(0)

    state = reduce(state, { type: 'BALL_ENTERED_START' }, MISS_NO_REACH_RNG())
    expect(state.holds).toHaveLength(1)
    // 保留の時点で結果 (ハズレ) はすでに確定している
    expect(state.holds[0].isJackpot).toBe(false)
    // 変動中の1つ目はまだ結果発表前のまま
    expect(state.reel.outcome?.isJackpot).toBe(true)
  })

  it('保留は最大4個までで、それ以上は弾かれる', () => {
    let state = createInitialState()
    state = reduce(state, { type: 'BALL_ENTERED_START' }, WIN_KAKUHEN_3R_RNG())

    for (let i = 0; i < MAX_HOLDS + 2; i++) {
      state = reduce(state, { type: 'BALL_ENTERED_START' }, MISS_NO_REACH_RNG())
    }

    expect(state.holds).toHaveLength(MAX_HOLDS)
    expect(state.log.at(-1)).toContain('保留がいっぱい')
  })

  it('変動が終わると保留の先頭が自動的に次の変動として消化される', () => {
    let state = createInitialState()
    state = reduce(state, { type: 'BALL_ENTERED_START' }, WIN_KAKUHEN_3R_RNG())
    state = reduce(state, { type: 'BALL_ENTERED_START' }, MISS_NO_REACH_RNG())
    expect(state.holds).toHaveLength(1)

    state = reduce(state, { type: 'TICK', dtMs: WIN_DURATION }, () => 0)
    // 大当たり中は保留を消化しない
    expect(state.holds).toHaveLength(1)
    expect(state.bonus.phase).toBe('opening')
  })

  it('大当たり中に貯まった保留は、ラウンド終了後に消化が再開される', () => {
    let state = createInitialState()
    state = reduce(state, { type: 'BALL_ENTERED_START' }, WIN_KAKUHEN_3R_RNG())
    state = reduce(state, { type: 'BALL_ENTERED_START' }, MISS_NO_REACH_RNG())
    state = reduce(state, { type: 'BALL_ENTERED_START' }, MISS_NO_REACH_RNG())
    expect(state.holds).toHaveLength(2)

    state = reduce(state, { type: 'TICK', dtMs: WIN_DURATION }, () => 0)
    expect(state.bonus.phase).toBe('opening')

    state = reduce(state, { type: 'TICK', dtMs: BONUS_OPENING_MS }, () => 0)
    for (let round = 0; round < 3; round++) {
      state = reduce(state, { type: 'TICK', dtMs: ATTACKER_OPEN_MS }, () => 0)
      if (state.bonus.phase === 'roundInterval') {
        state = reduce(state, { type: 'TICK', dtMs: ROUND_INTERVAL_MS }, () => 0)
      }
    }
    expect(state.bonus.phase).toBe('finished')
    expect(state.holds).toHaveLength(2) // ラウンド中は保留に触れない

    state = reduce(state, { type: 'TICK', dtMs: BONUS_FINISHED_MS }, () => 0)
    expect(state.bonus.phase).toBe('idle')
    expect(state.mode).toBe('kakuhen')
    // ラウンド終了と同時に保留の先頭を消化し、次の変動が始まる
    expect(state.holds).toHaveLength(1)
    expect(state.reel.spinning).toBe(true)
    expect(state.reel.outcome?.isJackpot).toBe(false)
    // 確変中なので時短用の短い変動時間になっている
    expect(state.reel.durationMs).toBe(REEL_SPIN_TIME_SHORT_MS + REACH_EXTENSION_MS.none)
  })
})

describe('リーチ演出', () => {
  it('リーチになったハズレは、前後2つの図柄が揃い、変動時間も延長される', () => {
    // isJackpot(miss) / hasReach(true) / a / c / reachTier(super) / tell
    const state = reduce(
      createInitialState(),
      { type: 'BALL_ENTERED_START' },
      queueRng([0.99, 0, 0.3, 0.3, 0.1, 0.5]),
    )
    expect(state.reel.outcome?.isJackpot).toBe(false)
    expect(state.reel.outcome?.reachTier).toBe('super')
    expect(state.reel.outcome?.result[0]).toBe(state.reel.outcome?.result[1])
    expect(state.reel.durationMs).toBe(REEL_SPIN_NORMAL_MS + REACH_EXTENSION_MS.super)
  })
})

describe('BALL_ENTERED_ATTACKER', () => {
  it('大当たり中でなければ玉は払い出されない', () => {
    const state = createInitialState()
    const next = reduce(state, { type: 'BALL_ENTERED_ATTACKER' }, () => 0)
    expect(next.stats.ballCount).toBe(STARTING_BALL_COUNT)
  })
})
