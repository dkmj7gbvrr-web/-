import { decideSpin, HOLD_COLORS, SPEC, SYMBOL_COUNT, type HoldColor, type Reach, type SpinOutcome } from './odds'
import { createPegs, reachedBottom, spawnBall, stepBall, W, type Ball, type Peg } from './physics'
import { classifyPocket, type BoardPhase, type PocketKind } from './pockets'
import type { Rng } from './rng'

export type Scene = 'play' | 'jackpotIntro' | 'fever' | 'challenge' | 'rushIntro' | 'rushEnd'

export type GameEvent =
  | { type: 'peg'; peg: Peg; ball: Ball }
  | { type: 'gold'; peg: Peg; split: boolean }
  | { type: 'pocket'; kind: PocketKind; x: number; payout: number }
  | { type: 'holdAdded'; color: HoldColor }
  | { type: 'holdChange'; from: HoldColor; to: HoldColor }
  | { type: 'spinStart'; outcome: SpinOutcome }
  | { type: 'kakutei' }
  | { type: 'reelStop'; reel: number; heavy: boolean }
  | { type: 'reach'; reach: Reach }
  | { type: 'escalate'; reach: Reach }
  | { type: 'pushPrompt' }
  | { type: 'pushed'; win: boolean }
  | { type: 'revival' }
  | { type: 'miss'; reach: Reach }
  | { type: 'jackpot'; outcome: SpinOutcome; chain: number }
  | { type: 'roundStart'; round: number; total: number }
  | { type: 'attackerIn'; x: number; payout: number }
  | { type: 'upgrade'; total: number }
  | { type: 'feverEnd'; payout: number }
  | { type: 'challengeStart' }
  | { type: 'challengeResult'; success: boolean }
  | { type: 'rushStart'; chain: number }
  | { type: 'lastSpin' }
  | { type: 'rushEnd'; chain: number; total: number }
  | { type: 'refill'; amount: number }

export interface Reel {
  /** 図柄位置（整数部 mod 7 が表示中の図柄インデックス） */
  pos: number
  speed: number
  stopping: null | { from: number; to: number; t: number; dur: number }
  stopped: boolean
}

interface TimedAction {
  at: number
  fn: () => void
}

export interface SpinRun {
  outcome: SpinOutcome
  t: number
  actions: TimedAction[]
  waitingPush: boolean
  pushWait: number
  done: boolean
  /** 演出中の格（描画用） */
  stage: 'rolling' | Reach
  escalated: boolean
  /** リーチ中の期待度ゲージ 0〜1（描画用） */
  gauge: number
  gaugeTarget: number
  /** 復活演出のためにハズレ目を見せている */
  fakeMiss: boolean
}

export interface FeverState {
  round: number
  shownRounds: number
  finalRounds: number
  inRound: number
  roundTime: number
  /** ラウンド間インターバル残り秒（>0 のあいだアタッカーは閉じている） */
  interval: number
  payout: number
  spawnTimer: number
  fromMode: 'normal' | 'rush'
  rushEntry: boolean
}

export const FIRE_INTERVAL = 0.14
export const PUSH_AUTO = 4
export const REFILL_AMOUNT = 300
export const START_BALLS = 500
const ROUND_MAX_TIME = 6.5
const ROUND_INTERVAL = 1.1
const FEVER_SPAWN = 1 / 10

export class Game {
  balls = START_BALLS
  scene: Scene = 'play'
  phase: BoardPhase = 'normal'
  pegs: Peg[] = createPegs()
  flying: Ball[] = []
  holds: Array<{ outcome: SpinOutcome; shown: HoldColor }> = []
  spin: SpinRun | null = null
  reels: Reel[] = [0, 1, 2].map((i) => ({ pos: i * 2, speed: 0, stopping: null, stopped: true }))
  rushLeft = 0
  chain = 0
  chainTotal = 0
  fever: FeverState | null = null
  /** 盤面の時計（始動口の往復などに使う） */
  t = 0
  sceneTime = 0
  /** RUSH 突入チャレンジで PUSH 待ちか */
  challengePush = false
  challengeResult: boolean | null = null
  private nextId = 1
  private fireCooldown = 0
  private goldRespawn = 0
  firing = false
  aimX = W / 2
  private readonly rng: Rng
  private readonly emit: (e: GameEvent) => void

  constructor(rng: Rng, emit: (e: GameEvent) => void) {
    this.rng = rng
    this.emit = emit
    for (let i = 0; i < 7; i++) this.addGoldPeg()
  }

  private addGoldPeg() {
    const candidates = this.pegs.filter((p) => !p.gold)
    const p = candidates[Math.floor(this.rng() * candidates.length)]
    if (p) p.gold = true
  }

  get pushPending(): boolean {
    return (this.spin?.waitingPush ?? false) || this.challengePush
  }

  get needsRefill(): boolean {
    return (
      this.balls <= 0 &&
      this.flying.length === 0 &&
      this.scene === 'play' &&
      this.phase === 'normal' &&
      !this.spin &&
      this.holds.length === 0
    )
  }

  refill() {
    if (!this.needsRefill) return
    this.balls += REFILL_AMOUNT
    this.emit({ type: 'refill', amount: REFILL_AMOUNT })
  }

  push() {
    if (this.spin?.waitingPush) {
      this.spin.waitingPush = false
      this.emit({ type: 'pushed', win: this.spin.outcome.win && !this.spin.outcome.revival })
    } else if (this.challengePush) {
      this.challengePush = false
      this.resolveChallenge()
    }
  }

  update(dt: number) {
    this.t += dt
    this.sceneTime += dt
    this.updateBalls(dt)
    this.updateReels(dt)
    for (const p of this.pegs) p.glow = Math.max(0, p.glow - dt)
    this.goldRespawn -= dt
    if (this.goldRespawn <= 0 && this.pegs.filter((p) => p.gold).length < 7) {
      this.addGoldPeg()
      this.goldRespawn = 3
    }

    switch (this.scene) {
      case 'play':
        this.updateFiring(dt)
        this.updateSpin(dt)
        break
      case 'jackpotIntro':
        if (this.sceneTime > 2.6) this.startFever()
        break
      case 'fever':
        this.updateFever(dt)
        break
      case 'challenge':
        if (!this.challengePush && this.challengeResult === null && this.sceneTime > 3.2) {
          this.challengePush = true
          this.emit({ type: 'pushPrompt' })
        }
        if (this.challengePush && this.sceneTime > 3.2 + PUSH_AUTO) this.push()
        if (this.challengeResult !== null && this.sceneTime > 2.2) {
          if (this.challengeResult) this.enterRush()
          else this.backToNormal()
        }
        break
      case 'rushIntro':
        if (this.sceneTime > 1.8) this.setScene('play')
        break
      case 'rushEnd':
        if (this.sceneTime > 3.8) this.backToNormal()
        break
    }
  }

  private setScene(s: Scene) {
    this.scene = s
    this.sceneTime = 0
  }

  // ---------------------------------------------------------------- 玉

  private updateFiring(dt: number) {
    this.fireCooldown -= dt
    if (!this.firing || this.fireCooldown > 0 || this.balls <= 0) return
    this.fireCooldown = FIRE_INTERVAL
    this.balls -= 1
    this.flying.push(spawnBall(this.nextId++, this.aimX, this.rng))
  }

  private updateBalls(dt: number) {
    const sub = 4
    const h = dt / sub
    for (const ball of this.flying) {
      for (let s = 0; s < sub; s++) {
        for (const i of stepBall(ball, this.pegs, h, this.rng)) this.onPegHit(i, ball)
      }
      ball.trail.push({ x: ball.x, y: ball.y })
      if (ball.trail.length > 8) ball.trail.shift()
    }
    const landed = this.flying.filter(reachedBottom)
    if (landed.length === 0) return
    this.flying = this.flying.filter((b) => !reachedBottom(b))
    for (const b of landed) this.onLanded(b)
  }

  private onPegHit(i: number, ball: Ball) {
    const peg = this.pegs[i]
    ball.hits++
    peg.glow = 0.35
    this.emit({ type: 'peg', peg, ball })
    if (peg.gold) {
      peg.gold = false
      this.goldRespawn = 2.5
      this.balls += 1
      const split = this.rng() < 0.08
      this.emit({ type: 'gold', peg, split })
      if (split) {
        for (const dir of [-1, 1]) {
          const nb = spawnBall(this.nextId++, ball.x, this.rng, ball.free)
          nb.y = ball.y
          nb.vx = dir * (120 + this.rng() * 80)
          nb.vy = -120
          nb.hits = ball.hits
          this.flying.push(nb)
        }
      }
    }
  }

  private onLanded(ball: Ball) {
    const res =
      this.phase === 'fever'
        ? this.feverOpen()
          ? classifyPocket(ball.x, 'fever', this.t)
          : { kind: 'out' as const, payout: 0 }
        : classifyPocket(ball.x, this.phase, this.t)
    switch (res.kind) {
      case 'attacker': {
        const f = this.fever!
        if (f.inRound >= SPEC.ballsPerRound) {
          this.emit({ type: 'pocket', kind: 'out', x: ball.x, payout: 0 })
          return
        }
        f.inRound++
        f.payout += SPEC.payoutPerBall
        this.balls += SPEC.payoutPerBall
        this.emit({ type: 'attackerIn', x: ball.x, payout: SPEC.payoutPerBall })
        return
      }
      case 'start': {
        this.balls += SPEC.startPocketPayout
        this.emit({ type: 'pocket', kind: 'start', x: ball.x, payout: SPEC.startPocketPayout })
        if (this.holds.length < SPEC.maxHolds) {
          const mode = this.phase === 'rush' ? 'rush' : 'normal'
          const outcome = decideSpin(mode, this.rng)
          this.holds.push({ outcome, shown: outcome.entryColor })
          this.emit({ type: 'holdAdded', color: outcome.entryColor })
        }
        return
      }
      case 'bonus':
        this.balls += res.payout
        this.emit({ type: 'pocket', kind: 'bonus', x: ball.x, payout: res.payout })
        return
      case 'out':
        this.emit({ type: 'pocket', kind: 'out', x: ball.x, payout: 0 })
    }
  }

  private feverOpen(): boolean {
    return this.phase === 'fever' && this.scene === 'fever' && !!this.fever && this.fever.interval <= 0
  }

  // ---------------------------------------------------------------- リール

  private updateReels(dt: number) {
    for (const r of this.reels) {
      if (r.stopping) {
        const s = r.stopping
        s.t += dt
        const k = Math.min(1, s.t / s.dur)
        // ease-out-back：止まる瞬間に少し行き過ぎて戻る「カチッ」感
        const c = 1.6
        const e = 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2)
        r.pos = s.from + (s.to - s.from) * e
        if (k >= 1) {
          r.pos = s.to
          r.stopping = null
          r.stopped = true
        }
      } else if (!r.stopped) {
        r.pos += r.speed * dt
      }
    }
  }

  private stopReel(i: number, symbol: number, dur: number, minTravel: number, heavy = false) {
    const r = this.reels[i]
    const target = symbol - 1
    let to = Math.ceil(r.pos + minTravel)
    while (((to % SYMBOL_COUNT) + SYMBOL_COUNT) % SYMBOL_COUNT !== target) to++
    r.stopping = { from: r.pos, to, t: 0, dur }
    this.emit({ type: 'reelStop', reel: i, heavy })
  }

  private updateSpin(dt: number) {
    if (!this.spin) {
      if (this.holds.length > 0 && this.phase !== 'fever') this.startNextSpin()
      return
    }
    const sp = this.spin
    if (sp.waitingPush) {
      sp.pushWait += dt
      if (sp.pushWait > PUSH_AUTO) this.push()
      return
    }
    sp.gauge += (sp.gaugeTarget - sp.gauge) * Math.min(1, dt * 2.5)
    sp.t += dt
    while (sp.actions.length > 0 && sp.actions[0].at <= sp.t && !sp.waitingPush) {
      sp.actions.shift()!.fn()
    }
    if (sp.done) this.spin = null
  }

  private startNextSpin() {
    const h = this.holds.shift()!
    let outcome = h.outcome
    const mode = this.phase === 'rush' ? 'rush' : 'normal'
    if (outcome.mode !== mode) outcome = decideSpin(mode, this.rng)
    const fast = mode === 'normal' && this.holds.length >= 3
    let lastSpin = false
    if (mode === 'rush') {
      this.rushLeft--
      lastSpin = this.rushLeft === 0
    }
    for (const r of this.reels) {
      r.stopped = false
      r.stopping = null
      r.speed = 22 + this.rng() * 4
    }
    const sp: SpinRun = {
      outcome,
      t: 0,
      actions: [],
      waitingPush: false,
      pushWait: 0,
      done: false,
      stage: 'rolling',
      escalated: false,
      gauge: 0,
      gaugeTarget: 0,
      fakeMiss: false,
    }
    this.spin = sp
    this.emit({ type: 'spinStart', outcome })
    if (h.shown !== outcome.tell && mode === 'normal') {
      this.emit({ type: 'holdChange', from: h.shown, to: outcome.tell })
    }
    if (lastSpin) this.emit({ type: 'lastSpin' })
    this.buildTimeline(sp, fast, lastSpin)
  }

  private buildTimeline(sp: SpinRun, fast: boolean, lastSpin: boolean) {
    const o = sp.outcome
    const rush = o.mode === 'rush'
    const add = (at: number, fn: () => void) => sp.actions.push({ at, fn })
    const [s0, s1, s2] = o.symbols
    const L = rush ? 0.35 : fast ? 0.45 : 0.9
    const R = rush ? 0.6 : fast ? 0.75 : 1.5
    let reach = o.reach
    // RUSH 最終変動はリーチなしでも PUSH で結果を開ける（最後の1回に緊張を集める）
    if (lastSpin && reach === 'none') reach = 'normal'

    if (o.kakutei) add(0.05, () => this.emit({ type: 'kakutei' }))
    add(L, () => this.stopReel(0, s0, 0.3, 3))

    if (reach === 'none') {
      add(R, () => this.stopReel(2, s2, 0.3, 3))
      const c = R + (rush ? 0.25 : fast ? 0.3 : 0.5)
      add(c, () => this.stopReel(1, s1, 0.3, 3))
      add(c + 0.4, () => this.resolve(sp, reach))
      return
    }

    // リーチ（左右が揃ったまま、中図柄だけがゆっくり回る）
    add(R, () => {
      this.stopReel(2, s2, 0.35, 3, true)
      sp.stage = 'normal'
      sp.gaugeTarget = 0.2
      this.reels[1].speed = 6
      this.emit({ type: 'reach', reach })
    })
    const fakeCenter = ((s1 % SYMBOL_COUNT) + 1) as number // 復活用：1コマ先のハズレ目
    const finalCenter = o.revival ? fakeCenter : s1
    let t = R
    const escalate = (at: number, level: Reach, gauge: number) =>
      add(at, () => {
        sp.stage = level
        sp.escalated = true
        sp.gaugeTarget = gauge
        this.reels[1].speed = level === 'premium' ? 2.2 : 3
        this.emit({ type: 'escalate', reach: level })
      })

    if (reach === 'normal') {
      t += rush ? 1.1 : 2.2
      if (lastSpin) {
        add(t - 0.4, () => {
          sp.gaugeTarget = 0.5
          this.emit({ type: 'pushPrompt' })
          sp.waitingPush = true
        })
      }
      add(t, () => this.stopReel(1, finalCenter, 0.9, 1.6, true))
      t += 1.0
    } else {
      // スーパー / プレミア：格上げ → ゲージ上昇 → PUSH（自分で結果を開ける）
      t += rush ? 0.5 : 1.1
      escalate(t, 'super', 0.45)
      if (reach === 'premium') {
        t += rush ? 0.6 : 1.3
        escalate(t, 'premium', 0.85)
      }
      t += rush ? 1.0 : 2.2
      add(t, () => {
        sp.gaugeTarget = Math.max(sp.gaugeTarget, 0.5)
        sp.waitingPush = true
        this.emit({ type: 'pushPrompt' })
      })
      t += 0.05
      add(t, () => this.stopReel(1, finalCenter, 0.45, 1.2, true))
      t += 0.7
    }

    if (o.revival) {
      add(t, () => {
        sp.fakeMiss = true
        sp.gaugeTarget = 0
      })
      t += 1.3
      add(t, () => {
        sp.fakeMiss = false
        sp.gaugeTarget = 1
        this.emit({ type: 'revival' })
        this.stopReel(1, s1, 0.45, 6, true)
      })
      t += 0.8
    }
    add(t, () => this.resolve(sp, reach))
  }

  private resolve(sp: SpinRun, shownReach: Reach) {
    sp.done = true
    const o = sp.outcome
    if (o.win) {
      this.chain = o.mode === 'rush' ? this.chain + 1 : 1
      if (o.mode === 'normal') this.chainTotal = 0
      this.phase = 'fever'
      this.fever = {
        round: 0,
        shownRounds: o.shownRounds,
        finalRounds: o.rounds,
        inRound: 0,
        roundTime: 0,
        interval: ROUND_INTERVAL,
        payout: 0,
        spawnTimer: 0,
        fromMode: o.mode,
        rushEntry: o.rushEntry,
      }
      this.firing = false
      this.setScene('jackpotIntro')
      this.emit({ type: 'jackpot', outcome: o, chain: this.chain })
      return
    }
    if (shownReach !== 'none') this.emit({ type: 'miss', reach: shownReach })
    if (o.mode === 'rush' && this.rushLeft <= 0) {
      this.setScene('rushEnd')
      this.emit({ type: 'rushEnd', chain: this.chain, total: this.chainTotal })
    }
  }

  // ---------------------------------------------------------------- 大当たり

  private startFever() {
    this.setScene('fever')
    this.nextRound()
  }

  private nextRound() {
    const f = this.fever!
    f.round++
    f.inRound = 0
    f.roundTime = 0
    f.interval = ROUND_INTERVAL
    this.emit({ type: 'roundStart', round: f.round, total: f.shownRounds })
  }

  private updateFever(dt: number) {
    const f = this.fever!
    if (f.interval > 0) {
      f.interval -= dt
      return
    }
    f.roundTime += dt
    // 無料の玉が降り注ぐ
    f.spawnTimer -= dt
    while (f.spawnTimer <= 0) {
      f.spawnTimer += FEVER_SPAWN
      const x = W / 2 + (this.rng() - 0.5) * 220
      this.flying.push(spawnBall(this.nextId++, x, this.rng, true))
    }
    if (f.inRound >= SPEC.ballsPerRound || f.roundTime >= ROUND_MAX_TIME) {
      if (f.round < f.shownRounds) {
        this.nextRound()
      } else if (f.shownRounds < f.finalRounds) {
        f.shownRounds = f.finalRounds
        this.emit({ type: 'upgrade', total: f.finalRounds })
        this.nextRound()
      } else {
        this.endFever()
      }
    }
  }

  private endFever() {
    const f = this.fever!
    this.chainTotal += f.payout
    this.emit({ type: 'feverEnd', payout: f.payout })
    if (f.fromMode === 'rush') {
      this.enterRush()
      return
    }
    this.challengeResult = null
    this.challengePush = false
    this.setScene('challenge')
    this.emit({ type: 'challengeStart' })
  }

  private resolveChallenge() {
    const success = this.fever?.rushEntry ?? false
    this.challengeResult = success
    this.sceneTime = 0
    this.emit({ type: 'challengeResult', success })
  }

  private enterRush() {
    this.phase = 'rush'
    this.rushLeft = SPEC.rushSpins
    this.fever = null
    this.challengeResult = null
    this.setScene('rushIntro')
    this.emit({ type: 'rushStart', chain: this.chain })
  }

  private backToNormal() {
    this.phase = 'normal'
    this.fever = null
    this.challengeResult = null
    this.chain = 0
    this.setScene('play')
  }
}

export const holdLevel = (c: HoldColor) => HOLD_COLORS.indexOf(c)
