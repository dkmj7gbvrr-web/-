import { useCallback, useEffect, useRef, useState } from 'react'
import { buildPins, buildPockets } from '../game/board'
import { createInitialState, reduce, type GameAction } from '../game/engine'
import {
  circlesOverlap,
  createLaunchedBall,
  integrate,
  resolvePinCollision,
  resolveWallCollision,
  stepLaunchLane,
} from '../game/physics'
import * as sound from '../game/sound'
import type { Ball, GameState, Pocket } from '../game/types'
import { BALL_RADIUS, PLAYFIELD_HEIGHT } from '../game/types'

const AUTO_FIRE_INTERVAL_MS = 550
const ENGINE_TICK_MS = 50

function handlePocketHit(ball: Ball, pocket: Pocket, bonusPhase: string): 'consumed' | 'ignored' {
  if (!circlesOverlap(ball.pos, BALL_RADIUS, pocket.pos, pocket.radius)) return 'ignored'
  const bonusActive = bonusPhase !== 'idle' && bonusPhase !== 'finished'
  if (pocket.kind === 'attacker' && bonusPhase !== 'attackerOpen') return 'ignored'
  // 大当たり中は始動口の電動チューリップが閉じるため、玉はそのまま下のアタッカーへ抜ける
  if (pocket.kind === 'start' && bonusActive) return 'ignored'
  return 'consumed'
}

export function usePachinkoGame() {
  const [state, setState] = useState<GameState>(() => createInitialState())
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const [power, setPower] = useState(85)
  const powerRef = useRef(power)
  useEffect(() => {
    powerRef.current = power
  }, [power])

  const [autoFire, setAutoFire] = useState(false)
  const [muted, setMutedState] = useState(false)

  const ballsRef = useRef<Ball[]>([])
  const nextBallId = useRef(1)
  const pinsRef = useRef(buildPins())
  const pocketsRef = useRef(buildPockets())

  const dispatch = useCallback((action: GameAction) => {
    setState((prev) => reduce(prev, action, Math.random))
  }, [])

  const launch = useCallback(() => {
    if (stateRef.current.stats.ballCount <= 0) return
    dispatch({ type: 'LAUNCH' })
    ballsRef.current = [
      ...ballsRef.current,
      createLaunchedBall(nextBallId.current++, powerRef.current),
    ]
    sound.playLaunch()
  }, [dispatch])

  const refill = useCallback(() => {
    setState((prev) => ({
      ...prev,
      stats: { ...prev.stats, ballCount: prev.stats.ballCount + 500 },
      log: [...prev.log, '持ち球を500玉補充しました。'].slice(-30),
    }))
  }, [])

  const toggleMuted = useCallback(() => {
    setMutedState((prev) => {
      sound.setMuted(!prev)
      return !prev
    })
  }, [])

  // 物理シミュレーションループ (60fps 目安)。ゲーム状態への反映はイベント発生時のみ dispatch する。
  useEffect(() => {
    let rafId = 0
    let last = performance.now()

    const frame = (now: number) => {
      const dtSeconds = Math.min((now - last) / 1000, 1 / 30)
      last = now

      const bonusPhase = stateRef.current.bonus.phase
      const nextBalls: Ball[] = []

      for (const ball of ballsRef.current) {
        if (ball.inLaunchLane) {
          const laneResult = stepLaunchLane(ball, dtSeconds, Math.random)
          if (laneResult.kind === 'inLane') {
            nextBalls.push(laneResult.ball)
          } else if (laneResult.kind === 'enteredField') {
            nextBalls.push(laneResult.ball)
          } else {
            sound.playFoul()
          }
          continue
        }

        let moving = integrate(ball, dtSeconds)
        for (const pin of pinsRef.current) {
          const collided = resolvePinCollision(moving, pin, Math.random)
          if (collided) {
            moving = collided
            break
          }
        }
        moving = resolveWallCollision(moving)

        if (moving.pos.y > PLAYFIELD_HEIGHT + 20) {
          continue // 盤外へ落下 (アウト)
        }

        let consumed = false
        for (const pocket of pocketsRef.current) {
          const result = handlePocketHit(moving, pocket, bonusPhase)
          if (result === 'consumed') {
            consumed = true
            if (pocket.kind === 'start') {
              dispatch({ type: 'BALL_ENTERED_START' })
              sound.playChucker()
            } else if (pocket.kind === 'prize') {
              dispatch({ type: 'BALL_ENTERED_PRIZE' })
              sound.playPrize()
            } else if (pocket.kind === 'attacker') {
              dispatch({ type: 'BALL_ENTERED_ATTACKER' })
              sound.playAttackerHit()
            }
            // 'out' はダイレクトに消えるだけ
            break
          }
        }

        if (!consumed) {
          nextBalls.push(moving)
        }
      }

      ballsRef.current = nextBalls
      rafId = requestAnimationFrame(frame)
    }

    rafId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafId)
  }, [dispatch])

  // ゲームエンジンのタイマー (リール演出・大当たりラウンド進行) を一定間隔で進める
  useEffect(() => {
    const id = setInterval(() => {
      dispatch({ type: 'TICK', dtMs: ENGINE_TICK_MS })
    }, ENGINE_TICK_MS)
    return () => clearInterval(id)
  }, [dispatch])

  // 大当たり演出開始時にファンファーレを鳴らす
  const prevBonusPhase = useRef(state.bonus.phase)
  useEffect(() => {
    if (prevBonusPhase.current === 'idle' && state.bonus.phase === 'opening') {
      sound.playJackpotFanfare()
    }
    prevBonusPhase.current = state.bonus.phase
  }, [state.bonus.phase])

  // 保留が新しく積まれたらチャイムを鳴らす
  const prevHoldCount = useRef(state.holds.length)
  useEffect(() => {
    if (state.holds.length > prevHoldCount.current) {
      sound.playHoldChime()
    }
    prevHoldCount.current = state.holds.length
  }, [state.holds.length])

  // リーチ (前後2つの図柄が揃った瞬間) に煽り音を鳴らす
  const prevStoppedCount = useRef(state.reel.stoppedCount)
  useEffect(() => {
    const outcome = state.reel.outcome
    const justReachedReach =
      state.reel.spinning &&
      prevStoppedCount.current < 2 &&
      state.reel.stoppedCount >= 2 &&
      !!outcome &&
      outcome.reachTier !== 'none'
    if (justReachedReach && outcome) {
      sound.playReach(outcome.reachTier as 'normal' | 'super' | 'premium')
    }
    prevStoppedCount.current = state.reel.stoppedCount
  }, [state.reel.stoppedCount, state.reel.spinning, state.reel.outcome])

  // ハンドルを握りっぱなし (オート連射) の間、一定間隔で発射する
  useEffect(() => {
    if (!autoFire) return
    const id = setInterval(() => {
      launch()
    }, AUTO_FIRE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [autoFire, launch])

  return {
    state,
    stateRef,
    ballsRef,
    pinsRef,
    pocketsRef,
    power,
    setPower,
    autoFire,
    setAutoFire,
    muted,
    toggleMuted,
    launch,
    refill,
  }
}
