import './style.css'
import { Fx } from './fx'
import { audio } from './game/audio'
import { Game, holdLevel, type GameEvent } from './game/game'
import type { HoldColor } from './game/odds'
import { BOARD_BOTTOM, H, W } from './game/physics'
import { mulberry32 } from './game/rng'
import { BTN_MOTION, BTN_MUTE, BTN_REFILL, render, type Ui } from './render'

const canvas = document.querySelector<HTMLCanvasElement>('#game')!
const ctx = canvas.getContext('2d')!

const STORAGE_KEY = 'dopamine-rush:v1'
interface Saved {
  muted: boolean
  reducedMotion: boolean
  best: { chain: number; total: number }
}
function load(): Partial<Saved> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Saved>
  } catch {
    return {}
  }
}
function save() {
  try {
    const s: Saved = { muted: ui.muted, reducedMotion: ui.reducedMotion, best: ui.best }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // 保存できなくても遊べる
  }
}

const saved = load()
const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
const ui: Ui = {
  started: false,
  muted: saved.muted ?? false,
  reducedMotion: saved.reducedMotion ?? prefersReduced,
  displayBalls: 0,
  best: saved.best ?? { chain: 0, total: 0 },
  displayPayout: 0,
}
const fx = new Fx()
fx.reducedMotion = ui.reducedMotion
audio.muted = ui.muted

const HOLD_COLOR_CSS: Record<HoldColor, string> = {
  white: '#ffffff',
  blue: '#3d8bff',
  green: '#27d17f',
  red: '#ff3355',
  gold: '#ffd23d',
  rainbow: '#ffffff',
}
const RAINBOW = ['#ff3b3b', '#ffa53d', '#ffe23d', '#3ddc84', '#39c0ff', '#b77dff', '#ff6fb5']

let lastPegSound = 0
let attackerCount = 0
let clock = 0

function onEvent(e: GameEvent) {
  switch (e.type) {
    case 'peg': {
      if (clock - lastPegSound > 0.03) {
        audio.peg(e.ball.hits - 1)
        lastPegSound = clock
      }
      if (!e.ball.free || Math.random() < 0.3) fx.burst(e.peg.x, e.peg.y, 3, ['#9ff', '#fff'], 90)
      break
    }
    case 'gold':
      audio.gold()
      fx.burst(e.peg.x, e.peg.y, 18, ['#ffd23d', '#fff3b0', '#fff'], 200, 'star')
      fx.ring(e.peg.x, e.peg.y, '#ffd23d', 40)
      fx.popup(e.peg.x, e.peg.y - 8, '+1', '#ffd23d', 16)
      if (e.split) {
        fx.show('MULTI BALL!', { color: '#ffd23d', size: 40, dur: 1 })
        fx.shake(0.25)
        audio.levelUp()
      }
      break
    case 'pocket':
      if (e.kind === 'start') {
        audio.startPocket()
        fx.burst(e.x, BOARD_BOTTOM + 10, 20, ['#ffdd33', '#fff'], 260)
        fx.ring(e.x, BOARD_BOTTOM + 10, '#ffdd33', 50)
        fx.popup(e.x, BOARD_BOTTOM - 10, `+${e.payout}`, '#ffdd33', 18)
      } else if (e.kind === 'bonus') {
        audio.bonusPocket(e.payout)
        fx.burst(e.x, BOARD_BOTTOM + 10, 8, ['#8ff', '#fff'], 160)
        fx.popup(e.x, BOARD_BOTTOM - 10, `+${e.payout}`, '#bfefff', 15)
      }
      break
    case 'holdAdded': {
      const lvl = holdLevel(e.color)
      if (lvl >= 3) {
        audio.holdChange(lvl)
        fx.shake(0.1 * lvl)
      }
      break
    }
    case 'holdChange': {
      const lvl = holdLevel(e.to)
      audio.holdChange(lvl)
      fx.doFlash(0.25 + lvl * 0.08, HOLD_COLOR_CSS[e.to])
      fx.burst(262, 236, 30, e.to === 'rainbow' ? RAINBOW : [HOLD_COLOR_CSS[e.to], '#fff'], 220, 'star')
      fx.show('保留変化!!', { color: HOLD_COLOR_CSS[e.to], size: 40, dur: 0.9, rainbow: e.to === 'rainbow' })
      fx.shake(0.12 + lvl * 0.05)
      if (e.to === 'rainbow') audio.kakutei()
      break
    }
    case 'kakutei':
      audio.kakutei()
      fx.doFlash(1)
      fx.stop(0.3)
      fx.shake(0.5)
      fx.rainbow = 0.25
      break
    case 'reelStop':
      audio.reelStop(e.heavy)
      fx.shake(e.heavy ? 0.18 : 0.06)
      break
    case 'reach':
      audio.reach()
      fx.show('リーチ!', { color: '#ffd23d', size: 62, dur: 1.1 , priority: 2 })
      fx.shake(0.2)
      break
    case 'escalate':
      if (e.reach === 'premium') {
        audio.riser(1.4, 1.4)
        fx.show('激アツ!!', { rainbow: true, size: 72, dur: 1.5 , priority: 2 })
        fx.doFlash(0.7)
        fx.shake(0.45)
        fx.rainbow = 0.2
        fx.confettiRain(60, W)
      } else {
        audio.riser(2.2)
        fx.show('SUPER リーチ', { color: '#ff3355', size: 46, dur: 1.4 , priority: 2 })
        fx.doFlash(0.35, '#ff3355')
        fx.shake(0.3)
      }
      break
    case 'pushPrompt':
      audio.tone(880, 0.12, { type: 'square', gain: 0.08 })
      audio.tone(1320, 0.18, { type: 'square', gain: 0.08, delay: 0.12 })
      break
    case 'pushed':
      audio.impact()
      fx.stop(0.2)
      fx.shake(0.4)
      fx.doFlash(e.win ? 0.9 : 0.4)
      break
    case 'revival':
      audio.kakutei()
      audio.impact()
      fx.show('復活!!', { rainbow: true, size: 80, dur: 1.2 , priority: 3 })
      fx.doFlash(1)
      fx.stop(0.25)
      fx.shake(0.8)
      fx.confettiRain(80, W)
      break
    case 'develop':
      audio.develop()
      fx.show('発展!?', { color: '#ffd23d', size: 64, dur: 1.1, priority: 2 })
      fx.shake(0.25)
      break
    case 'developResult':
      if (e.success) {
        fx.doFlash(0.6, '#ffd23d')
        fx.stop(0.12)
      } else {
        audio.fall()
        fx.show('発展ならず…', { color: '#8890a8', size: 40, dur: 0.9, priority: 2 })
      }
      break
    case 'rendaStart':
      audio.startPocket()
      audio.riser(2.4, 0.9)
      fx.doFlash(0.3, '#ff3355')
      break
    case 'rendaTap':
      audio.rendaTap(e.count)
      fx.shake(0.06)
      fx.burst(W / 2 + (Math.random() - 0.5) * 160, 600 + (Math.random() - 0.5) * 60, 6, RAINBOW, 180, 'star')
      break
    case 'crawlStep':
      audio.crawl(e.slow, e.last)
      fx.shake(e.last ? 0.3 : e.slow ? 0.12 : 0.04)
      if (e.last) fx.stop(0.08)
      break
    case 'darkPause':
      audio.drone(1.6)
      fx.rainbow = 0
      break
    case 'slip':
      audio.kakutei()
      audio.impact()
      fx.show('キタ!!', { rainbow: true, size: 80, dur: 0.9, priority: 3 })
      fx.doFlash(1)
      fx.stop(0.2)
      fx.shake(0.8)
      break
    case 'fakeAlign':
      audio.tease()
      fx.doFlash(0.55)
      fx.shake(0.35)
      fx.rainbow = 0.25
      fx.burst(W / 2, 140, 30, RAINBOW, 260, 'star')
      break
    case 'fakeAlignBreak':
      audio.fall()
      fx.rainbow = 0
      fx.shake(0.55)
      fx.stop(0.15)
      break
    case 'fakeRevivalEnd':
      audio.tone(300, 0.6, { type: 'triangle', gain: 0.05, slideTo: 140 })
      break
    case 'blackout':
      fx.rainbow = 0
      break
    case 'blackoutEnd':
      if (e.win) {
        audio.kakutei()
        audio.impact()
        fx.doFlash(1)
        fx.stop(0.25)
        fx.shake(0.9)
      } else {
        audio.reelStop(true)
        fx.shake(0.2)
      }
      break
    case 'miss':
      audio.miss()
      fx.rainbow = 0
      break
    case 'jackpot': {
      audio.fanfare()
      fx.stop(0.35)
      fx.doFlash(1)
      fx.shake(1)
      fx.rainbow = 0
      fx.confettiRain(160, W)
      fx.burst(W / 2, 140, 80, RAINBOW, 420, 'star')
      const chainText = e.outcome.mode === 'rush' ? `${e.chain}連!!` : `${e.outcome.shownRounds}R`
      fx.show('大当たり!!', { rainbow: true, size: 76, dur: 2.4, sub: chainText , priority: 3 })
      ui.displayPayout = 0
      attackerCount = 0
      window.setTimeout(() => audio.playMusic('fever', 150 + Math.min(40, e.chain * 5)), 1200)
      break
    }
    case 'roundStart':
      fx.show(`ROUND ${e.round}`, { color: '#ffd23d', size: 44, dur: 0.9, sub: `/ ${e.total}R` })
      break
    case 'attackerIn':
      attackerCount++
      audio.countTick(attackerCount)
      fx.burst(e.x, BOARD_BOTTOM, 6, ['#ffd23d', '#ffb800', '#fff3b0'], 200, 'coin')
      fx.popup(e.x, BOARD_BOTTOM - 14, `+${e.payout}`, '#ffd23d', 17)
      fx.shake(0.04)
      break
    case 'upgrade':
      audio.levelUp()
      audio.kakutei()
      fx.show('ラウンド昇格!!', { rainbow: true, size: 52, dur: 1.8, sub: `${e.total}R へ` , priority: 3 })
      fx.doFlash(0.9)
      fx.stop(0.25)
      fx.shake(0.7)
      fx.confettiRain(120, W)
      break
    case 'feverEnd':
      // 通常時からの大当たりは突入チャレンジ画面に獲得数を出すので、テロップは RUSH 中だけ
      if (game.phase === 'rush' || game.fever?.fromMode === 'rush') {
        fx.show(`+${e.payout.toLocaleString()} 玉`, { color: '#ffd23d', size: 54, dur: 1.8, priority: 2 })
      }
      audio.levelUp()
      updateBest(game.chain, game.chainTotal)
      break
    case 'challengeStart':
      audio.playMusic(null)
      audio.riser(3.2, 1.2)
      break
    case 'challengeResult':
      if (e.success) {
        audio.fanfare()
        audio.kakutei()
        fx.show('RUSH 突入!!', { rainbow: true, size: 66, dur: 2 , priority: 3 })
        fx.doFlash(1)
        fx.stop(0.3)
        fx.shake(1)
        fx.confettiRain(200, W)
      } else {
        audio.miss()
        fx.show('残念…', { color: '#8890a8', size: 50, dur: 1.8, sub: 'また次の大当たりで' })
      }
      break
    case 'rushStart':
      audio.playMusic('rush', Math.min(200, 138 + e.chain * 6))
      fx.show(e.chain <= 1 ? 'RUSH START' : `${e.chain}連 継続中!!`, { rainbow: true, size: 50, dur: 1.5 })
      fx.doFlash(0.5, '#ff4df0')
      break
    case 'lastSpin':
      fx.show('LAST!', { color: '#ff3355', size: 70, dur: 1 , priority: 2 })
      audio.heartbeat()
      fx.shake(0.3)
      break
    case 'rushEnd':
      audio.playMusic(null)
      audio.levelUp()
      updateBest(e.chain, e.total)
      break
    case 'refill':
      fx.show(`+${e.amount} 玉`, { color: '#3ddc84', size: 44, dur: 1.2 })
      audio.levelUp()
      break
  }
}

function updateBest(chain: number, total: number) {
  let changed = false
  if (chain > ui.best.chain) {
    ui.best.chain = chain
    changed = true
  }
  if (total > ui.best.total) {
    ui.best.total = total
    changed = true
  }
  if (changed) save()
}

const game = new Game(mulberry32((Math.random() * 2 ** 32) >>> 0), onEvent)
ui.displayBalls = game.balls

// ---------------------------------------------------------------- 入力

function toLogical(ev: PointerEvent) {
  const r = canvas.getBoundingClientRect()
  return { x: ((ev.clientX - r.left) / r.width) * W, y: ((ev.clientY - r.top) / r.height) * H }
}
const inside = (p: { x: number; y: number }, b: { x: number; y: number; w: number; h: number }) =>
  p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h

canvas.addEventListener('pointerdown', (ev) => {
  ev.preventDefault()
  canvas.setPointerCapture(ev.pointerId)
  audio.unlock()
  const p = toLogical(ev)
  if (!ui.started) {
    ui.started = true
    return
  }
  if (inside(p, BTN_MUTE)) {
    ui.muted = !ui.muted
    audio.setMuted(ui.muted)
    save()
    return
  }
  if (inside(p, BTN_MOTION)) {
    ui.reducedMotion = !ui.reducedMotion
    fx.reducedMotion = ui.reducedMotion
    save()
    return
  }
  if (game.rendaActive) {
    game.tap()
    return
  }
  if (game.pushPending) {
    game.push()
    return
  }
  if (game.needsRefill && inside(p, BTN_REFILL)) {
    game.refill()
    return
  }
  game.aimX = p.x
  game.firing = true
})
canvas.addEventListener('pointermove', (ev) => {
  if (!ui.started) return
  game.aimX = toLogical(ev).x
})
const release = () => {
  game.firing = false
}
canvas.addEventListener('pointerup', release)
canvas.addEventListener('pointercancel', release)
window.addEventListener('blur', release)
window.addEventListener('keydown', (ev) => {
  if (ev.code !== 'Space' || ev.repeat) return
  ev.preventDefault()
  audio.unlock()
  if (!ui.started) ui.started = true
  else if (game.rendaActive) game.tap()
  else if (game.pushPending) game.push()
  else game.firing = true
})
window.addEventListener('keyup', (ev) => {
  if (ev.code === 'Space') game.firing = false
})

// ---------------------------------------------------------------- 画面サイズ

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H)
  canvas.style.width = `${Math.floor(W * scale)}px`
  canvas.style.height = `${Math.floor(H * scale)}px`
  canvas.width = Math.floor(W * scale * dpr)
  canvas.height = Math.floor(H * scale * dpr)
  ctx.setTransform((canvas.width / W), 0, 0, canvas.height / H, 0, 0)
}
window.addEventListener('resize', resize)
resize()

// ---------------------------------------------------------------- ループ

let prev = performance.now()
let tickTimer = 0
let heartTimer = 0

function frame(now: number) {
  const dt = Math.min(0.05, (now - prev) / 1000)
  prev = now
  clock += dt
  fx.update(dt)
  if (ui.started) {
    game.update(dt * fx.timeScale)

    // 回転中のリールの刻み音
    // 暗転・タメの間は BGM と刻み音を止めて「無音」で溜める
    const silent = !!game.spin && (game.spin.blackout || game.spin.dark)
    audio.duck(silent)
    const spinning = !silent && game.reels.some((r) => !r.stopped && !r.stopping)
    tickTimer -= dt
    if (spinning && tickTimer <= 0) {
      audio.reelTick()
      tickTimer = game.spin && game.spin.stage !== 'rolling' ? 0.16 : 0.07
    }
    // リーチ中・チャレンジ中の心音：期待度が上がるほど速くなる
    const tense = (game.spin && game.spin.stage !== 'rolling' && !game.spin.done) || (game.scene === 'challenge' && game.challengeResult === null)
    heartTimer -= dt
    if (tense && !game.spin?.blackout && heartTimer <= 0) {
      audio.heartbeat()
      const gauge = game.spin?.gauge ?? Math.min(1, game.sceneTime / 3.2) * 0.8
      heartTimer = 0.95 - gauge * 0.5
    }
    if (!tense && fx.rainbow > 0 && !game.spin) fx.rainbow = Math.max(0, fx.rainbow - dt * 0.2)

    ui.displayBalls += (game.balls - ui.displayBalls) * Math.min(1, dt * 10)
    if (Math.abs(game.balls - ui.displayBalls) < 0.5) ui.displayBalls = game.balls
    const target = game.fever?.payout ?? ui.displayPayout
    ui.displayPayout += (target - ui.displayPayout) * Math.min(1, dt * 8)
  }
  ctx.save()
  ctx.clearRect(0, 0, W, H)
  render(ctx, game, fx, ui, clock)
  ctx.restore()
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

