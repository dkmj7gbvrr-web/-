import {
  decideSpin,
  HOLD_COLORS,
  LAST_CHANCE_ON_MISS,
  SAKIBARE_ON_MISS,
  SAKIBARE_ON_WIN,
  SAKIYOMI_ZONE_BOOST,
  yokokuCategory,
  ZONE_RATE,
  type Custom,
  LAST_CHANCE_ON_WIN,
  nearMissCenter,
  nextSymbol,
  pickFinale,
  prevSymbol,
  SPEC,
  SYMBOL_COUNT,
  type Finale,
  type FinaleTier,
  type HoldColor,
  type Mode,
  type PochiTell,
  type Reach,
  type SignColor,
  type SpinOutcome,
} from './odds'
import { entryVx, launch, type RailBall } from './launch'
import { createPegs, reachedBottom, spawnBall, stepBall, W, type Ball, type Peg } from './physics'
import { classifyPocket, type BoardPhase, type PocketKind } from './pockets'
import type { Rng } from './rng'

export type Scene = 'play' | 'jackpotIntro' | 'fever' | 'challenge' | 'rushIntro' | 'ltIntro' | 'rushEnd'

export type GameEvent =
  | { type: 'peg'; peg: Peg; ball: Ball }
  | { type: 'gold'; peg: Peg; split: boolean }
  | { type: 'pocket'; kind: PocketKind; x: number; payout: number }
  | { type: 'holdAdded'; color: HoldColor }
  | { type: 'holdChange'; from: HoldColor; to: HoldColor; index: number }
  | { type: 'sakibare' }
  | { type: 'pochi'; tell: PochiTell }
  | { type: 'spinStart'; outcome: SpinOutcome }
  | { type: 'kakutei' }
  | { type: 'reelStop'; reel: number; heavy: boolean }
  | { type: 'reach'; reach: Reach; title: SignColor }
  | { type: 'stepUp'; step: number; final: boolean }
  | { type: 'gijiren'; count: number }
  | { type: 'zone'; count: number; target: boolean }
  | { type: 'cutin'; color: SignColor }
  | { type: 'blackoutReveal' }
  | { type: 'darken' }
  | { type: 'darkenEnd'; win: boolean }
  | { type: 'over'; x: number; payout: number; count: number }
  | { type: 'luckyTrigger' }
  | { type: 'escalate'; reach: Reach }
  | { type: 'pushPrompt' }
  | { type: 'pushed'; win: boolean; charge: number }
  | { type: 'revival' }
  | { type: 'develop' }
  | { type: 'developResult'; success: boolean }
  | { type: 'chargeStart' }
  | { type: 'crawlStep'; slow: boolean; last: boolean }
  | { type: 'darkPause' }
  | { type: 'slip' }
  | { type: 'fakeAlign' }
  | { type: 'fakeAlignBreak' }
  | { type: 'fakeRevivalEnd' }
  | { type: 'blackout' }
  | { type: 'miss'; reach: Reach }
  | { type: 'jackpot'; outcome: SpinOutcome; chain: number }
  | { type: 'roundStart'; round: number; total: number }
  | { type: 'attackerIn'; x: number; payout: number }
  | { type: 'upgrade'; total: number }
  | { type: 'feverEnd'; payout: number; over: number }
  | { type: 'challengeStart' }
  | { type: 'challengeResult'; success: boolean }
  | { type: 'rushStart'; chain: number; lt: boolean }
  | { type: 'lastSpin' }
  | { type: 'lastChance' }
  | { type: 'lastChanceFail' }
  | { type: 'rushEnd'; chain: number; total: number; lt: boolean }
  | { type: 'refill'; amount: number }
  | { type: 'launch' }
  | { type: 'foul' }

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
  /** 決着前の「タメ」：リール部分が暗くなり「・・・」を出す */
  dark: boolean
  /** 決着直前の暗転（画面全体が真っ暗・無音。当たりもハズレもある） */
  darken: boolean
  /** 大当たり確定のブラックアウト（画面が落ち、揃った図柄がうっすら回る） */
  blackout: boolean
  /** ステップアップ予告の現在段階（0＝非表示） */
  step: number
  /** 出ているカットインの色と経過秒 */
  cutin: { color: SignColor; t: number } | null
  /** 「SUPER!?」（昇格するかどうか）の最中 */
  developing: boolean
  finale: Finale | null
  /** RUSH 最終変動の「復活チャンス」ボタンを出している */
  lastChance: boolean
  /** 擬似連の現在回数（1＝なし） */
  nexts: number
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
  fromMode: Mode
  rushEntry: boolean
  luckyTrigger: boolean
  /** 規定数に達してからアタッカーが閉じきるまでの残り秒（>0 のあいだ入った玉はオーバー入賞） */
  closing: number
  /** このラウンドのオーバー入賞数 / 大当たり全体のオーバー入賞数 */
  overInRound: number
  over: number
}

export const FIRE_INTERVAL = 0.14
/** ポッチ予告を見せる秒数 */
export const POCHI_TELL_TIME = 1.6
/** ボタン長押しで溜めきるまでの秒数（溜めきったら自動で離したことになる） */
export const CHARGE_TIME = 1.1
/** コマ送りの間隔：最初は速く、最後の数コマで一気に溜める */
const CRAWL_GAPS = [0.06, 0.06, 0.07, 0.08, 0.1, 0.13, 0.18, 0.26, 0.38, 0.55, 0.85]
const CRAWL_GAPS_RUSH = [0.06, 0.08, 0.12, 0.2, 0.35, 0.55]
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
  /** 発射レールを駆け上がっている途中の玉 */
  rail: RailBall[] = []
  holds: Array<{ outcome: SpinOutcome; shown: HoldColor; zone: boolean }> = []
  /** ラッキートリガー（上位 RUSH）中か */
  lt = false
  /** 演出バランス（見せ方だけを変える。当否・図柄・ラウンドなどの抽選結果には影響しない） */
  custom: Custom = 'standard'
  /** 先読みゾーン：連続予告の回数（0＝ゾーン外） */
  zoneCount = 0
  spin: SpinRun | null = null
  reels: Reel[] = [0, 1, 2].map((i) => ({ pos: i * 2, speed: 0, stopping: null, stopped: true }))
  rushLeft = 0
  chain = 0
  chainTotal = 0
  fever: FeverState | null = null
  /** 盤面の時計 */
  t = 0
  sceneTime = 0
  /** RUSH 突入チャレンジで PUSH 待ちか */
  challengePush = false
  challengeResult: boolean | null = null
  private nextId = 1
  private fireCooldown = 0
  private goldRespawn = 0
  firing = false
  /** 発射の強さ 0〜1（ハンドルの回し具合） */
  strength = 0.5
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
      this.rail.length === 0 &&
      this.scene === 'play' &&
      this.phase === 'normal' &&
      !this.spin &&
      this.holds.length === 0
    )
  }

  refill(amount = REFILL_AMOUNT) {
    if (!this.needsRefill) return
    this.balls += amount
    this.emit({ type: 'refill', amount })
  }

  /** ボタンを長押しして溜めている最中か / 溜まり具合 0〜1（結果には影響しない） */
  charging = false
  charge = 0

  /** ボタンを押し始めた。押している間は溜まり、離すか溜めきると決着する */
  pressDown() {
    if (!this.pushPending || this.charging) return
    this.charging = true
    this.charge = 0
    this.emit({ type: 'chargeStart' })
  }

  /** ボタンを離した */
  pressUp() {
    if (!this.charging) return
    this.push()
  }

  private updateCharge(dt: number) {
    if (!this.charging) return
    this.charge = Math.min(1, this.charge + dt / CHARGE_TIME)
    if (this.spin) this.spin.gaugeTarget = Math.max(this.spin.gaugeTarget, 0.5 + this.charge * 0.45)
    if (this.charge >= 1) this.push()
  }

  push() {
    const charge = this.charging ? this.charge : 0
    this.charging = false
    this.charge = 0
    if (this.spin?.waitingPush) {
      this.spin.waitingPush = false
      // PUSH は決着の「始まり」。ここではまだ結果をにおわせない
      this.emit({ type: 'pushed', win: false, charge })
    } else if (this.challengePush) {
      this.challengePush = false
      this.resolveChallenge()
    }
  }

  update(dt: number) {
    this.t += dt
    this.sceneTime += dt
    this.updateRail(dt)
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
        if (this.challengePush && this.charging) this.updateCharge(dt)
        else if (this.challengePush && this.sceneTime > 3.2 + PUSH_AUTO) this.push()
        if (this.challengeResult !== null && this.sceneTime > 2.2) {
          if (this.challengeResult) this.enterRush()
          else this.backToNormal()
        }
        break
      case 'rushIntro':
        if (this.sceneTime > 1.8) this.setScene('play')
        break
      case 'ltIntro':
        if (this.sceneTime > 4.2) this.enterRush()
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
    this.rail.push(launch(this.nextId++, this.strength, this.rng))
    this.emit({ type: 'launch' })
  }

  private updateRail(dt: number) {
    for (const rb of this.rail) rb.t += dt
    const done = this.rail.filter((rb) => rb.t >= rb.dur)
    if (done.length === 0) return
    this.rail = this.rail.filter((rb) => rb.t < rb.dur)
    for (const rb of done) {
      if (rb.foul) {
        // 届かなかった玉は受け皿に戻ってくる
        this.balls += 1
        this.emit({ type: 'foul' })
        continue
      }
      const b = spawnBall(rb.id, rb.entryX, this.rng)
      b.vx = entryVx(this.strength, this.rng)
      this.flying.push(b)
    }
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
          ? classifyPocket(ball.x, 'fever')
          : { kind: 'out' as const, payout: 0 }
        : classifyPocket(ball.x, this.phase)
    switch (res.kind) {
      case 'attacker': {
        const f = this.fever!
        if (f.inRound >= SPEC.ballsPerRound) {
          // 規定数に達したあと、閉じきる前に滑り込んだ玉＝オーバー入賞
          f.overInRound++
          f.over++
          f.payout += SPEC.payoutPerBall
          this.balls += SPEC.payoutPerBall
          this.emit({ type: 'over', x: ball.x, payout: SPEC.payoutPerBall, count: f.overInRound })
          return
        }
        f.inRound++
        if (f.inRound >= SPEC.ballsPerRound) f.closing = SPEC.attackerCloseTime
        f.payout += SPEC.payoutPerBall
        this.balls += SPEC.payoutPerBall
        this.emit({ type: 'attackerIn', x: ball.x, payout: SPEC.payoutPerBall })
        return
      }
      case 'start': {
        const payout = this.phase === 'rush' ? SPEC.rushStartPayout : SPEC.startPocketPayout
        this.balls += payout
        this.emit({ type: 'pocket', kind: 'start', x: ball.x, payout })
        if (this.holds.length < SPEC.maxHolds) {
          const mode = this.boardMode()
          const outcome = decideSpin(mode, this.rng)
          // 先読みゾーンは、この保留より前に消化される変動があるときだけ成立する
          const ahead = this.holds.length + (this.spin ? 1 : 0)
          const zoneRate =
            this.custom === 'sakibare'
              ? 0
              : ZONE_RATE[yokokuCategory(outcome.win, outcome.reach)] * (this.custom === 'sakiyomi' ? SAKIYOMI_ZONE_BOOST : 1)
          const zone = mode === 'normal' && ahead > 0 && !this.holds.some((h) => h.zone) && this.rng() < zoneRate
          // 先バレ：保留の色は白で入り、当たりなら入賞の瞬間に告知音（ハズレでもまれに鳴る）
          const shown: HoldColor = this.custom === 'sakibare' ? 'white' : outcome.entryColor
          this.holds.push({ outcome, shown, zone })
          this.emit({ type: 'holdAdded', color: shown })
          if (
            this.custom === 'sakibare' &&
            mode === 'normal' &&
            this.rng() < (outcome.win ? SAKIBARE_ON_WIN : SAKIBARE_ON_MISS)
          ) {
            this.emit({ type: 'sakibare' })
          }
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

  private boardMode(): Mode {
    return this.phase === 'rush' ? (this.lt ? 'lt' : 'rush') : 'normal'
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
      sp.gauge += (sp.gaugeTarget - sp.gauge) * Math.min(1, dt * 6)
      if (this.charging) this.updateCharge(dt)
      else {
        sp.pushWait += dt
        if (sp.pushWait > PUSH_AUTO) this.push()
      }
      return
    }
    if (sp.cutin) sp.cutin.t += dt
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
    const mode = this.boardMode()
    if (outcome.mode !== mode) outcome = decideSpin(mode, this.rng)
    const fast = mode === 'normal' && this.holds.length >= 3
    // 先読みゾーン：対象保留より前の変動ごとに連続予告を1つずつ積み、対象の変動で最高潮にする
    const zoneAhead = this.holds.some((x) => x.zone)
    if (mode === 'normal' && (zoneAhead || h.zone)) {
      this.zoneCount++
      this.emit({ type: 'zone', count: this.zoneCount, target: h.zone })
    } else {
      this.zoneCount = 0
    }
    let lastSpin = false
    if (mode !== 'normal') {
      this.rushLeft--
      lastSpin = this.rushLeft === 0
    }
    if (this.custom === 'sakiyomi' && mode === 'normal' && this.rng() < 0.5) {
      // 先読み重視：変動開始後の予告（ステップアップ・擬似連）は控えめに
      outcome = { ...outcome, yokoku: { ...outcome.yokoku, stepUp: 0, gijiren: 1 } }
    }
    if (lastSpin && outcome.reach === 'none') {
      // RUSH 最終変動は必ずリーチにする（ハズレなら左右をそろえたニアミス目に作り直す）
      let symbols = outcome.symbols
      if (!outcome.win) {
        const l = symbols[0]
        symbols = [l, nearMissCenter(l, this.rng), l]
      }
      outcome = { ...outcome, reach: 'normal', symbols }
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
      dark: false,
      darken: false,
      blackout: false,
      step: 0,
      cutin: null,
      developing: false,
      finale: null,
      lastChance: false,
      nexts: 1,
    }
    this.spin = sp
    this.emit({ type: 'spinStart', outcome })
    if (h.shown !== outcome.tell && mode === 'normal') {
      this.emit({ type: 'holdChange', from: h.shown, to: outcome.tell, index: -1 })
    }
    if (this.custom === 'sakiyomi' && mode === 'normal') {
      // 先読み重視：待っている保留が、本来の色へ向かって1段ずつ育つ
      this.holds.forEach((x, i) => {
        const cur = HOLD_COLORS.indexOf(x.shown)
        if (cur < HOLD_COLORS.indexOf(x.outcome.tell) && this.rng() < 0.5) {
          const to = HOLD_COLORS[cur + 1]
          this.emit({ type: 'holdChange', from: x.shown, to, index: i })
          x.shown = to
        }
      })
    }
    if (lastSpin) this.emit({ type: 'lastSpin' })
    if (outcome.iwakan === 'reverse') {
      // 違和感：変動開始の一瞬だけ逆回転
      for (const r of this.reels) r.speed = -5
      sp.actions.push({
        at: 0.28,
        fn: () => {
          for (const r of this.reels) if (!r.stopped && !r.stopping) r.speed = 24 + this.rng() * 4
        },
      })
    }
    if (outcome.iwakan === 'flicker') {
      // 違和感：盤面の釘ランプが一瞬だけ全部光る
      sp.actions.push({
        at: 0.55,
        fn: () => {
          for (const p of this.pegs) p.glow = 0.12
        },
      })
    }
    if (outcome.blackout) this.buildBlackout(sp)
    else this.buildTimeline(sp, fast, lastSpin)
    // 演出の予約は前後して積むことがあるので時刻順に並べる（同時刻は積んだ順）
    sp.actions.sort((x, y) => x.at - y.at)
  }

  private buildTimeline(sp: SpinRun, fast: boolean, lastSpin: boolean) {
    const o = sp.outcome
    const rush = o.mode !== 'normal'
    const k = rush ? 0.6 : 1
    const add = (at: number, fn: () => void) => sp.actions.push({ at, fn })
    const [s0, s1, s2] = o.symbols
    const pre = this.schedulePreview(sp)
    const L = pre + (rush ? 0.35 : fast ? 0.45 : 0.9)
    const R = pre + (rush ? 0.6 : fast ? 0.75 : 1.5)
    const reach = o.reach

    if (o.kakutei) add(0.05, () => this.emit({ type: 'kakutei' }))
    add(L, () => this.stopReel(0, s0, 0.3, 3))

    if (reach === 'none') {
      add(R, () => this.stopReel(2, s2, 0.3, 3))
      const c = R + (rush ? 0.25 : fast ? 0.3 : 0.5)
      add(c, () => this.stopReel(1, s1, 0.3, 3))
      add(c + 0.4, () => this.resolve(sp, reach))
      return
    }

    // リーチ成立：左右が揃い、中図柄は高速で回り続ける（ブレて見えない）
    add(R, () => {
      this.stopReel(2, s2, 0.35, 3, true)
      sp.stage = 'normal'
      sp.gaugeTarget = 0.2
      this.reels[1].speed = 14
      this.emit({ type: 'reach', reach, title: o.yokoku.title })
    })
    let t = R + 1.2 * k
    const escalate = (at: number, level: Reach, gauge: number) =>
      add(at, () => {
        sp.stage = level
        sp.escalated = true
        sp.gaugeTarget = gauge
        this.emit({ type: 'escalate', reach: level })
      })
    const pushPrompt = (at: number) =>
      add(at, () => {
        sp.gaugeTarget = Math.max(sp.gaugeTarget, 0.5)
        sp.waitingPush = true
        this.emit({ type: 'pushPrompt' })
      })

    if (reach === 'normal') {
      // 「発展!?」と見せて発展しない（期待させて外す）
      if (!rush && !lastSpin && this.rng() < 0.35) {
        add(t, () => {
          sp.developing = true
          sp.gaugeTarget = 0.4
          this.emit({ type: 'develop' })
        })
        t += 1.1
        add(t, () => {
          sp.developing = false
          sp.gaugeTarget = 0
          this.emit({ type: 'developResult', success: false })
          // 発展しない＝ハズレ。引っ張らずにその場で止めて次の変動へ
          this.snapCenter(s1)
        })
        add(t + 0.3, () => this.resolve(sp, reach))
        return
      }
      t = lastSpin ? this.scheduleLastChance(sp, t, k) : this.scheduleFinale(sp, t, 'normal', k)
    } else {
      // スーパー / プレミア：（発展!? →）格上げ → 連打チャンス → PUSH → 決着
      if (!rush && this.rng() < 0.5) {
        add(t, () => {
          sp.developing = true
          sp.gaugeTarget = 0.4
          this.emit({ type: 'develop' })
        })
        t += 1.1
        add(t, () => {
          sp.developing = false
          this.emit({ type: 'developResult', success: true })
        })
      }
      escalate(t, 'super', 0.45)
      if (reach === 'premium') {
        t += 1.3 * k
        escalate(t, 'premium', 0.7)
      }
      const cutin = o.yokoku.cutin
      if (cutin) {
        t += 1.1 * k
        add(t, () => {
          sp.cutin = { color: cutin, t: 0 }
          sp.gaugeTarget = Math.max(sp.gaugeTarget, SIGN_GAUGE[cutin])
          this.emit({ type: 'cutin', color: cutin })
        })
        add(t + 1.2 * k, () => {
          sp.cutin = null
        })
        t += 0.2 * k
      }
      t += rush ? 1.0 : 1.6
      if (lastSpin) {
        // RUSH 最終変動はリーチ中に PUSH を出さず、いったん止めてから復活チャンスへ
        t = this.scheduleLastChance(sp, t, k)
      } else {
        pushPrompt(t)
        t += 0.02
        // ボタンを押したら、その瞬間に図柄がびたっと止まる（余韻なし）
        sp.finale = 'straight'
        add(t, () => this.snapCenter(s1))
        t += 0.35
      }
    }
    add(t, () => this.resolve(sp, reach))
  }

  /**
   * 変動開始直後の予告（ステップアップ → 擬似連）を予約し、かかった秒数を返す。
   * 通常時のみ。RUSH 中はテンポを優先して出さない。
   */
  private schedulePreview(sp: SpinRun): number {
    const y = sp.outcome.yokoku
    if (sp.outcome.mode !== 'normal') return 0
    const add = (at: number, fn: () => void) => sp.actions.push({ at, fn })
    let t = 0.15
    // ポッチ予告：場所・行動・持ち物で期待度を示す（見せている間はリールを止めない）
    const pochi = y.pochi
    if (pochi) {
      add(t, () => {
        sp.gaugeTarget = Math.max(sp.gaugeTarget, 0.15)
        this.emit({ type: 'pochi', tell: pochi })
      })
      t += POCHI_TELL_TIME
    }
    for (let step = 1; step <= y.stepUp; step++) {
      const st = step
      add(t, () => {
        sp.step = st
        sp.gaugeTarget = Math.max(sp.gaugeTarget, st * 0.08)
        this.emit({ type: 'stepUp', step: st, final: st === y.stepUp })
      })
      t += 0.42
    }
    if (y.stepUp > 0) {
      add(t + 0.2, () => {
        sp.step = 0
      })
      t += 0.2
    }
    // 擬似連：全リールが一度止まり「NEXT」で再始動する
    for (let n = 2; n <= y.gijiren; n++) {
      const count = n
      t += 0.8
      add(t, () => {
        for (let i = 0; i < 3; i++) this.stopReel(i, 1 + Math.floor(this.rng() * SYMBOL_COUNT), 0.2, 2)
      })
      t += 0.45
      add(t, () => {
        for (const r of this.reels) {
          r.stopping = null
          r.stopped = false
          r.speed = 24 + this.rng() * 4
        }
        sp.gaugeTarget = Math.max(sp.gaugeTarget, 0.1 * count)
        sp.nexts = count
        this.emit({ type: 'gijiren', count })
      })
      t += 0.2
    }
    return t
  }

  /**
   * ブラックアウト（大当たり確定）：変動開始直後に画面が落ちて無音になり、
   * 暗闇の中で揃った図柄がうっすら回ってから、光が戻ると同時に大当たり。
   */
  private buildBlackout(sp: SpinRun) {
    const add = (at: number, fn: () => void) => sp.actions.push({ at, fn })
    const s = sp.outcome.symbols[0]
    add(0.35, () => {
      sp.blackout = true
      this.emit({ type: 'blackout' })
    })
    add(2.2, () => {
      for (let i = 0; i < 3; i++) this.stopReel(i, s, 0.6, 3)
    })
    add(3.6, () => {
      sp.blackout = false
      sp.gaugeTarget = 1
      this.emit({ type: 'blackoutReveal' })
    })
    add(4.3, () => this.resolve(sp, 'none'))
  }

  /**
   * RUSH 最終変動の決着：まずハズレ目で止める（当たりの一部はそのまま揃う）。
   * 確率で「復活チャンス」ボタンが出て、押すと当たりなら全リール再始動で復活、ハズレなら復活ならず。
   */
  private scheduleLastChance(sp: SpinRun, t: number, k: number): number {
    const o = sp.outcome
    const add = (at: number, fn: () => void) => sp.actions.push({ at, fn })
    const [W0, s1] = o.symbols
    const gaps = k < 1 ? CRAWL_GAPS_RUSH : CRAWL_GAPS
    const button = this.rng() < (o.win ? LAST_CHANCE_ON_WIN : LAST_CHANCE_ON_MISS)
    sp.finale = 'straight'
    if (o.win && !button) {
      // ボタンなしでそのまま揃う
      return this.crawl(sp, t, W0, gaps) + 0.4
    }
    // いったんハズレ目で止まる（当たりのときは1コマ先のハズレ目）
    t = this.crawl(sp, t, o.win ? nextSymbol(W0) : s1, gaps)
    if (!button) return t + 0.5
    add(t + 0.2, () => {
      sp.dark = true
      sp.gaugeTarget = 0.05
      this.emit({ type: 'darkPause' })
    })
    t += 1.0
    add(t, () => {
      sp.dark = false
      sp.lastChance = true
      sp.gaugeTarget = 0.5
      sp.waitingPush = true
      this.emit({ type: 'lastChance' })
    })
    t += 0.02
    // ボタンを押した瞬間に決着（余韻なし）
    if (o.win) {
      sp.finale = 'revival'
      add(t, () => {
        sp.lastChance = false
        sp.gaugeTarget = 1
        this.snapCenter(W0)
        this.emit({ type: 'revival' })
      })
      return t + 0.35
    }
    sp.finale = 'fakeRevival'
    add(t, () => {
      sp.lastChance = false
      sp.gaugeTarget = 0
      this.emit({ type: 'lastChanceFail' })
    })
    return t + 0.35
  }

  /** 中リールをその場で symbol に止める（アニメーションなし） */
  private snapCenter(symbol: number) {
    const r = this.reels[1]
    let to = Math.round(r.pos)
    while (((to % SYMBOL_COUNT) + SYMBOL_COUNT) % SYMBOL_COUNT !== symbol - 1) to++
    r.pos = to
    r.speed = 0
    r.stopping = null
    r.stopped = true
    this.emit({ type: 'reelStop', reel: 1, heavy: true })
  }

  /** 中リールを1コマ進める（コマ送り） */
  private stepCenter(dur: number) {
    const r = this.reels[1]
    const from = r.stopping ? r.stopping.to : Math.round(r.pos)
    r.pos = from
    r.speed = 0
    r.stopped = false
    r.stopping = { from, to: from + 1, t: 0, dur }
  }

  /**
   * 中リールを減速させながらコマ送りし、symbol で止める。止まる時刻を返す。
   * 開始時に「残りコマ数ぶん手前」へ位置を合わせる（直前まで高速回転でブレているので見えない）。
   */
  private crawl(sp: SpinRun, t: number, symbol: number, gaps: number[]): number {
    sp.actions.push({
      at: t,
      fn: () => {
        const r = this.reels[1]
        r.stopping = null
        r.stopped = true
        r.speed = 0
        r.pos = symbol - 1 - gaps.length
      },
    })
    let tt = t
    gaps.forEach((gap, i) => {
      tt += gap
      const last = i === gaps.length - 1
      sp.actions.push({
        at: tt,
        fn: () => {
          this.stepCenter(gap >= 0.3 ? 0.18 : 0.07)
          if (gap >= 0.2 || last) this.emit({ type: 'crawlStep', slow: gap >= 0.3, last })
        },
      })
    })
    return tt + 0.2
  }

  private scheduleFinale(sp: SpinRun, t: number, tier: FinaleTier, k: number): number {
    const o = sp.outcome
    const add = (at: number, fn: () => void) => sp.actions.push({ at, fn })
    const [W0, s1] = o.symbols
    const gaps = k < 1 ? CRAWL_GAPS_RUSH : CRAWL_GAPS
    const finale = pickFinale(o, tier, this.rng)
    sp.finale = finale
    const darkPause = (at: number) =>
      add(at, () => {
        sp.dark = true
        sp.gaugeTarget = 0.05
        this.emit({ type: 'darkPause' })
      })

    switch (finale) {
      case 'straight':
        t = this.crawl(sp, t, s1, gaps)
        return t + 0.4
      case 'slip':
        // 1コマ手前で止まる → 暗転のタメ → すべって揃う
        t = this.crawl(sp, t, prevSymbol(W0), gaps)
        darkPause(t + 0.35)
        t += 0.35 + 1.3 * k
        add(t, () => {
          sp.dark = false
          sp.gaugeTarget = 1
          this.stepCenter(0.3)
          this.emit({ type: 'slip' })
        })
        return t + 0.7
      case 'fakeAlign':
        // 一瞬揃う → 1コマずれてハズレ
        t = this.crawl(sp, t, W0, gaps)
        add(t - 0.15, () => {
          sp.gaugeTarget = 1
          this.emit({ type: 'fakeAlign' })
        })
        t += 0.45
        add(t, () => {
          sp.gaugeTarget = 0
          this.stepCenter(0.12)
          this.emit({ type: 'fakeAlignBreak' })
        })
        return t + 0.8
      case 'revival':
        // ハズレで止まる → 暗転のタメ → 全リール再始動 → 揃う
        t = this.crawl(sp, t, nextSymbol(W0), gaps)
        darkPause(t + 0.4)
        t += 0.4 + 1.6 * k
        add(t, () => {
          sp.dark = false
          sp.gaugeTarget = 1
          for (const r of this.reels) {
            r.stopping = null
            r.stopped = false
            r.speed = 26
          }
          this.emit({ type: 'revival' })
        })
        t += 1.0
        add(t, () => {
          for (let i = 0; i < 3; i++) this.stopReel(i, W0, 0.4, 4, i === 1)
        })
        return t + 0.8
      case 'fakeRevival':
        // 復活と同じタメを見せて、そのままハズレ
        t = this.crawl(sp, t, s1, gaps)
        darkPause(t + 0.4)
        t += 0.4 + 1.6 * k
        add(t, () => {
          sp.dark = false
          this.emit({ type: 'fakeRevivalEnd' })
        })
        return t + 0.6
      case 'darken':
        // 決着直前に真っ暗・無音 → 明けた瞬間に結果
        add(t, () => {
          sp.darken = true
          this.emit({ type: 'darken' })
        })
        t += 1.2 * k
        add(t, () => {
          sp.darken = false
          sp.gaugeTarget = o.win ? 1 : 0
          this.stopReel(1, s1, 0.18, 2, true)
          this.emit({ type: 'darkenEnd', win: o.win })
        })
        return t + 0.7
    }
  }

  private resolve(sp: SpinRun, shownReach: Reach) {
    sp.done = true
    const o = sp.outcome
    if (o.win) {
      this.chain = o.mode !== 'normal' ? this.chain + 1 : 1
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
        luckyTrigger: o.luckyTrigger,
        closing: 0,
        overInRound: 0,
        over: 0,
      }
      this.firing = false
      this.setScene('jackpotIntro')
      this.emit({ type: 'jackpot', outcome: o, chain: this.chain })
      return
    }
    if (shownReach !== 'none') this.emit({ type: 'miss', reach: shownReach })
    if (o.mode !== 'normal' && this.rushLeft <= 0) {
      this.setScene('rushEnd')
      this.emit({ type: 'rushEnd', chain: this.chain, total: this.chainTotal, lt: this.lt })
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
    f.closing = 0
    f.overInRound = 0
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
    if (f.closing > 0) {
      // 規定数に達したアタッカーが閉じきるまでの間（ここで入るとオーバー入賞）
      f.closing -= dt
      if (f.closing > 0) return
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
    this.emit({ type: 'feverEnd', payout: f.payout, over: f.over })
    if (f.fromMode !== 'normal') {
      if (f.fromMode === 'rush' && f.luckyTrigger) {
        // ラッキートリガー発動：RUSH より上の「上位 RUSH」へ
        this.lt = true
        this.phase = 'rush'
        this.rushLeft = SPEC.ltSpins
        this.fever = null
        this.setScene('ltIntro')
        this.emit({ type: 'luckyTrigger' })
        return
      }
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
    this.rushLeft = this.lt ? SPEC.ltSpins : SPEC.rushSpins
    this.fever = null
    this.challengeResult = null
    this.setScene('rushIntro')
    this.emit({ type: 'rushStart', chain: this.chain, lt: this.lt })
  }

  private backToNormal() {
    this.phase = 'normal'
    this.lt = false
    this.fever = null
    this.challengeResult = null
    this.chain = 0
    this.setScene('play')
  }
}

export const holdLevel = (c: HoldColor) => HOLD_COLORS.indexOf(c)

/** 色サインが出たときにゲージを押し上げる量 */
const SIGN_GAUGE: Record<SignColor, number> = {
  white: 0.3,
  blue: 0.4,
  green: 0.5,
  red: 0.65,
  gold: 0.8,
  rainbow: 1,
}
